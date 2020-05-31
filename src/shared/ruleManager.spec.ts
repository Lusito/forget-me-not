import { container } from "tsyringe";
import { mockAssimilate } from "mockzilla";

import { RuleDefinition } from "./defaultSettings";
import { CleanupType } from "./types";
import { RuleManager } from "./ruleManager";
import { mocks } from "../testUtils/mocks";

const domains = {
    unknown_com: "unknown.com",
    unknown_info: "unknown.info",
    unknown_net: "unknown.net",

    never_com: "never.com",
    never_info: "never.info",
    never_net: "never.net",

    startup_com: "startup.com",
    startup_info: "startup.info",
    startup_net: "startup.net",

    leave_com: "leave.com",
    leave_info: "leave.info",
    leave_net: "leave.net",

    instantly_com: "instantly.com",
    instantly_info: "instantly.info",
    instantly_net: "instantly.net",
};

const subdomains: typeof domains = {} as any;

Object.keys(domains).forEach((key) => {
    subdomains[key as keyof typeof domains] = `sub.${domains[key as keyof typeof domains]}`;
});

function typeForKey(key: string) {
    const type = key.split("_")[0].toUpperCase();
    return CleanupType[type as keyof typeof CleanupType];
}

const basicRules: RuleDefinition[] = Object.keys(domains)
    .filter((key) => !key.startsWith("unknown"))
    .map((key) => ({
        rule: `*.${domains[key as keyof typeof domains]}`,
        type: typeForKey(key),
    }));

const cookieNames = ["unknown", "never", "startup", "leave", "instantly"];
const cookieRules: RuleDefinition[] = cookieNames
    .filter((key) => key !== "unknown")
    .map((key) => ({
        rule: `${key}@*.cookie.com`,
        type: typeForKey(key),
    }));

const cleanupTypeVariations = [
    [CleanupType.NEVER],
    [CleanupType.STARTUP],
    [CleanupType.LEAVE],
    [CleanupType.INSTANTLY],
];

