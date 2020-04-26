/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { singleton } from "tsyringe";
import { browser, BrowsingData, History } from "webextension-polyfill-ts";
import { getDomain } from "tldjs";

import { Cleaner } from "./cleaner";
import { Settings } from "../../shared/settings";
import { DomainUtils } from "../../shared/domainUtils";
import { TabWatcher } from "../tabWatcher";

@singleton()
export class HistoryCleaner extends Cleaner {
    public constructor(
        private readonly settings: Settings,
        private readonly domainUtils: DomainUtils,
        private readonly tabWatcher: TabWatcher
    ) {
        super();
        browser.history?.onVisited.addListener(this.onVisited);
    }

    private onVisited = ({ url }: History.HistoryItem) => {
        if (url && this.settings.get("instantly.enabled") && this.settings.get("instantly.history")) {
            const domain = this.domainUtils.getValidHostname(url);
            if (domain && (!this.settings.get("instantly.history.applyRules") || this.settings.isDomainBlocked(domain)))
                browser.history.deleteUrl({ url });
        }
    };

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.history) {
            if (this.settings.get(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")) {
                typeSet.history = false;
                const items = await browser.history.search({ text: "" });
                if (!items.length) return;

                const protectOpenDomains = startup || this.settings.get("cleanAll.protectOpenDomains");
                const urlsToClean = this.getUrlsToClean(items, startup, protectOpenDomains);
                await Promise.all(urlsToClean.map((url) => browser.history.deleteUrl({ url })));
            }
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        if (this.settings.get("domainLeave.enabled") && this.settings.get("domainLeave.history")) {
            const domainFP = getDomain(domain) || domain;
            const items = await browser.history.search({ text: domainFP });
            const filteredItems = items.filter((item) => {
                if (!item.url) return false;
                const hostname = this.domainUtils.getValidHostname(item.url);
                return hostname === domain || getDomain(hostname) === domainFP;
            });
            const urlsToClean = this.getUrlsToClean(filteredItems, false, true);
            await Promise.all(urlsToClean.map((url) => browser.history.deleteUrl({ url })));
        }
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean) {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain)) return true;
        return this.settings.isDomainProtected(domain, ignoreStartupType);
    }

    private getUrlsToClean(items: History.HistoryItem[], ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const unprotected = (url: string | undefined) =>
            !!url &&
            !this.isDomainProtected(this.domainUtils.getValidHostname(url), ignoreStartupType, protectOpenDomains);
        return items.map((item) => item.url).filter(unprotected) as string[];
    }
}
