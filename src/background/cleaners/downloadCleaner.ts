import { singleton } from "tsyringe";
import { browser, Downloads, BrowsingData } from "webextension-polyfill-ts";

import { Cleaner } from "./cleaner";
import { getValidHostname } from "../../shared/domainUtils";
import { Settings } from "../../shared/settings";
import { TabWatcher } from "../tabWatcher";
import { RuleManager } from "../../shared/ruleManager";
import { BooleanMap } from "../../shared/defaultSettings";

@singleton()
export class DownloadCleaner extends Cleaner {
    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly tabWatcher: TabWatcher
    ) {
        super();
        browser.downloads.onCreated.addListener((item) => {
            this.onCreated(item);
        });
    }

    private async onCreated({ url, incognito }: Downloads.DownloadItem) {
        const domain = getValidHostname(url);
        if (domain) {
            if (this.shouldCleanInstantly() && (await this.cleanupUrlInstantly(url, domain, incognito))) return;
            if (this.shouldCleanOnStartup(domain, incognito)) await this.addDownloadsToClean([url]);
        }
    }

    private shouldCleanOnStartup(domain: string, incognito: boolean) {
        return (
            !incognito &&
            this.settings.get("startup.enabled") &&
            this.settings.get("startup.downloads") &&
            !this.ruleManager.isDomainProtected(domain, false, false)
        );
    }

    private shouldCleanInstantly() {
        return this.settings.get("instantly.enabled") && this.settings.get("instantly.downloads");
    }

    private async cleanupUrlInstantly(url: string, domain: string, incognito: boolean) {
        if (!this.settings.get("instantly.downloads.applyRules") || this.ruleManager.isDomainInstantly(domain, false)) {
            if (incognito) await browser.downloads.erase({ url });
            else await this.cleanupUrl(url);
            return true;
        }
        return false;
    }

    private async updateDownloadsToClean(downloadsToClean: BooleanMap) {
        this.settings.set("downloadsToClean", downloadsToClean);
        await this.settings.save();
    }

    private async addDownloadsToClean(downloads: string[]) {
        const downloadsToClean = { ...this.settings.get("downloadsToClean") };
        downloads.forEach((download) => {
            downloadsToClean[download] = true;
        });

        await this.updateDownloadsToClean(downloadsToClean);
    }

    private async cleanupUrl(url: string) {
        const promises: Array<Promise<any>> = [browser.downloads.erase({ url })];
        // Firefox Android doesn't support history API yet
        if (browser.history) promises.push(browser.history.deleteUrl({ url }));
        await Promise.all(promises);
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.downloads) {
            const applyRules = this.settings.get(
                startup ? "startup.downloads.applyRules" : "cleanAll.downloads.applyRules"
            );
            if (applyRules || !typeSet.history) {
                typeSet.downloads = false;
                await this.performCleanup(startup, applyRules);
            }
        }
    }

    private async performCleanup(startup: boolean, applyRules: boolean) {
        // Need to manually clear downloads from history before cleaning downloads, as otherwise the history entries will remain on firefox.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1380445
        const downloads = await browser.downloads.search({});
        const protectOpenDomains = this.ruleManager.protectOpenDomains(startup);
        await this.addDownloadsToClean(downloads.map((download) => download.url));
        const urlsToClean = await this.getUrlsToClean(startup, protectOpenDomains, applyRules);
        await Promise.all(urlsToClean.map((url) => this.cleanupUrl(url)));
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean): boolean {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain)) return true;
        return this.ruleManager.isDomainProtected(domain, false, ignoreStartupType);
    }

    private async getUrlsToClean(startup: boolean, protectOpenDomains: boolean, applyRules: boolean) {
        const downloadsToClean = this.settings.get("downloadsToClean");
        const newDownloadsToClean: { [s: string]: boolean } = {};
        let urls = Object.keys(downloadsToClean);
        if (applyRules) {
            urls = urls.filter((url) => {
                const isProtected = this.isDomainProtected(getValidHostname(url), startup, protectOpenDomains);
                if (isProtected) newDownloadsToClean[url] = true;
                return !isProtected;
            });
        }

        await this.updateDownloadsToClean(newDownloadsToClean);
        return urls;
    }
}
