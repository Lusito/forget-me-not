/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { singleton } from "tsyringe";

import { Cleaner } from "./cleaner";
import { Settings } from "../../shared/settings";
import { TabWatcher } from "../tabWatcher";

// fixme: add tests
@singleton()
export class TemporaryRuleCleaner extends Cleaner {
    public constructor(private readonly settings: Settings, private readonly tabWatcher: TabWatcher) {
        super();
    }

    public async cleanDomainOnLeave() {
        const temporaryRules = this.settings.getTemporaryRules();
        const rulesToRemove = temporaryRules
            .filter((rule) => !this.tabWatcher.containsRuleFP(rule.regex))
            .map((rule) => rule.definition.rule);
        if (rulesToRemove.length) await this.settings.removeRules(rulesToRemove);
    }
}
