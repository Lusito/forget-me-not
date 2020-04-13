/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, BrowsingData, History } from "webextension-polyfill-ts";
import { getDomain } from "tldjs";

import { Cleaner } from "./cleaner";
import { ExtensionBackgroundContext } from "../backgroundShared";

export class HistoryCleaner extends Cleaner {
    private readonly context: ExtensionBackgroundContext;

    public constructor(context: ExtensionBackgroundContext) {
        super();
        this.context = context;
        browser.history.onVisited.addListener(this.onVisited);
    }

    private onVisited = ({ url }: History.HistoryItem) => {
        const { settings } = this.context;
        if (url && settings.get("instantly.enabled") && settings.get("instantly.history")) {
            const applyRules = settings.get("instantly.history.applyRules");
            const domain = this.context.domainUtils.getValidHostname(url);
            if (domain && (!applyRules || settings.isDomainBlocked(domain))) browser.history.deleteUrl({ url });
        }
    };

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.history) {
            const { settings } = this.context;
            if (settings.get(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")) {
                typeSet.history = false;
                const items = await browser.history.search({ text: "" });
                const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
                const urlsToClean = this.getUrlsToClean(items, startup, protectOpenDomains);
                await Promise.all(urlsToClean.map((url) => browser.history.deleteUrl({ url })));
            }
        }
    }

    // fixme: add tests
    public async cleanDomainOnLeave(storeId: string, domain: string) {
        const { settings } = this.context;
        if (settings.get("domainLeave.enabled") && settings.get("domainLeave.history")) {
            const domainFP = getDomain(domain) || domain;
            const items = await browser.history.search({ text: domainFP });
            const filteredItems = items.filter((item) => {
                if (!item.url) return false;
                const hostname = this.context.domainUtils.getValidHostname(item.url);
                return hostname === domain || getDomain(hostname) === domainFP;
            });
            const urlsToClean = this.getUrlsToClean(filteredItems, false, true);
            await Promise.all(urlsToClean.map((url) => browser.history.deleteUrl({ url })));
        }
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean) {
        if (protectOpenDomains && this.context.tabWatcher.containsDomain(domain)) return true;
        return this.context.settings.isDomainProtected(domain, ignoreStartupType);
    }

    private getUrlsToClean(items: History.HistoryItem[], ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const unprotected = (url: string | undefined) =>
            !!url &&
            !this.isDomainProtected(
                this.context.domainUtils.getValidHostname(url),
                ignoreStartupType,
                protectOpenDomains
            );
        return items.map((item) => item.url).filter(unprotected) as string[];
    }
}
