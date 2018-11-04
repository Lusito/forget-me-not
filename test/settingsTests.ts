/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { browserMock } from "./browserMock";
import { ensureNotNull, doneHandler, clone } from "./testHelpers";
import { destroyAndNull } from "../src/shared";
import { settings, defaultSettings, Settings, SettingsMap } from "../src/lib/settings";
import { SettingsTypeMap, CleanupType, RuleDefinition } from "../src/lib/settingsSignature";

// generate settings map that is unequal to default settings
const testOverrides: SettingsMap = {};
const invalidOverrides: SettingsMap = {};
for (const key in defaultSettings) {
    const type = typeof (defaultSettings[key]);
    if (type === "boolean")
        testOverrides[key] = !defaultSettings[key];
    else if (type === "number")
        testOverrides[key] = defaultSettings[key] as number + 1;
    else if (type === "string")
        testOverrides[key] = "test-override";
    else if (key === "rules")
        testOverrides[key] = [{ rule: "*.test-override.com", type: CleanupType.LEAVE }];
    else if (type === "object")
        testOverrides[key] = { "test-override.com": true };
    else
        throw new Error("Unknown settings type");

    if (type === "boolean" || type === "number" || type === "object")
        invalidOverrides[key] = "test-override";
    else if (type === "string")
        invalidOverrides[key] = 42;
    else if (key === "rules") {
        // @ts-ignore
        invalidOverrides[key] = [{ rule: "@@@", type: CleanupType.LEAVE }, "sadasd"];
    }
}

