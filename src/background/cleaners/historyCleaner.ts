/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../../lib/settings";
import { browser, BrowsingData, History } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getValidHostname } from "../../shared";
import { getDomain } from "tldjs";
import { TabWatcher } from "../tabWatcher";

export class HistoryCleaner extends Cleaner {
    private readonly tabWatcher: TabWatcher;

    public constructor(tabWatcher: TabWatcher) {
        super();
        this.tabWatcher = tabWatcher;
        browser.history.onVisited.addListener(this.onVisited);
    }

    private onVisited = ({ url }: History.HistoryItem) => {
        if (url && settings.get("instantly.enabled") && settings.get("instantly.history")) {
            const applyRules = settings.get("instantly.history.applyRules");
            const domain = getValidHostname(url);
            if (domain && (!applyRules || settings.isDomainBlocked(domain)))
                browser.history.deleteUrl({ url });
        }
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.history && settings.get(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")) {
            typeSet.history = false;
            const items = await browser.history.search({ text: "" });
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            const urlsToClean = this.getUrlsToClean(items, startup, protectOpenDomains);
            await Promise.all(urlsToClean.map((url) => browser.history.deleteUrl({ url })));
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        if (settings.get("domainLeave.enabled") && settings.get("domainLeave.history")) {
            const domainFP = getDomain(domain) || domain;
            const items = await browser.history.search({ text: domainFP });
            const filteredItems = items.filter((item) => {
                if (!item.url) return false;
                const hostname = getValidHostname(item.url);
                return hostname === domain || getDomain(hostname) === domainFP;
            });
            const urlsToClean = this.getUrlsToClean(filteredItems, false, true);
            await Promise.all(urlsToClean.map((url) => browser.history.deleteUrl({ url })));
        }
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean) {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain))
            return true;
        return settings.isDomainProtected(domain, ignoreStartupType);
    }

    private getUrlsToClean(items: History.HistoryItem[], ignoreStartupType: boolean, protectOpenDomains: boolean) {
        return items.map((item) => item.url).filter((url) => !!url && !this.isDomainProtected(getValidHostname(url), ignoreStartupType, protectOpenDomains)) as string[]; // fixme
    }
}
