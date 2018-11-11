/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../../lib/settings";
import { browser, BrowsingData, History } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getValidHostname } from "../../shared";

// fixme: make this file unit-testable and add tests
export class HistoryCleaner extends Cleaner {
    public constructor() {
        super();
        browser.history.onVisited.addListener(this.onVisited.bind(this));
    }

    private onVisited({ url }: History.HistoryItem) {
        if (url && settings.get("instantly.enabled")) {
            const applyRules = settings.get("instantly.history.applyRules");
            const domain = getValidHostname(url);
            if (domain && (!applyRules || settings.isDomainBlocked(domain)))
                browser.history.deleteUrl({ url });
        }
    }

    public clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.history && settings.get(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")) {
            typeSet.history = false;
            browser.history.search({ text: "" }).then((items) => {
                const urlsToClean = this.getUrlsToClean(items, startup);
                urlsToClean.forEach((url) => browser.history.deleteUrl({ url }));
            });
        }
    }

    private getUrlsToClean(items: History.HistoryItem[], ignoreStartupType: boolean): string[] {
        return items.map((item) => item.url).filter((url) => !!url && !settings.isDomainProtected(getValidHostname(url), ignoreStartupType)) as string[];
    }
}
