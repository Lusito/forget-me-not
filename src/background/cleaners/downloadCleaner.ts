/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../../lib/settings";
import { browser, Downloads, BrowsingData } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getValidHostname } from "../../shared";

// fixme: make this file unit-testable and add tests
// fixme: snooze
export class DownloadCleaner extends Cleaner {
    public constructor() {
        super();
        browser.downloads.onCreated.addListener(this.onCreated.bind(this));
    }

    private onCreated({ url }: Downloads.DownloadItem) {
        if (settings.get("instantly.enabled") && settings.get("instantly.downloads")) {
            const domain = getValidHostname(url);
            if (domain) {
                const applyRules = settings.get("instantly.downloads.applyRules");
                if (!applyRules || settings.isDomainBlocked(domain)) {
                    this.cleanupUrl(url);
                } else if (!settings.isDomainProtected(domain, false) && settings.get("startup.downloads")) {
                    const downloadsToClean = { ...settings.get("downloadsToClean") };
                    downloadsToClean[url] = true;
                    settings.set("downloadsToClean", downloadsToClean);
                    settings.save();
                }
            }
        }
    }

    private cleanupUrl(url: string) {
        browser.downloads.erase({ url });
        browser.history && browser.history.deleteUrl({ url });
    }

    public clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        const applyRules = settings.get(startup ? "startup.downloads.applyRules" : "cleanAll.downloads.applyRules");
        if (typeSet.downloads && (applyRules || !typeSet.history)) {
            // Need to manually clear downloads from history before cleaning downloads, as otherwise the history entries will remain on firefox.
            // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1380445
            typeSet.downloads = false;
            browser.downloads.search({}).then((downloads) => {
                const urlsToClean = this.getUrlsToClean(downloads, startup, applyRules);
                urlsToClean.forEach(this.cleanupUrl.bind(this));
            });
        }
    }

    private getUrlsToClean(downloads: Downloads.DownloadItem[], startup: boolean, applyRules: boolean): string[] {
        const downloadsToClean = { ...settings.get("downloadsToClean") };
        downloads.forEach((d) => downloadsToClean[d.url] = true);

        let urls = Object.getOwnPropertyNames(downloadsToClean);
        if (applyRules)
            urls = urls.filter((url) => !settings.isDomainProtected(getValidHostname(url), startup));

        settings.set("downloadsToClean", {});
        settings.save();
        return urls;
    }
}