describe("RuleManager", () => {
    let ruleManager: RuleManager;

    beforeEach(() => {
        mocks.storeUtils.mockAllow();
        ruleManager = container.resolve(RuleManager);
    });

    function setupBasicRules() {
        ruleManager.update({
            fallbackRule: CleanupType.LEAVE,
            whitelistFileSystem: false,
            whitelistNoTLD: false,
            rules: basicRules,
            protectOpenDomains: {
                startup: true,
                manual: true,
            },
        });
    }

    describe("getCleanupTypeFor", () => {
        const catchAllRuleInstantly = { rule: "*", type: CleanupType.INSTANTLY };
        beforeEach(() => {
            ruleManager["identities"] = [{ name: "container", cookieStoreId: "mock-container" } as any];
        });
        it("should return NEVER if whitelistFileSystem = true and domain is empty", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: true,
                whitelistNoTLD: false,
                rules: [catchAllRuleInstantly],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor("hello", false, false)).toBe(CleanupType.INSTANTLY);
            expect(ruleManager.getCleanupTypeFor("google.com", false, false)).toBe(CleanupType.INSTANTLY);
            expect(ruleManager.getCleanupTypeFor("", false, false)).toBe(CleanupType.NEVER);
        });
        it("should return NEVER if whitelistNoTLD = true and domain contains no dot", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: true,
                rules: [catchAllRuleInstantly],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor("hello", false, false)).toBe(CleanupType.NEVER);
            expect(ruleManager.getCleanupTypeFor("google.com", false, false)).toBe(CleanupType.INSTANTLY);
            expect(ruleManager.getCleanupTypeFor("", false, false)).toBe(CleanupType.INSTANTLY);
        });
        it.each(cleanupTypeVariations)("should return the fallback rule (%i) if no rule matches", (fallbackRule) => {
            ruleManager.update({
                fallbackRule,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [...basicRules, ...cookieRules],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor(subdomains.unknown_com, false, false)).toBe(fallbackRule);
            expect(ruleManager.getCleanupTypeFor("sub.cookie.com", "", "unknown")).toBe(fallbackRule);
        });
        it("should return the correct cleanup type", () => {
            setupBasicRules();
            expect(ruleManager.getCleanupTypeFor(subdomains.never_com, false, false)).toBe(CleanupType.NEVER);
            expect(ruleManager.getCleanupTypeFor(subdomains.leave_com, false, false)).toBe(CleanupType.LEAVE);
            expect(ruleManager.getCleanupTypeFor(subdomains.startup_com, false, false)).toBe(CleanupType.STARTUP);
            expect(ruleManager.getCleanupTypeFor(subdomains.instantly_com, false, false)).toBe(CleanupType.INSTANTLY);
            expect(ruleManager.getCleanupTypeFor(subdomains.unknown_com, false, false)).toBe(CleanupType.LEAVE);
        });
        it("should return the correct cleanup rule for container specific rules", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [
                    ...basicRules,
                    { rule: `container?*.${domains.never_com}`, type: CleanupType.INSTANTLY },
                    { rule: `container?*.${domains.leave_com}`, type: CleanupType.STARTUP },
                    { rule: `container?*.${domains.startup_com}`, type: CleanupType.LEAVE },
                    { rule: `container?*.${domains.instantly_com}`, type: CleanupType.NEVER },
                ],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor(subdomains.never_com, "mock-container", false)).toBe(
                CleanupType.INSTANTLY
            );
            expect(ruleManager.getCleanupTypeFor(subdomains.leave_com, "mock-container", false)).toBe(
                CleanupType.STARTUP
            );
            expect(ruleManager.getCleanupTypeFor(subdomains.startup_com, "mock-container", false)).toBe(
                CleanupType.LEAVE
            );
            expect(ruleManager.getCleanupTypeFor(subdomains.instantly_com, "mock-container", false)).toBe(
                CleanupType.NEVER
            );
        });
        it("should return the matching generic rule if no cookie rule matches", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [...cookieRules, { rule: "*.cookie.com", type: CleanupType.INSTANTLY }],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "unknown")).toBe(
                CleanupType.INSTANTLY
            );
        });
        it("should return the matching cookie rule even if a generic rule matches", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [...cookieRules, { rule: "*.cookie.com", type: CleanupType.INSTANTLY }],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "never")).toBe(CleanupType.NEVER);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "startup")).toBe(CleanupType.STARTUP);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "leave")).toBe(CleanupType.LEAVE);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "instantly")).toBe(
                CleanupType.INSTANTLY
            );
        });
        it("should return the matching container rule even if a cookie rule matches", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [...cookieRules, { rule: "container?*.cookie.com", type: CleanupType.INSTANTLY }],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "never")).toBe(CleanupType.INSTANTLY);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "startup")).toBe(
                CleanupType.INSTANTLY
            );
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "leave")).toBe(CleanupType.INSTANTLY);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "instantly")).toBe(
                CleanupType.INSTANTLY
            );
        });
        it("should return the matching container/cookie rule even if a container rule matches", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [
                    ...cookieRules.map((rule) => ({
                        ...rule,
                        rule: `container?${rule.rule}`,
                    })),
                    { rule: "container?*.cookie.com", type: CleanupType.INSTANTLY },
                ],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "never")).toBe(CleanupType.NEVER);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "startup")).toBe(CleanupType.STARTUP);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "leave")).toBe(CleanupType.LEAVE);
            expect(ruleManager.getCleanupTypeFor("cookie.com", "mock-container", "instantly")).toBe(
                CleanupType.INSTANTLY
            );
        });
    });

    describe.each([["mock-container", false]])("isDomainProtected with storeId=%j", (storeId) => {
        describe("with ignoreStartupType=true", () => {
            it("should return true if getCleanupTypeFor returned NEVER", () => {
                const mock = mockAssimilate(ruleManager, "ruleManager", {
                    mock: ["getCleanupTypeFor"],
                    whitelist: ["isDomainProtected"],
                });
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.INSTANTLY);
                expect(ruleManager.isDomainProtected("domain.com", storeId, true)).toBe(false);
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.NEVER);
                expect(ruleManager.isDomainProtected("domain.com", storeId, true)).toBe(true);
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.LEAVE);
                expect(ruleManager.isDomainProtected("domain.com", storeId, true)).toBe(false);
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.STARTUP);
                expect(ruleManager.isDomainProtected("domain.com", storeId, true)).toBe(false);
            });
        });
        describe("with ignoreStartupType=false", () => {
            it("should return true if getCleanupTypeFor returned NEVER or STARTUP", () => {
                const mock = mockAssimilate(ruleManager, "ruleManager", {
                    mock: ["getCleanupTypeFor"],
                    whitelist: ["isDomainProtected"],
                });
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.INSTANTLY);
                expect(ruleManager.isDomainProtected("domain.com", storeId, false)).toBe(false);
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.NEVER);
                expect(ruleManager.isDomainProtected("domain.com", storeId, false)).toBe(true);
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.LEAVE);
                expect(ruleManager.isDomainProtected("domain.com", storeId, false)).toBe(false);
                mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.STARTUP);
                expect(ruleManager.isDomainProtected("domain.com", storeId, false)).toBe(true);
            });
        });
    });

    describe.each([["mock-container", false]])("isDomainInstantly with storeId=%j", (storeId) => {
        it("should return true if getCleanupTypeFor returned INSTANTLY", () => {
            const mock = mockAssimilate(ruleManager, "ruleManager", {
                mock: ["getCleanupTypeFor"],
                whitelist: ["isDomainInstantly"],
            });
            mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.INSTANTLY);
            expect(ruleManager.isDomainInstantly("domain.com", storeId)).toBe(true);
            mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.NEVER);
            expect(ruleManager.isDomainInstantly("domain.com", storeId)).toBe(false);
            mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.LEAVE);
            expect(ruleManager.isDomainInstantly("domain.com", storeId)).toBe(false);
            mock.getCleanupTypeFor.expect("domain.com", storeId, false).andReturn(CleanupType.STARTUP);
            expect(ruleManager.isDomainInstantly("domain.com", storeId)).toBe(false);
        });
    });

    describe("getChosenRulesForDomain", () => {
        const catchAllRuleStartup = { rule: "*", type: CleanupType.STARTUP };
        const catchComRuleStartup = { rule: "*.com", type: CleanupType.STARTUP };
        const catchAllRuleNever = { rule: "*", type: CleanupType.NEVER };
        const catchAllRuleLeave = { rule: "*", type: CleanupType.LEAVE };
        const catchAllRuleInstantly = { rule: "*", type: CleanupType.INSTANTLY };
        it("should return an empty array if whitelistFileSystem = true and domain is empty", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: true,
                whitelistNoTLD: false,
                rules: [catchAllRuleNever],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("", "")).toHaveLength(0);
        });
        it("should return an empty array if whitelistNoTLD = true and domain contains no dot", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: true,
                rules: [catchAllRuleNever],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("hello", "")).toHaveLength(0);
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveSameMembers([catchAllRuleNever]);
            expect(ruleManager.getChosenRulesForDomain("", "")).toHaveSameMembers([catchAllRuleNever]);
        });
        it("should return the chosen rule", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveLength(0);
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [catchAllRuleStartup],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveSameMembers([catchAllRuleStartup]);
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [catchAllRuleStartup, catchAllRuleNever],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveSameMembers([catchAllRuleNever]);
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [catchAllRuleStartup, catchAllRuleNever, catchAllRuleLeave],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveSameMembers([catchAllRuleLeave]);
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [catchAllRuleStartup, catchAllRuleNever, catchAllRuleLeave, catchAllRuleInstantly],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveSameMembers([catchAllRuleInstantly]);
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [catchAllRuleInstantly, catchAllRuleLeave, catchAllRuleNever, catchAllRuleStartup],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveSameMembers([catchAllRuleInstantly]);
        });
        it("should return multiple chosen rules", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [catchAllRuleStartup, catchComRuleStartup],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getChosenRulesForDomain("google.com", "")).toHaveSameMembers([
                catchAllRuleStartup,
                catchComRuleStartup,
            ]);
        });
    });

    // fixme: getExactRuleDefinition, getRulesForDomain

    describe("getExactCleanupType", () => {
        it("should return exact matches only", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [
                    { rule: "google.com", type: CleanupType.NEVER },
                    { rule: "www.google.com", type: CleanupType.STARTUP },
                    { rule: "mail.google.com", type: CleanupType.LEAVE },
                    { rule: "*.google.com", type: CleanupType.INSTANTLY },
                ],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getExactCleanupType("google.com")).toBe(CleanupType.NEVER);
            expect(ruleManager.getExactCleanupType("www.google.com")).toBe(CleanupType.STARTUP);
            expect(ruleManager.getExactCleanupType("mail.google.com")).toBe(CleanupType.LEAVE);
            expect(ruleManager.getExactCleanupType("*.google.com")).toBe(CleanupType.INSTANTLY);
            expect(ruleManager.getExactCleanupType("images.google.com")).toBeNull();
        });
    });

    describe("hasBlockingRule", () => {
        it("should return true if at least one blocking rule exists", () => {
            setupBasicRules();
            expect(ruleManager.hasBlockingRule()).toBe(true);
        });
        it("should return true if the fallback rule is blocking", () => {
            ruleManager["config"].fallbackRule = CleanupType.INSTANTLY;
            expect(ruleManager.hasBlockingRule()).toBe(true);
        });
        it("should return false if neither the fallback rule nor any other rule is blocking", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: basicRules.filter((rule) => rule.type !== CleanupType.INSTANTLY),
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.hasBlockingRule()).toBe(false);
        });
        it("should return false for default settings (fallback rule = leave, no rules)", () => {
            expect(ruleManager.hasBlockingRule()).toBe(false);
        });
    });

    describe("getTemporaryRules", () => {
        it("should get only temporary rules", () => {
            ruleManager.update({
                fallbackRule: CleanupType.LEAVE,
                whitelistFileSystem: false,
                whitelistNoTLD: false,
                rules: [
                    { rule: "*.net", type: CleanupType.NEVER, temporary: true },
                    { rule: "*.com", type: CleanupType.INSTANTLY, temporary: true },
                    { rule: "*.de", type: CleanupType.INSTANTLY },
                ],
                protectOpenDomains: {
                    startup: true,
                    manual: true,
                },
            });
            expect(ruleManager.getTemporaryRules().map((r) => r.definition)).toEqual([
                { rule: "*.net", type: CleanupType.NEVER, temporary: true },
                { rule: "*.com", type: CleanupType.INSTANTLY, temporary: true },
            ]);
        });
    });
});
