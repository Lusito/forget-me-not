/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// import { browser } from "webextension-polyfill-ts";

import { container } from "tsyringe";

import { Settings, SettingsMap } from "./settings";
import { clone, booleanVariations } from "../testUtils/testHelpers";
import { SettingsKey, RuleDefinition, DefaultSettingsProvider } from "./defaultSettings";
import { CleanupType } from "./types";
import { mockEvent } from "../testUtils/mockBrowser";
import { mocks } from "../testUtils/mocks";

describe("Settings", () => {
    let settings: Settings | null = null;
    const defaultSettings = new DefaultSettingsProvider({ get: () => [] } as any, { version: "2.0.0" } as any).get();

    // generate settings map that is unequal to default settings
    const testOverrides: SettingsMap = {};
    const invalidOverrides: SettingsMap = {};
    for (const key of Object.keys(defaultSettings)) {
        const type = typeof defaultSettings[key as SettingsKey];
        if (type === "boolean") testOverrides[key] = !defaultSettings[key as SettingsKey];
        else if (type === "number") testOverrides[key] = (defaultSettings[key as SettingsKey] as number) + 1;
        else if (key === "version") testOverrides[key] = "2.0.0";
        else if (type === "string") testOverrides[key] = "test-override";
        else if (key === "rules") testOverrides[key] = [{ rule: "*.test-override.com", type: CleanupType.LEAVE }];
        else if (type === "object") testOverrides[key] = { "test-override.com": true };
        else throw new Error("Unknown settings type");

        if (type === "boolean" || type === "number" || type === "object") invalidOverrides[key] = "test-override";
        else if (type === "string") invalidOverrides[key] = 42;
        else if (key === "rules") {
            invalidOverrides[key] = [{ rule: "@@@", type: CleanupType.LEAVE }, "sadasd"] as any;
        }
    }

    async function expectSave() {
        mockBrowser.storage.local.set.expect(expect.anything());
        await settings!.save();
    }

    beforeEach(() => {
        mockEvent(mockBrowser.storage.onChanged);
        mockBrowser.storage.local.mockAllow();
        mocks.defaultSettings.get.expect().andReturn(defaultSettings);
        mocks.messageUtil.receive.expect("importSettings", expect.anything());
        settings = container.resolve(Settings);
    });

    afterEach(() => {
        settings = null;
    });

    describe("testOverrides", () => {
        it("should all be unequal to defaultSettings", () => {
            expect(defaultSettings).not.toEqual(testOverrides);
        });
    });

    describe("getAll", () => {
        it("should initially return default settings", () => {
            expect(settings!.getAll()).toEqual(defaultSettings);
        });
        it("should return overriden values", async () => {
            for (const key of Object.keys(defaultSettings))
                settings!.set(key as SettingsKey, clone(testOverrides[key]));
            await expectSave();
            expect(settings!.getAll()).toEqual(testOverrides);
        });
    });

    describe("get", () => {
        it("should initially return default settings for each key", () => {
            for (const key of Object.keys(defaultSettings))
                expect(settings!.get(key as SettingsKey)).toEqual(defaultSettings[key as SettingsKey]);
        });
    });

    describe("set", () => {
        it("should override the default settings", async () => {
            for (const key of Object.keys(defaultSettings)) {
                settings!.set(key as SettingsKey, clone(testOverrides[key]));
                // eslint-disable-next-line no-await-in-loop
                await expectSave();
                expect(settings!.get(key as SettingsKey)).toEqual(testOverrides[key]);
            }
        });
    });

    describe("setAll", () => {
        it("should override the default settings", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            await settings!.setAll(clone(testOverrides));
            expect(settings!.getAll()).toEqual(testOverrides);
        });
        it("should not override the default settings if the values are invalid types", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            mockBrowser.storage.local.remove.expect(expect.anything());
            await settings!.setAll(clone(invalidOverrides));
            expect(settings!.getAll()).toEqual(defaultSettings);
        });
    });

    describe("restoreDefaults", () => {
        it("should restore the default settings", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            await settings!.setAll(clone(testOverrides));
            mockBrowser.storage.local.set.expect(expect.anything());
            mockBrowser.storage.local.clear.expect();
            await settings!.restoreDefaults();
            expect(settings!.getAll()).toEqual(defaultSettings);
        });
    });

    describe("getCleanupTypeForDomain", () => {
        it("should return the default rule if no rule matches", async () => {
            settings!.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.NEVER },
                { rule: "google.co.uk", type: CleanupType.NEVER },
                { rule: "google.jp", type: CleanupType.NEVER },
            ]);
            await expectSave();
            expect(settings!.getCleanupTypeForDomain("google.ca")).toBe(CleanupType.LEAVE);
        });
        it("should return the correct rule if a rule matches", async () => {
            settings!.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.STARTUP },
                { rule: "google.co.uk", type: CleanupType.LEAVE },
                { rule: "google.jp", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.getCleanupTypeForDomain("google.com")).toBe(CleanupType.NEVER);
            expect(settings!.getCleanupTypeForDomain("google.de")).toBe(CleanupType.STARTUP);
            expect(settings!.getCleanupTypeForDomain("google.co.uk")).toBe(CleanupType.LEAVE);
            expect(settings!.getCleanupTypeForDomain("google.jp")).toBe(CleanupType.INSTANTLY);
        });
        it("should respect the order of matching rules", () => {
            expect(settings!.getCleanupTypeForDomain("google.com")).toBe(CleanupType.LEAVE);
            const rules: RuleDefinition[] = [];
            function addAndTest(type: CleanupType) {
                rules.push({ rule: "google.com", type });
                settings!.set("rules", rules);
                expect(settings!.getCleanupTypeForDomain("google.com")).toBe(type);
            }
            addAndTest(CleanupType.STARTUP);
            addAndTest(CleanupType.NEVER);
            addAndTest(CleanupType.LEAVE);
            addAndTest(CleanupType.INSTANTLY);
        });
        it("should return NEVER for TLD-less domains if whitelistNoTLD is set", () => {
            expect(settings!.getCleanupTypeForDomain("localmachine")).toBe(CleanupType.LEAVE);
            settings!.set("whitelistNoTLD", true);
            expect(settings!.getCleanupTypeForDomain("localmachine")).toBe(CleanupType.NEVER);
            settings!.set("rules", [{ rule: "hello@localmachine", type: CleanupType.INSTANTLY }]);
            expect(settings!.getCleanupTypeForDomain("localmachine")).toBe(CleanupType.NEVER);
        });
        it("should return NEVER for empty domains if whitelistFileSystem is set", () => {
            expect(settings!.getCleanupTypeForDomain("")).toBe(CleanupType.NEVER);
            settings!.set("whitelistFileSystem", false);
            expect(settings!.getCleanupTypeForDomain("")).toBe(CleanupType.LEAVE);
        });
    });

    describe.each(booleanVariations(1))("isDomainProtected with ignoreStartupType=%j", (ignoreStartupType) => {
        it("should return true if protected", async () => {
            settings!.set("rules", [
                { rule: "*.google.com", type: CleanupType.NEVER },
                { rule: "*.google.de", type: CleanupType.STARTUP },
                { rule: "*.google.co.uk", type: CleanupType.LEAVE },
                { rule: "*.google.jp", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.isDomainProtected("www.google.com", true)).toBe(true);
            expect(settings!.isDomainProtected("www.google.de", ignoreStartupType)).toBe(!ignoreStartupType);
            expect(settings!.isDomainProtected("www.google.co.uk", true)).toBe(false);
            expect(settings!.isDomainProtected("www.google.jp", true)).toBe(false);
            expect(settings!.isDomainBlocked("www.amazon.com")).toBe(false);
        });
    });

    describe("isDomainBlocked", () => {
        it("should return true if proected", async () => {
            settings!.set("rules", [
                { rule: "*.google.com", type: CleanupType.NEVER },
                { rule: "*.google.de", type: CleanupType.STARTUP },
                { rule: "*.google.co.uk", type: CleanupType.LEAVE },
                { rule: "*.google.jp", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.isDomainBlocked("www.google.com")).toBe(false);
            expect(settings!.isDomainBlocked("www.google.de")).toBe(false);
            expect(settings!.isDomainBlocked("www.google.co.uk")).toBe(false);
            expect(settings!.isDomainBlocked("www.google.jp")).toBe(true);
            expect(settings!.isDomainBlocked("www.amazon.com")).toBe(false);
        });
    });

    describe("getChosenRulesForDomain", () => {
        const catchAllRuleStartup = { rule: "*", type: CleanupType.STARTUP };
        const catchComRuleStartup = { rule: "*.com", type: CleanupType.STARTUP };
        const catchAllRuleNever = { rule: "*", type: CleanupType.NEVER };
        const catchAllRuleLeave = { rule: "*", type: CleanupType.LEAVE };
        const catchAllRuleInstantly = { rule: "*", type: CleanupType.INSTANTLY };
        it("should return an empty array if whitelistFileSystem = true and domain is empty", () => {
            settings!.set("rules", [catchAllRuleNever]);
            settings!.set("whitelistFileSystem", true);
            expect(settings!.getChosenRulesForDomain("")).toHaveLength(0);
        });
        it("should return an empty array if whitelistNoTLD = true and domain contains no dot", () => {
            settings!.set("rules", [catchAllRuleNever]);
            settings!.set("whitelistNoTLD", true);
            settings!.set("whitelistFileSystem", false);
            expect(settings!.getChosenRulesForDomain("hello")).toHaveLength(0);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveSameMembers([catchAllRuleNever]);
            expect(settings!.getChosenRulesForDomain("")).toHaveSameMembers([catchAllRuleNever]);
        });
        it("should return the chosen rule", () => {
            settings!.set("whitelistNoTLD", false);
            settings!.set("whitelistFileSystem", false);
            settings!.set("rules", []);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveLength(0);
            settings!.set("rules", [catchAllRuleStartup]);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveSameMembers([catchAllRuleStartup]);
            settings!.set("rules", [catchAllRuleStartup, catchAllRuleNever]);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveSameMembers([catchAllRuleNever]);
            settings!.set("rules", [catchAllRuleStartup, catchAllRuleNever, catchAllRuleLeave]);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveSameMembers([catchAllRuleLeave]);
            settings!.set("rules", [catchAllRuleStartup, catchAllRuleNever, catchAllRuleLeave, catchAllRuleInstantly]);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveSameMembers([catchAllRuleInstantly]);
            settings!.set("rules", [catchAllRuleInstantly, catchAllRuleLeave, catchAllRuleNever, catchAllRuleStartup]);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveSameMembers([catchAllRuleInstantly]);
        });
        it("should return multiple chosen rules", () => {
            settings!.set("whitelistNoTLD", false);
            settings!.set("whitelistFileSystem", false);
            settings!.set("rules", [catchAllRuleStartup, catchComRuleStartup]);
            expect(settings!.getChosenRulesForDomain("google.com")).toHaveSameMembers([
                catchAllRuleStartup,
                catchComRuleStartup,
            ]);
        });
    });

    describe("getCleanupTypeForCookie", () => {
        it("should return the default rule if no rule matches", async () => {
            settings!.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "hello@google.de", type: CleanupType.NEVER },
                { rule: "hello@google.co.uk", type: CleanupType.NEVER },
                { rule: "hello@google.jp", type: CleanupType.NEVER },
            ]);
            await expectSave();
            expect(settings!.getCleanupTypeForCookie("google.ca", "hello")).toBe(CleanupType.LEAVE);
            expect(settings!.getCleanupTypeForCookie("google.com", "world")).toBe(CleanupType.LEAVE);
        });
        it("should return the matching domain rule if no cookie rule matches", async () => {
            settings!.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "google.com", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.getCleanupTypeForCookie("google.com", "world")).toBe(CleanupType.INSTANTLY);
        });
        it("should return the matching cookie rule even if a domain rule matches", async () => {
            settings!.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "google.com", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.getCleanupTypeForCookie("google.com", "hello")).toBe(CleanupType.NEVER);
        });
        it("should return the correct rule if a rule matches", async () => {
            settings!.set("rules", [
                { rule: "hello@google.com", type: CleanupType.NEVER },
                { rule: "hello@google.de", type: CleanupType.STARTUP },
                { rule: "hello@google.co.uk", type: CleanupType.LEAVE },
                { rule: "hello@google.jp", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.getCleanupTypeForCookie("google.com", "hello")).toBe(CleanupType.NEVER);
            expect(settings!.getCleanupTypeForCookie("google.de", "hello")).toBe(CleanupType.STARTUP);
            expect(settings!.getCleanupTypeForCookie("google.co.uk", "hello")).toBe(CleanupType.LEAVE);
            expect(settings!.getCleanupTypeForCookie("google.jp", "hello")).toBe(CleanupType.INSTANTLY);
        });
        it("should respect the order of matching rules", () => {
            expect(settings!.getCleanupTypeForCookie("google.com", "hello")).toBe(CleanupType.LEAVE);
            const rules: RuleDefinition[] = [];
            function addAndTest(type: CleanupType) {
                rules.push({ rule: "hello@google.com", type });
                settings!.set("rules", rules);
                expect(settings!.getCleanupTypeForCookie("google.com", "hello")).toBe(type);
            }
            addAndTest(CleanupType.STARTUP);
            addAndTest(CleanupType.NEVER);
            addAndTest(CleanupType.LEAVE);
            addAndTest(CleanupType.INSTANTLY);
        });
        it("should return NEVER for TLD-less domains if whitelistNoTLD is set", () => {
            expect(settings!.getCleanupTypeForCookie("localmachine", "hello")).toBe(CleanupType.LEAVE);
            settings!.set("whitelistNoTLD", true);
            expect(settings!.getCleanupTypeForCookie("localmachine", "hello")).toBe(CleanupType.NEVER);
            settings!.set("rules", [{ rule: "hello@localmachine", type: CleanupType.INSTANTLY }]);
            expect(settings!.getCleanupTypeForCookie("localmachine", "hello")).toBe(CleanupType.NEVER);
            settings!.set("whitelistFileSystem", false);
            expect(settings!.getCleanupTypeForCookie("", "hello")).toBe(CleanupType.LEAVE);
        });
        it("should return NEVER for empty domains if whitelistFileSystem is set", () => {
            expect(settings!.getCleanupTypeForCookie("", "hello")).toBe(CleanupType.NEVER);
            settings!.set("whitelistFileSystem", false);
            expect(settings!.getCleanupTypeForCookie("", "hello")).toBe(CleanupType.LEAVE);
        });
    });

    // fixme: getExactRuleDefinition, getRulesForDomain

    describe("getExactCleanupType", () => {
        it("should return exact matches only", async () => {
            settings!.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "www.google.com", type: CleanupType.STARTUP },
                { rule: "mail.google.com", type: CleanupType.LEAVE },
                { rule: "*.google.com", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.getExactCleanupType("google.com")).toBe(CleanupType.NEVER);
            expect(settings!.getExactCleanupType("www.google.com")).toBe(CleanupType.STARTUP);
            expect(settings!.getExactCleanupType("mail.google.com")).toBe(CleanupType.LEAVE);
            expect(settings!.getExactCleanupType("*.google.com")).toBe(CleanupType.INSTANTLY);
            expect(settings!.getExactCleanupType("images.google.com")).toBeNull();
        });
    });

    describe("hasBlockingRule", () => {
        it("should return true if at least one blocking rule exists", async () => {
            settings!.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.STARTUP },
                { rule: "google.co.uk", type: CleanupType.LEAVE },
                { rule: "google.jp", type: CleanupType.INSTANTLY },
            ]);
            await expectSave();
            expect(settings!.hasBlockingRule()).toBe(true);
        });
        it("should return true if the fallback rule is blocking", async () => {
            settings!.set("fallbackRule", CleanupType.INSTANTLY);
            await expectSave();
            expect(settings!.hasBlockingRule()).toBe(true);
        });
        it("should return false if neither the fallback rule nor any other rule is blocking", async () => {
            settings!.set("fallbackRule", CleanupType.LEAVE);
            settings!.set("rules", [
                { rule: "google.com", type: CleanupType.NEVER },
                { rule: "google.de", type: CleanupType.STARTUP },
                { rule: "google.co.uk", type: CleanupType.LEAVE },
            ]);
            await expectSave();
            expect(settings!.hasBlockingRule()).toBe(false);
        });
        it("should return false for default settings (fallback rule = leave, no rules)", () => {
            expect(settings!.hasBlockingRule()).toBe(false);
        });
    });

    describe("getMatchingRules", () => {
        describe("without cookie name", () => {
            it("should return empty list if no rule matches", () => {
                settings!.set("rules", [{ rule: "google.com", type: CleanupType.NEVER }]);
                expect(settings!.getMatchingRules("google.de")).toHaveLength(0);
            });
            it("should return matching rules for plain domains", () => {
                const domainRule = { rule: "google.com", type: CleanupType.NEVER };
                settings!.set("rules", [domainRule]);
                expect(settings!.getMatchingRules("google.com")).toEqual([domainRule]);
            });
            it("should not return rules for plain domains if a subdomain was given", () => {
                const domainRule = { rule: "google.com", type: CleanupType.NEVER };
                settings!.set("rules", [domainRule]);
                expect(settings!.getMatchingRules("www.google.com")).toHaveLength(0);
            });
            it("should return rules for wildcard domains", () => {
                const domainRule1 = { rule: "*.google.com", type: CleanupType.NEVER };
                const domainRule2 = { rule: "*.amazon.*", type: CleanupType.NEVER };
                settings!.set("rules", [domainRule1, domainRule2]);
                expect(settings!.getMatchingRules("google.com")).toEqual([domainRule1]);
                expect(settings!.getMatchingRules("www.google.com")).toEqual([domainRule1]);
                expect(settings!.getMatchingRules("let.me.google.that.for.you.google.com")).toEqual([domainRule1]);
                expect(settings!.getMatchingRules("amazon.de")).toEqual([domainRule2]);
                expect(settings!.getMatchingRules("amazon.com")).toEqual([domainRule2]);
                expect(settings!.getMatchingRules("prime.amazon.jp")).toEqual([domainRule2]);
            });
        });
        describe("with cookie name", () => {
            it("should return empty list if no rule matches", () => {
                settings!.set("rules", [{ rule: "hello@google.com", type: CleanupType.NEVER }]);
                expect(settings!.getMatchingRules("google.de", "hello")).toHaveLength(0);
                expect(settings!.getMatchingRules("google.com", "world")).toHaveLength(0);
            });
            it("should return matching rules for plain domains", () => {
                const domainRule = { rule: "hello@google.com", type: CleanupType.NEVER };
                settings!.set("rules", [domainRule]);
                expect(settings!.getMatchingRules("google.com", "hello")).toEqual([domainRule]);
            });
            it("should not return rules for plain domains if a subdomain was given", () => {
                const domainRule = { rule: "hello@google.com", type: CleanupType.NEVER };
                settings!.set("rules", [domainRule]);
                expect(settings!.getMatchingRules("www.google.com", "hello")).toHaveLength(0);
            });
            it("should return rules for wildcard domains", () => {
                const domainRule1 = { rule: "hello@*.google.com", type: CleanupType.NEVER };
                const domainRule2 = { rule: "hello@*.amazon.*", type: CleanupType.NEVER };
                settings!.set("rules", [domainRule1, domainRule2]);
                expect(settings!.getMatchingRules("google.com", "hello")).toEqual([domainRule1]);
                expect(settings!.getMatchingRules("www.google.com", "hello")).toEqual([domainRule1]);
                expect(settings!.getMatchingRules("let.me.google.that.for.you.google.com", "hello")).toEqual([
                    domainRule1,
                ]);
                expect(settings!.getMatchingRules("amazon.de", "hello")).toEqual([domainRule2]);
                expect(settings!.getMatchingRules("amazon.com", "hello")).toEqual([domainRule2]);
                expect(settings!.getMatchingRules("prime.amazon.jp", "hello")).toEqual([domainRule2]);
            });
        });
    });

    describe("setRule", () => {
        it("should save rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            await settings!.setRule("*.com", CleanupType.INSTANTLY, false);
            expect(settings!.get("rules")).toEqual([{ rule: "*.com", type: CleanupType.INSTANTLY }]);
        });
        it("should override existing rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings!.setRule("*.com", CleanupType.NEVER, false);
            await settings!.setRule("*.de", CleanupType.NEVER, false);
            await settings!.setRule("*.com", CleanupType.INSTANTLY, false);
            expect(settings!.get("rules")).toEqual([
                { rule: "*.com", type: CleanupType.INSTANTLY },
                { rule: "*.de", type: CleanupType.NEVER },
            ]);
        });
    });

    describe("removeRule", () => {
        it("should save rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(2);
            await settings!.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings!.removeRule("*.com");
            expect(settings!.get("rules")).toHaveLength(0);
        });
        it("should keep other rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings!.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings!.setRule("*.de", CleanupType.NEVER, false);
            await settings!.removeRule("*.com");
            expect(settings!.get("rules")).toEqual([{ rule: "*.de", type: CleanupType.NEVER }]);
        });
    });

    describe("removeRules", () => {
        it("should save rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(2);
            await settings!.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings!.removeRules(["*.com"]);
            expect(settings!.get("rules")).toHaveLength(0);
        });
        it("should keep other rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings!.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings!.setRule("*.de", CleanupType.NEVER, false);
            await settings!.removeRules(["*.com"]);
            expect(settings!.get("rules")).toEqual([{ rule: "*.de", type: CleanupType.NEVER }]);
        });
    });

    describe("getTemporaryRules", () => {
        it("should get only temporary rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(2);
            await settings!.setRule("*.com", CleanupType.INSTANTLY, true);
            await settings!.setRule("*.de", CleanupType.INSTANTLY, false);
            expect(settings!.getTemporaryRules().map((r) => r.definition)).toEqual([
                { rule: "*.com", type: CleanupType.INSTANTLY, temporary: true },
            ]);
        });
    });

    describe("removeTemporaryRules", () => {
        it("should remove only temporary rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings!.setRule("*.com", CleanupType.INSTANTLY, true);
            await settings!.setRule("*.de", CleanupType.INSTANTLY, false);
            await settings!.removeTemporaryRules();
            expect(settings!.get("rules")).toEqual([{ rule: "*.de", type: CleanupType.INSTANTLY }]);
            expect(settings!.getTemporaryRules()).toHaveLength(0);
        });
    });
});
