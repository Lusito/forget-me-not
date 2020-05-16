import { container } from "tsyringe";

import { mocks } from "../../testUtils/mocks";
import { TemporaryRuleCleaner } from "./temporaryRuleCleaner";
import { CompiledRuleDefinition } from "../../shared/ruleUtils";

describe("TemporaryRuleCleaner", () => {
    let temporaryRuleCleaner: TemporaryRuleCleaner;

    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.ruleManager.mockAllow();
        mocks.supports.mockAllow();
        temporaryRuleCleaner = container.resolve(TemporaryRuleCleaner);
    });

    describe("cleanDomainOnLeave", () => {
        const regex1 = /sometest1/;
        const regex2 = /sometest2/;
        const regex3 = /sometest3/;
        const regex4 = /sometest4/;
        const regex5 = /sometest5/;
        const rules: CompiledRuleDefinition[] = [
            { regex: regex1, definition: { rule: "rule1" } } as any,
            { regex: regex2, definition: { rule: "rule2" } } as any,
            { storeId: "mock", regex: regex3, definition: { rule: "rule3" } } as any,
            { storeId: "mock2", regex: regex4, definition: { rule: "rule4" } } as any,
            { storeId: "mock", regex: regex5, definition: { rule: "rule5" } } as any,
        ];

        it("should filter by storeId and !containsRuleFP and then call settings.removeRules", async () => {
            mocks.ruleManager.getTemporaryRules.expect().andReturn(rules);
            mocks.tabWatcher.containsRuleFP.expect(regex1).andReturn(true);
            mocks.tabWatcher.containsRuleFP.expect(regex2).andReturn(false);
            mocks.tabWatcher.containsRuleFP.expect(regex3, "mock").andReturn(true);
            mocks.tabWatcher.containsRuleFP.expect(regex5, "mock").andReturn(false);
            mocks.settings.removeRules.expect(["rule2", "rule5"]).andResolve();
            await temporaryRuleCleaner.cleanDomainOnLeave("mock");
        });

        it("should not call settings.removeRules if no rule matches", async () => {
            mocks.ruleManager.getTemporaryRules.expect().andReturn(rules);
            mocks.tabWatcher.containsRuleFP.expect(regex1).andReturn(true);
            mocks.tabWatcher.containsRuleFP.expect(regex2).andReturn(true);
            mocks.tabWatcher.containsRuleFP.expect(regex3, "mock").andReturn(true);
            mocks.tabWatcher.containsRuleFP.expect(regex5, "mock").andReturn(true);
            await temporaryRuleCleaner.cleanDomainOnLeave("mock");
        });
    });
});
