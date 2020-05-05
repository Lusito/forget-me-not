import { singleton } from "tsyringe";

import { Cleaner } from "./cleaner";
import { Settings } from "../../shared/settings";
import { TabWatcher } from "../tabWatcher";
import { RuleManager } from "../../shared/ruleManager";

@singleton()
export class TemporaryRuleCleaner extends Cleaner {
    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly tabWatcher: TabWatcher
    ) {
        super();
    }

    public async cleanDomainOnLeave(storeId: string) {
        const temporaryRules = this.ruleManager.getTemporaryRules();
        const rulesToRemove = temporaryRules
            .filter((rule) => {
                if (!rule.storeId) return !this.tabWatcher.containsRuleFP(rule.regex);
                return rule.storeId === storeId && !this.tabWatcher.containsRuleFP(rule.regex, rule.storeId);
            })
            .map((rule) => rule.definition.rule);
        if (rulesToRemove.length) await this.settings.removeRules(rulesToRemove);
    }
}
