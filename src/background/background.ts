/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil } from "../lib/messageUtil";
import { settings } from "../lib/settings";
import { removeLocalStorageByHostname } from "./backgroundShared";
import { TabWatcher, TabWatcherListener } from "./tabWatcher";
import { RecentlyAccessedDomains } from "./recentlyAccessedDomains";
import { HeaderFilter } from "./headerFilter";
import { getValidHostname, DEFAULT_COOKIE_STORE_ID } from "../shared";
import { browser, BrowsingData } from "webextension-polyfill-ts";
import { getBadgeForCleanupType, badges } from "./backgroundHelpers";
import { NotificationHandler } from "./notificationHandler";
import { CleanupScheduler } from "./cleanupScheduler";
import { wetLayer } from "wet-layer";
import { DownloadCleaner } from "./cleaners/downloadCleaner";
import { LocalStorageCleaner } from "./cleaners/localStorageCleaner";
import { CookieCleaner } from "./cleaners/cookieCleaner";
import { Cleaner } from "./cleaners/cleaner";
import { HistoryCleaner } from "./cleaners/historyCleaner";
import { IncognitoWatcher } from "./incognitoWatcher";
import { TemporaryRuleCleaner } from "./cleaners/temporaryRuleCleaner";

// fixme: make this file unit-testable and add tests

export class Background implements TabWatcherListener {
    private readonly cleanupScheduler: { [s: string]: CleanupScheduler } = {};
    private readonly incognitoWatcher = new IncognitoWatcher();
    private readonly tabWatcher = new TabWatcher(this);
    private snoozing = false;
    // @ts-ignore
    private readonly notificationHandler = new NotificationHandler();
    private readonly cleaners: Cleaner[] = [];
    private readonly headerFilter: HeaderFilter;

    public constructor() {
        this.cleaners.push(new TemporaryRuleCleaner(this.tabWatcher));
        browser.history && this.cleaners.push(new HistoryCleaner(this.tabWatcher));
        this.cleaners.push(new DownloadCleaner(this.tabWatcher));
        this.cleaners.push(new CookieCleaner(this.tabWatcher, this.incognitoWatcher));
        this.cleaners.push(new LocalStorageCleaner(this.tabWatcher));

        this.updateBadge();
        this.headerFilter = new HeaderFilter(this.tabWatcher, this.incognitoWatcher);
        new RecentlyAccessedDomains(this.incognitoWatcher);
        wetLayer.addListener(() => {
            this.updateBadge();
            this.updateBrowserAction();
        });
    }

    public async onStartup() {
        await settings.removeTemporaryRules();
        if (settings.get("startup.enabled"))
            await this.runCleanup(true);
    }

    public async cleanUrlNow(config: CleanUrlNowConfig) {
        await Promise.all(this.cleaners.map((cleaner) => cleaner.cleanDomain(config.cookieStoreId, config.hostname)));
    }

    public async cleanAllNow() {
        await this.runCleanup(false);
    }

    private async runCleanup(startup: boolean) {
        const typeSet: BrowsingData.DataTypeSet = {
            localStorage: settings.get(startup ? "startup.localStorage" : "cleanAll.localStorage"),
            cookies: settings.get(startup ? "startup.cookies" : "cleanAll.cookies"),
            history: settings.get(startup ? "startup.history" : "cleanAll.history"),
            downloads: settings.get(startup ? "startup.downloads" : "cleanAll.downloads"),
            formData: settings.get(startup ? "startup.formData" : "cleanAll.formData"),
            passwords: settings.get(startup ? "startup.passwords" : "cleanAll.passwords"),
            indexedDB: settings.get(startup ? "startup.indexedDB" : "cleanAll.indexedDB"),
            pluginData: settings.get(startup ? "startup.pluginData" : "cleanAll.pluginData"),
            serverBoundCertificates: settings.get(startup ? "startup.serverBoundCertificates" : "cleanAll.serverBoundCertificates"),
            serviceWorkers: settings.get(startup ? "startup.serviceWorkers" : "cleanAll.serviceWorkers"),
            cache: settings.get(startup ? "startup.cache" : "cleanAll.cache")
        };

        await Promise.all(this.cleaners.map((cleaner) => cleaner.clean(typeSet, startup)));
        await browser.browsingData.remove({ originTypes: { unprotectedWeb: true } }, typeSet);
    }

    private getCleanupScheduler(id?: string) {
        if (!id)
            id = DEFAULT_COOKIE_STORE_ID;
        let scheduler = this.cleanupScheduler[id];
        if (!scheduler) {
            const storeId = id;
            scheduler = this.cleanupScheduler[id] = new CleanupScheduler(async (domain) => {
                await Promise.all(this.cleaners.map((cleaner) => cleaner.cleanDomainOnLeave(storeId, domain)));
            }, this.snoozing);
        }
        return scheduler;
    }

    public async updateBadge() {
        const tabs = await browser.tabs.query({ active: true });
        for (const tab of tabs) {
            if (tab && tab.url && !tab.incognito) {
                let badge = badges.none;
                const hostname = getValidHostname(tab.url);
                if (hostname)
                    badge = getBadgeForCleanupType(settings.getCleanupTypeForDomain(hostname));
                let text = badge.i18nBadge ? wetLayer.getMessage(badge.i18nBadge) : "";
                if (!settings.get("showBadge"))
                    text = "";
                if (browser.browserAction.setBadgeText)
                    browser.browserAction.setBadgeText({ text, tabId: tab.id });
                if (browser.browserAction.setBadgeBackgroundColor)
                    browser.browserAction.setBadgeBackgroundColor({ color: badge.color, tabId: tab.id });
                browser.browserAction.enable(tab.id);
            } else {
                browser.browserAction.disable(tab.id);
            }
        }
    }

    public onDomainEnter(cookieStoreId: string, hostname: string) {
        if (removeLocalStorageByHostname && !this.incognitoWatcher.hasCookieStore(cookieStoreId)) {
            const domainsToClean = { ...settings.get("domainsToClean") };
            domainsToClean[hostname] = true;
            settings.set("domainsToClean", domainsToClean);
            settings.save();
        }
    }

    public onDomainLeave(cookieStoreId: string, hostname: string) {
        this.getCleanupScheduler(cookieStoreId).schedule(hostname);
    }

    private updateBrowserAction() {
        const path: { [s: string]: string } = {};
        const suffix = this.snoozing ? "z" : "";
        for (const size of [16, 32, 48, 64, 96, 128])
            path[size] = `icons/icon${size}${suffix}.png`;

        if (browser.browserAction.setIcon)
            browser.browserAction.setIcon({ path });
        browser.browserAction.setTitle({
            title: wetLayer.getMessage(this.snoozing ? "actionTitleSnooze" : "actionTitle")
        });
    }

    public async toggleSnoozingState() {
        this.snoozing = !this.snoozing;
        for (const key in this.cleanupScheduler)
            this.cleanupScheduler[key].setSnoozing(this.snoozing);

        const promise = Promise.all(this.cleaners.map((cleaner) => cleaner.setSnoozing(this.snoozing)));

        this.headerFilter.setSnoozing(this.snoozing);

        this.updateBrowserAction();
        this.sendSnoozingState();
        await promise;
    }

    public sendSnoozingState() {
        messageUtil.send("onSnoozingState", this.snoozing);
    }
}

export interface CleanUrlNowConfig {
    hostname: string;
    cookieStoreId: string;
}
