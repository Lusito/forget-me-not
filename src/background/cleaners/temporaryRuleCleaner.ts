/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData } from "webextension-polyfill-ts";
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

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        // done in background.ts
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        const temporaryRules = settings.getTemporaryRules();
        const rulesToRemove = temporaryRules.filter((rule) => !this.tabWatcher.containsRuleFP(rule.regex)).map((rule) => rule.definition.rule);
        if (rulesToRemove.length)
            await settings.removeRules(rulesToRemove);
    }
}
