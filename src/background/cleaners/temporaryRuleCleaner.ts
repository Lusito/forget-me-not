/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { Cleaner } from "./cleaner";
import { ExtensionBackgroundContext } from "../backgroundShared";

// fixme: add tests
export class TemporaryRuleCleaner extends Cleaner {
    private readonly context: ExtensionBackgroundContext;

    public constructor(context: ExtensionBackgroundContext) {
        super();
        this.context = context;
    }

    public async cleanDomainOnLeave() {
        const { settings, tabWatcher } = this.context;
        const temporaryRules = settings.getTemporaryRules();
        const rulesToRemove = temporaryRules
            .filter((rule) => !tabWatcher.containsRuleFP(rule.regex))
            .map((rule) => rule.definition.rule);
        if (rulesToRemove.length) await settings.removeRules(rulesToRemove);
    }
}
