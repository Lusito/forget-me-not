/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { Cleaner } from "./cleaner";
import { TabWatcher } from "../tabWatcher";
import { settings } from "../../lib/settings";

// fixme: add tests
export class TemporaryRuleCleaner extends Cleaner {
    private readonly tabWatcher: TabWatcher;

    public constructor(tabWatcher: TabWatcher) {
        super();
        this.tabWatcher = tabWatcher;
    }

    public async cleanDomainOnLeave() {
        const temporaryRules = settings.getTemporaryRules();
        const rulesToRemove = temporaryRules
            .filter((rule) => !this.tabWatcher.containsRuleFP(rule.regex))
            .map((rule) => rule.definition.rule);
        if (rulesToRemove.length) await settings.removeRules(rulesToRemove);
    }
}
