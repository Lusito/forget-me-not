/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { clone, ensureNotNull } from "./browserMock";
import { settings, defaultSettings, Settings, SettingsMap } from "../src/lib/settings";
import { SettingsTypeMap, RuleType, RuleDefinition } from "../src/lib/settingsSignature";

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
        testOverrides[key] = [{ rule: "*.test-override.com", type: RuleType.FORGET }];
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
        invalidOverrides[key] = [{ rule: "@@@", type: RuleType.FORGET }, "sadasd"];
    }
}

describe("Settings", () => {
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
            if (settings2) {
                settings2.destroy();
                settings2 = null;
            }
        });
        it("should affect other settings instances", (done) => {
            settings2 = ensureNotNull(settings2);
            assert.deepEqual(settings.get("version"), settings2.get("version"));
            settings.set("version", "woot");
            settings.save();

            // promise takes at least a frame until it works
            setTimeout(() => {
                settings2 = ensureNotNull(settings2);
                assert.equal(settings.get("version"), "woot");
                assert.equal(settings2.get("version"), "woot");
                done();
            }, 10);
        });
    });

    describe("getRuleTypeForDomain", () => {
        it("should return the default rule if no rule matches", () => {
            settings.set("rules", [
                { rule: "google.com", type: RuleType.WHITE },
                { rule: "google.de", type: RuleType.WHITE },
                { rule: "google.co.uk", type: RuleType.WHITE },
                { rule: "google.jp", type: RuleType.WHITE }
            ]);
            settings.save();
            assert.equal(settings.getRuleTypeForDomain("google.ca"), RuleType.FORGET);
        });
        it("should return the correct rule if a rule matches", () => {
            settings.set("rules", [
                { rule: "google.com", type: RuleType.WHITE },
                { rule: "google.de", type: RuleType.GRAY },
                { rule: "google.co.uk", type: RuleType.FORGET },
                { rule: "google.jp", type: RuleType.BLOCK }
            ]);
            settings.save();
            assert.equal(settings.getRuleTypeForDomain("google.com"), RuleType.WHITE);
            assert.equal(settings.getRuleTypeForDomain("google.de"), RuleType.GRAY);
            assert.equal(settings.getRuleTypeForDomain("google.co.uk"), RuleType.FORGET);
            assert.equal(settings.getRuleTypeForDomain("google.jp"), RuleType.BLOCK);
        });
        it("should respect the order of matching rules", () => {
            assert.equal(settings.getRuleTypeForDomain("google.com"), RuleType.FORGET);
            const rules: RuleDefinition[] = [];
            function addAndTest(type: RuleType) {
                rules.push({ rule: "google.com", type });
                settings.set("rules", rules);
                assert.equal(settings.getRuleTypeForDomain("google.com"), type);
            }
            addAndTest(RuleType.GRAY);
            addAndTest(RuleType.WHITE);
            addAndTest(RuleType.FORGET);
            addAndTest(RuleType.BLOCK);
        });
        it("should return WHITE for TLD-less domains if whitelistNoTLD is set", () => {
            assert.equal(settings.getRuleTypeForDomain("localmachine"), RuleType.FORGET);
            settings.set("whitelistNoTLD", true);
            assert.equal(settings.getRuleTypeForDomain("localmachine"), RuleType.WHITE);
        });
        it("should return WHITE for TLD-less domains if whitelistNoTLD is set", () => {
            assert.equal(settings.getRuleTypeForDomain("localmachine"), RuleType.FORGET);
            settings.set("whitelistNoTLD", true);
            assert.equal(settings.getRuleTypeForDomain("localmachine"), RuleType.WHITE);
            settings.set("rules", [{ rule: "hello@localmachine", type: RuleType.BLOCK }]);
            assert.equal(settings.getRuleTypeForDomain("localmachine"), RuleType.WHITE);
        });
    });

    describe("getRuleTypeForCookie", () => {
        it("should return the default rule if no rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: RuleType.WHITE },
                { rule: "hello@google.de", type: RuleType.WHITE },
                { rule: "hello@google.co.uk", type: RuleType.WHITE },
                { rule: "hello@google.jp", type: RuleType.WHITE }
            ]);
            settings.save();
            assert.equal(settings.getRuleTypeForCookie("google.ca", "hello"), RuleType.FORGET);
            assert.equal(settings.getRuleTypeForCookie("google.com", "world"), RuleType.FORGET);
        });
        it("should return the matching domain rule if no cookie rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: RuleType.WHITE },
                { rule: "google.com", type: RuleType.BLOCK }
            ]);
            settings.save();
            assert.equal(settings.getRuleTypeForCookie("google.com", "world"), RuleType.BLOCK);
        });
        it("should return the matching cookie rule even if a domain rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: RuleType.WHITE },
                { rule: "google.com", type: RuleType.BLOCK }
            ]);
            settings.save();
            assert.equal(settings.getRuleTypeForCookie("google.com", "hello"), RuleType.WHITE);
        });
        it("should return the correct rule if a rule matches", () => {
            settings.set("rules", [
                { rule: "hello@google.com", type: RuleType.WHITE },
                { rule: "hello@google.de", type: RuleType.GRAY },
                { rule: "hello@google.co.uk", type: RuleType.FORGET },
                { rule: "hello@google.jp", type: RuleType.BLOCK }
            ]);
            settings.save();
            assert.equal(settings.getRuleTypeForCookie("google.com", "hello"), RuleType.WHITE);
            assert.equal(settings.getRuleTypeForCookie("google.de", "hello"), RuleType.GRAY);
            assert.equal(settings.getRuleTypeForCookie("google.co.uk", "hello"), RuleType.FORGET);
            assert.equal(settings.getRuleTypeForCookie("google.jp", "hello"), RuleType.BLOCK);
        });
        it("should respect the order of matching rules", () => {
            assert.equal(settings.getRuleTypeForCookie("google.com", "hello"), RuleType.FORGET);
            const rules: RuleDefinition[] = [];
            function addAndTest(type: RuleType) {
                rules.push({ rule: "hello@google.com", type });
                settings.set("rules", rules);
                assert.equal(settings.getRuleTypeForCookie("google.com", "hello"), type);
            }
            addAndTest(RuleType.GRAY);
            addAndTest(RuleType.WHITE);
            addAndTest(RuleType.FORGET);
            addAndTest(RuleType.BLOCK);
        });
        it("should return WHITE for TLD-less domains if whitelistNoTLD is set", () => {
            assert.equal(settings.getRuleTypeForCookie("localmachine", "hello"), RuleType.FORGET);
            settings.set("whitelistNoTLD", true);
            assert.equal(settings.getRuleTypeForCookie("localmachine", "hello"), RuleType.WHITE);
            settings.set("rules", [{ rule: "hello@localmachine", type: RuleType.BLOCK }]);
            assert.equal(settings.getRuleTypeForCookie("localmachine", "hello"), RuleType.WHITE);
        });
    });

    describe("hasBlockingRule", () => {
        it("should return true if at least one blocking rule exists", () => {
            settings.set("rules", [
                { rule: "google.com", type: RuleType.WHITE },
                { rule: "google.de", type: RuleType.GRAY },
                { rule: "google.co.uk", type: RuleType.FORGET },
                { rule: "google.jp", type: RuleType.BLOCK }
            ]);
            settings.save();
            assert.isTrue(settings.hasBlockingRule());
        });
        it("should return true if the fallback rule is blocking", () => {
            settings.set("fallbackRule", RuleType.BLOCK);
            settings.save();
            assert.isTrue(settings.hasBlockingRule());
        });
        it("should return false if neither the fallback rule nor any other rule is blocking", () => {
            settings.set("fallbackRule", RuleType.FORGET);
            settings.set("rules", [
                { rule: "google.com", type: RuleType.WHITE },
                { rule: "google.de", type: RuleType.GRAY },
                { rule: "google.co.uk", type: RuleType.FORGET }
            ]);
            settings.save();
            assert.isFalse(settings.hasBlockingRule());
        });
        it("should return false for default settings (fallback rule = forget, no rules)", () => {
            assert.isFalse(settings.hasBlockingRule());
        });
    });

    describe("getMatchingRules", () => {
        context("without cookie name", () => {
            it("should return empty list if no rule matches", () => {
                settings.set("rules", [{ rule: "google.com", type: RuleType.WHITE }]);
                assert.deepEqual(settings.getMatchingRules("google.de"), []);
            });
            it("should return matching rules for plain domains", () => {
                const domainRule = { rule: "google.com", type: RuleType.WHITE };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("google.com"), [domainRule]);
            });
            it("should not return rules for plain domains if a subdomain was given", () => {
                const domainRule = { rule: "google.com", type: RuleType.WHITE };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("www.google.com"), []);
            });
            it("should return rules for wildcard domains", () => {
                const domainRule1 = { rule: "*.google.com", type: RuleType.WHITE };
                const domainRule2 = { rule: "*.amazon.*", type: RuleType.WHITE };
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
                settings.set("rules", [{ rule: "hello@google.com", type: RuleType.WHITE }]);
                assert.deepEqual(settings.getMatchingRules("google.de", "hello"), []);
                assert.deepEqual(settings.getMatchingRules("google.com", "world"), []);
            });
            it("should return matching rules for plain domains", () => {
                const domainRule = { rule: "hello@google.com", type: RuleType.WHITE };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("google.com", "hello"), [domainRule]);
            });
            it("should not return rules for plain domains if a subdomain was given", () => {
                const domainRule = { rule: "hello@google.com", type: RuleType.WHITE };
                settings.set("rules", [domainRule]);
                assert.deepEqual(settings.getMatchingRules("www.google.com", "hello"), []);
            });
            it("should return rules for wildcard domains", () => {
                const domainRule1 = { rule: "hello@*.google.com", type: RuleType.WHITE };
                const domainRule2 = { rule: "hello@*.amazon.*", type: RuleType.WHITE };
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
