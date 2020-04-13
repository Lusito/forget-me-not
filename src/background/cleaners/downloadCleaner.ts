/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../../lib/settings";
import { browser, Downloads, BrowsingData } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getValidHostname } from "../../shared";
import { TabWatcher } from "../tabWatcher";

export class DownloadCleaner extends Cleaner {
    private readonly tabWatcher: TabWatcher;

    public constructor(tabWatcher: TabWatcher) {
        super();
        this.tabWatcher = tabWatcher;
        browser.downloads.onCreated.addListener(this.onCreated);
    }

    private onCreated = ({ url, incognito }: Downloads.DownloadItem) => {
        const domain = getValidHostname(url);
        if (domain) {
            if (settings.get("instantly.enabled") && settings.get("instantly.downloads")) {
                const applyRules = settings.get("instantly.downloads.applyRules");
                if (!applyRules || settings.isDomainBlocked(domain)) {
                    this.cleanupUrl(url);
                    return;
                }
            }
            if (!incognito && settings.get("startup.enabled") && settings.get("startup.downloads") && !settings.isDomainProtected(domain, false)) {
                const downloadsToClean = { ...settings.get("downloadsToClean") };
                downloadsToClean[url] = true;
                settings.set("downloadsToClean", downloadsToClean);
                settings.save();
            }
        }
    }

    private async cleanupUrl(url: string) {
        const promises: Promise<any>[] = [browser.downloads.erase({ url })];
        // Firefox Android doesn't support history API yet
        if (browser.history)
            promises.push(browser.history.deleteUrl({ url }));
        await Promise.all(promises);
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        const applyRules = settings.get(startup ? "startup.downloads.applyRules" : "cleanAll.downloads.applyRules");
        if (typeSet.downloads && (applyRules || !typeSet.history)) {
            // Need to manually clear downloads from history before cleaning downloads, as otherwise the history entries will remain on firefox.
            // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1380445
            typeSet.downloads = false;
            const downloads = await browser.downloads.search({});
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            const urlsToClean = this.getUrlsToClean(downloads, startup, protectOpenDomains, applyRules);
            await Promise.all(urlsToClean.map((url) => this.cleanupUrl(url)));
        }
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean) {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain))
            return true;
        return settings.isDomainProtected(domain, ignoreStartupType);
    }

    private getUrlsToClean(downloads: Downloads.DownloadItem[], startup: boolean, protectOpenDomains: boolean, applyRules: boolean) {
        const downloadsToClean = { ...settings.get("downloadsToClean") };
        downloads.forEach((d) => downloadsToClean[d.url] = true);

        const newDownloadsToClean: { [s: string]: boolean } = {};
        let urls = Object.getOwnPropertyNames(downloadsToClean);
        if (applyRules) {
            urls = urls.filter((url) => {
                const isProtected = this.isDomainProtected(getValidHostname(url), startup, protectOpenDomains);
                if (isProtected)
                    newDownloadsToClean[url] = true;
                return !isProtected;
            });
        }

        settings.set("downloadsToClean", newDownloadsToClean);
        settings.save();
        return urls;
    }
}
