import { singleton } from "tsyringe";
import { browser, Downloads, BrowsingData } from "webextension-polyfill-ts";

import { Cleaner } from "./cleaner";
import { getValidHostname } from "../../shared/domainUtils";
import { Settings } from "../../shared/settings";
import { TabWatcher } from "../tabWatcher";
import { RuleManager } from "../../shared/ruleManager";

@singleton()
export class DownloadCleaner extends Cleaner {
    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly tabWatcher: TabWatcher
    ) {
        super();
        browser.downloads.onCreated.addListener(this.onCreated);
    }

    private onCreated = ({ url, incognito }: Downloads.DownloadItem) => {
        const domain = getValidHostname(url);
        if (domain) {
            if (this.settings.get("instantly.enabled") && this.settings.get("instantly.downloads")) {
                const applyRules = this.settings.get("instantly.downloads.applyRules");
                if (!applyRules || this.ruleManager.isDomainInstantly(domain, false)) {
                    this.cleanupUrl(url);
                    return;
                }
            }
            if (
                !incognito &&
                this.settings.get("startup.enabled") &&
                this.settings.get("startup.downloads") &&
                !this.ruleManager.isDomainProtected(domain, false, false)
            ) {
                const downloadsToClean = { ...this.settings.get("downloadsToClean") };
                downloadsToClean[url] = true;
                this.settings.set("downloadsToClean", downloadsToClean);
                this.settings.save();
            }
        }
    };

    private async cleanupUrl(url: string) {
        const promises: Array<Promise<any>> = [browser.downloads.erase({ url })];
        // Firefox Android doesn't support history API yet
        if (browser.history) promises.push(browser.history.deleteUrl({ url }));
        await Promise.all(promises);
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        const applyRules = this.settings.get(
            startup ? "startup.downloads.applyRules" : "cleanAll.downloads.applyRules"
        );
        if (typeSet.downloads && (applyRules || !typeSet.history)) {
            // Need to manually clear downloads from history before cleaning downloads, as otherwise the history entries will remain on firefox.
            // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1380445
            typeSet.downloads = false;
            const downloads = await browser.downloads.search({});
            const protectOpenDomains = startup || this.settings.get("cleanAll.protectOpenDomains");
            const urlsToClean = this.getUrlsToClean(downloads, startup, protectOpenDomains, applyRules);
            await Promise.all(urlsToClean.map((url) => this.cleanupUrl(url)));
        }
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean): boolean {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain)) return true;
        return this.ruleManager.isDomainProtected(domain, false, ignoreStartupType);
    }

    private getUrlsToClean(
        downloads: Downloads.DownloadItem[],
        startup: boolean,
        protectOpenDomains: boolean,
        applyRules: boolean
    ) {
        const downloadsToClean = { ...this.settings.get("downloadsToClean") };
        downloads.forEach((d) => {
            downloadsToClean[d.url] = true;
        });

        const newDownloadsToClean: { [s: string]: boolean } = {};
        let urls = Object.keys(downloadsToClean);
        if (applyRules) {
            urls = urls.filter((url) => {
                const isProtected = this.isDomainProtected(getValidHostname(url), startup, protectOpenDomains);
                if (isProtected) newDownloadsToClean[url] = true;
                return !isProtected;
            });
        }

        this.settings.set("downloadsToClean", newDownloadsToClean);
        this.settings.save();
        return urls;
    }
}