describe("Settings", () => {
    beforeEach(() => browserMock.reset());
    afterEach(() => {
        settings.restoreDefaults();
    });

    describe("testOverrides", () => {
        it("should all be unequal to defaultSettings", () => {
            assert.notDeepEqual(defaultSettings, testOverrides);
        });
    });

    describe("getAll", () => {
        it("should initially return default settings", () => {
            assert.deepEqual(settings.getAll(), defaultSettings);
        });
        it("should return overriden values", () => {
            for (const key in defaultSettings)
                settings.set(key as keyof SettingsTypeMap, clone(testOverrides[key]));
            settings.save();
            assert.deepEqual(settings.getAll(), testOverrides);
        });
    });

    describe("get", () => {
        it("should initially return default settings for each key", () => {
            for (const key in defaultSettings)
                assert.deepEqual(settings.get(key as keyof SettingsTypeMap), defaultSettings[key]);
        });
    });

    describe("set", () => {
        it("should override the default settings", () => {
            for (const key in defaultSettings) {
                settings.set(key as keyof SettingsTypeMap, clone(testOverrides[key]));
                settings.save();
                assert.deepEqual(settings.get(key as keyof SettingsTypeMap), testOverrides[key]);
            }
        });
    });

    describe("setAll", () => {
        it("should override the default settings", () => {
            settings.setAll(clone(testOverrides));
            assert.deepEqual(settings.getAll(), testOverrides);
        });
        it("should not override the default settings if the values are invalid types", () => {
            settings.setAll(clone(invalidOverrides));
            assert.deepEqual(settings.getAll(), defaultSettings);
        });
    });

    describe("restoreDefaults", () => {
        it("should restore the default settings", () => {
            settings.setAll(clone(testOverrides));
            settings.restoreDefaults();
            assert.deepEqual(settings.getAll(), defaultSettings);
        });
    });

    describe("save", () => {
        let settings2: Settings | null = null;
        beforeEach(() => {
            if (!settings2)
                settings2 = new Settings();
        });
        afterEach(() => {
            settings2 = destroyAndNull(settings2);
        });
        it("should affect other settings instances", (done) => {
            settings2 = ensureNotNull(settings2);
            assert.deepEqual(settings.get("version"), settings2.get("version"));
            settings.set("version", "woot");
            settings.save().then(doneHandler(() => {
                settings2 = ensureNotNull(settings2);
                assert.equal(settings.get("version"), "woot");
                assert.equal(settings2.get("version"), "woot");
            }, done));
        });
    });

    describe("getCleanupTypeForDomain", () => {
        it("should return the default rule if no rule matches", () => {
            settings.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.NEVER },
                { rule: "google.co.uk", type: CleanupType.NEVER },
                { rule: "google.jp", type: CleanupType.NEVER }
            ]);
            settings.save();
            assert.equal(settings.getCleanupTypeForDomain("google.ca"), CleanupType.LEAVE);
        });
        it("should return the correct rule if a rule matches", () => {
            settings.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.STARTUP },
                { rule: "google.co.uk", type: CleanupType.LEAVE },
                { rule: "google.jp", type: CleanupType.INSTANTLY }
            ]);
            settings.save();
            assert.equal(settings.getCleanupTypeForDomain("google.com"), CleanupType.NEVER);
            assert.equal(settings.getCleanupTypeForDomain("google.de"), CleanupType.STARTUP);
            assert.equal(settings.getCleanupTypeForDomain("google.co.uk"), CleanupType.LEAVE);
            assert.equal(settings.getCleanupTypeForDomain("google.jp"), CleanupType.INSTANTLY);
        });
        it("should respect the order of matching rules", () => {
            assert.equal(settings.getCleanupTypeForDomain("google.com"), CleanupType.LEAVE);
            const rules: RuleDefinition[] = [];
            function addAndTest(type: CleanupType) {
                rules.push({ rule: "google.com", type });
                settings.set("rules", rules);
                assert.equal(settings.getCleanupTypeForDomain("google.com"), type);
            }
            addAndTest(CleanupType.STARTUP);
            addAndTest(CleanupType.NEVER);
            addAndTest(CleanupType.LEAVE);
            addAndTest(CleanupType.INSTANTLY);
        });
        it("should return NEVER for TLD-less domains if whitelistNoTLD is set", () => {
            assert.equal(settings.getCleanupTypeForDomain("localmachine"), CleanupType.LEAVE);
            settings.set("whitelistNoTLD", true);
            assert.equal(settings.getCleanupTypeForDomain("localmachine"), CleanupType.NEVER);
            settings.set("rules", [{ rule: "hello@localmachine", type: CleanupType.INSTANTLY }]);
            assert.equal(settings.getCleanupTypeForDomain("localmachine"), CleanupType.NEVER);
        });
        it("should return NEVER for empty domains if whitelistFileSystem is set", () => {
            assert.equal(settings.getCleanupTypeForDomain(""), CleanupType.NEVER);
            settings.set("whitelistFileSystem", false);
            assert.equal(settings.getCleanupTypeForDomain(""), CleanupType.LEAVE);
        });
    });

    describe("getCleanupTypeForCookie", () => {
        it("should return the default rule if no rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "hello@google.de", type: CleanupType.NEVER },
                { rule: "hello@google.co.uk", type: CleanupType.NEVER },
                { rule: "hello@google.jp", type: CleanupType.NEVER }
            ]);
            settings.save();
            assert.equal(settings.getCleanupTypeForCookie("google.ca", "hello"), CleanupType.LEAVE);
            assert.equal(settings.getCleanupTypeForCookie("google.com", "world"), CleanupType.LEAVE);
        });
        it("should return the matching domain rule if no cookie rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "google.com", type: CleanupType.INSTANTLY }
            ]);
            settings.save();
            assert.equal(settings.getCleanupTypeForCookie("google.com", "world"), CleanupType.INSTANTLY);
        });
        it("should return the matching cookie rule even if a domain rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "google.com", type: CleanupType.INSTANTLY }
            ]);
            settings.save();
            assert.equal(settings.getCleanupTypeForCookie("google.com", "hello"), CleanupType.NEVER);
        });
        it("should return the correct rule if a rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "hello@google.de", type: CleanupType.STARTUP },
                { rule: "hello@google.co.uk", type: CleanupType.LEAVE },
                { rule: "hello@google.jp", type: CleanupType.INSTANTLY }
            ]);
            settings.save();
            assert.equal(settings.getCleanupTypeForCookie("google.com", "hello"), CleanupType.NEVER);
            assert.equal(settings.getCleanupTypeForCookie("google.de", "hello"), CleanupType.STARTUP);
            assert.equal(settings.getCleanupTypeForCookie("google.co.uk", "hello"), CleanupType.LEAVE);
            assert.equal(settings.getCleanupTypeForCookie("google.jp", "hello"), CleanupType.INSTANTLY);
        });
        it("should respect the order of matching rules", () => {
            assert.equal(settings.getCleanupTypeForCookie("google.com", "hello"), CleanupType.LEAVE);
            const rules: RuleDefinition[] = [];
            function addAndTest(type: CleanupType) {
                rules.push({ rule: "hello@google.com", type });
                settings.set("rules", rules);
                assert.equal(settings.getCleanupTypeForCookie("google.com", "hello"), type);
            }
            addAndTest(CleanupType.STARTUP);
            addAndTest(CleanupType.NEVER);
            addAndTest(CleanupType.LEAVE);
            addAndTest(CleanupType.INSTANTLY);
        });
        it("should return NEVER for TLD-less domains if whitelistNoTLD is set", () => {
            assert.equal(settings.getCleanupTypeForCookie("localmachine", "hello"), CleanupType.LEAVE);
            settings.set("whitelistNoTLD", true);
            assert.equal(settings.getCleanupTypeForCookie("localmachine", "hello"), CleanupType.NEVER);
            settings.set("rules", [{ rule: "hello@localmachine", type: CleanupType.INSTANTLY }]);
            assert.equal(settings.getCleanupTypeForCookie("localmachine", "hello"), CleanupType.NEVER);
        });
        it("should return NEVER for empty domains if whitelistFileSystem is set", () => {
            assert.equal(settings.getCleanupTypeForCookie("", "hello"), CleanupType.NEVER);
            settings.set("whitelistFileSystem", false);
            assert.equal(settings.getCleanupTypeForCookie("", "hello"), CleanupType.LEAVE);
        });
    });

    describe("hasBlockingRule", () => {
        it("should return true if at least one blocking rule exists", () => {
            settings.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.STARTUP },
                { rule: "google.co.uk", type: CleanupType.LEAVE },
                { rule: "google.jp", type: CleanupType.INSTANTLY }
            ]);
            settings.save();
            assert.isTrue(settings.hasBlockingRule());
        });
        it("should return true if the fallback rule is blocking", () => {
            settings.set("fallbackRule", CleanupType.INSTANTLY);
            settings.save();
            assert.isTrue(settings.hasBlockingRule());
        });
        it("should return false if neither the fallback rule nor any other rule is blocking", () => {
            settings.set("fallbackRule", CleanupType.LEAVE);
            settings.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.STARTUP },
                { rule: "google.co.uk", type: CleanupType.LEAVE }
            ]);
            settings.save();
            assert.isFalse(settings.hasBlockingRule());
        });
        it("should return false for default settings (fallback rule = leave, no rules)", () => {
            assert.isFalse(settings.hasBlockingRule());
        });
    });

    describe("getMatchingRules", () => {
        context("without cookie name", () => {
            it("should return empty list if no rule matches", () => {
                settings.set("rules", [{ rule: "google.com", type: CleanupType.NEVER }]);
                assert.deepEqual(settings.getMatchingRules("google.de"), []);
            });
            it("should return matching rules for plain domains", () => {
                const domainRule = { rule: "google.com", type: CleanupType.NEVER };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("google.com"), [domainRule]);
            });
            it("should not return rules for plain domains if a subdomain was given", () => {
                const domainRule = { rule: "google.com", type: CleanupType.NEVER };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("www.google.com"), []);
            });
            it("should return rules for wildcard domains", () => {
                const domainRule1 = { rule: "*.google.com", type: CleanupType.NEVER };
                const domainRule2 = { rule: "*.amazon.*", type: CleanupType.NEVER };
                settings.set("rules", [domainRule1, domainRule2]);
                assert.deepEqual(settings.getMatchingRules("google.com"), [domainRule1]);
                assert.deepEqual(settings.getMatchingRules("www.google.com"), [domainRule1]);
                assert.deepEqual(settings.getMatchingRules("let.me.google.that.for.you.google.com"), [domainRule1]);
                assert.deepEqual(settings.getMatchingRules("amazon.de"), [domainRule2]);
                assert.deepEqual(settings.getMatchingRules("amazon.com"), [domainRule2]);
                assert.deepEqual(settings.getMatchingRules("prime.amazon.jp"), [domainRule2]);
            });
        });
        context("with cookie name", () => {
            it("should return empty list if no rule matches", () => {
                settings.set("rules", [{ rule: "hello@google.com", type: CleanupType.NEVER }]);
                assert.deepEqual(settings.getMatchingRules("google.de", "hello"), []);
                assert.deepEqual(settings.getMatchingRules("google.com", "world"), []);
            });
            it("should return matching rules for plain domains", () => {
                const domainRule = { rule: "hello@google.com", type: CleanupType.NEVER };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("google.com", "hello"), [domainRule]);
            });
            it("should not return rules for plain domains if a subdomain was given", () => {
                const domainRule = { rule: "hello@google.com", type: CleanupType.NEVER };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("www.google.com", "hello"), []);
            });
            it("should return rules for wildcard domains", () => {
                const domainRule1 = { rule: "hello@*.google.com", type: CleanupType.NEVER };
                const domainRule2 = { rule: "hello@*.amazon.*", type: CleanupType.NEVER };
                settings.set("rules", [domainRule1, domainRule2]);
                assert.deepEqual(settings.getMatchingRules("google.com", "hello"), [domainRule1]);
                assert.deepEqual(settings.getMatchingRules("www.google.com", "hello"), [domainRule1]);
                assert.deepEqual(settings.getMatchingRules("let.me.google.that.for.you.google.com", "hello"), [domainRule1]);
                assert.deepEqual(settings.getMatchingRules("amazon.de", "hello"), [domainRule2]);
                assert.deepEqual(settings.getMatchingRules("amazon.com", "hello"), [domainRule2]);
                assert.deepEqual(settings.getMatchingRules("prime.amazon.jp", "hello"), [domainRule2]);
            });
        });
    });
});
