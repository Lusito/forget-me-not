/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, BrowsingData } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

import { messageUtil } from "../lib/messageUtil";
import { TabWatcher, TabWatcherListener } from "./tabWatcher";
import { RecentlyAccessedDomains } from "./recentlyAccessedDomains";
import { HeaderFilter } from "./headerFilter";
import { getBadgeForCleanupType, badges } from "./backgroundHelpers";
import { NotificationHandler } from "./notificationHandler";
import { CleanupScheduler } from "./cleanupScheduler";
import { DownloadCleaner } from "./cleaners/downloadCleaner";
import { LocalStorageCleaner } from "./cleaners/localStorageCleaner";
import { CookieCleaner } from "./cleaners/cookieCleaner";
import { Cleaner } from "./cleaners/cleaner";
import { HistoryCleaner } from "./cleaners/historyCleaner";
import { IncognitoWatcher } from "./incognitoWatcher";
import { TemporaryRuleCleaner } from "./cleaners/temporaryRuleCleaner";
import { ExtensionContext } from "../lib/bootstrap";
import { ExtensionBackgroundContext } from "./backgroundShared";
import { CookieUtils } from "./cookieUtils";
import { RequestWatcher } from "./requestWatcher";

// fixme: make this file unit-testable and add tests

export class Background implements TabWatcherListener {
    private readonly cleanupScheduler: { [s: string]: CleanupScheduler } = {};

    private snoozing = false;

    private readonly cleaners: Cleaner[] = [];

    private readonly headerFilter: HeaderFilter;

    private readonly context: ExtensionBackgroundContext;

    private readonly defaultCookieStoreId: string;

    public constructor(context: ExtensionContext) {
        this.defaultCookieStoreId = context.storeUtils.defaultCookieStoreId;
        this.context = {
            ...context,
            incognitoWatcher: new IncognitoWatcher(context),
            tabWatcher: new TabWatcher(this, context),
            cookieUtils: new CookieUtils(context),
        };
        // fixme: maybe rather do it only once?
        this.context.tabWatcher.initializeExistingTabs();
        // eslint-disable-next-line no-new
        new RequestWatcher(this.context.tabWatcher, this.context);
        this.context.incognitoWatcher.initializeExistingTabs();
        // eslint-disable-next-line no-new
        new NotificationHandler(this.context);
        this.cleaners.push(new TemporaryRuleCleaner(this.context));
        browser.history && this.cleaners.push(new HistoryCleaner(this.context));
        this.cleaners.push(new DownloadCleaner(this.context));
        this.cleaners.push(new CookieCleaner(this.context));
        this.cleaners.push(new LocalStorageCleaner(this.context));

        this.updateBadge();
        this.headerFilter = new HeaderFilter(this.context);
        // eslint-disable-next-line no-new
        new RecentlyAccessedDomains(this.context);
        wetLayer.addListener(() => {
            this.updateBadge();
            this.updateBrowserAction();
        });
    }

    public async onStartup() {
        const { settings } = this.context;
        await settings.removeTemporaryRules();
        if (settings.get("startup.enabled")) await this.runCleanup(true);
    }

    public async cleanUrlNow(config: CleanUrlNowConfig) {
        await Promise.all(this.cleaners.map((cleaner) => cleaner.cleanDomain(config.cookieStoreId, config.hostname)));
    }

    public async cleanAllNow() {
        await this.runCleanup(false);
    }

    private async runCleanup(startup: boolean) {
        const { settings } = this.context;
        const typeSet: BrowsingData.DataTypeSet = {
            localStorage: settings.get(startup ? "startup.localStorage" : "cleanAll.localStorage"),
            cookies: settings.get(startup ? "startup.cookies" : "cleanAll.cookies"),
            history: settings.get(startup ? "startup.history" : "cleanAll.history"),
            downloads: settings.get(startup ? "startup.downloads" : "cleanAll.downloads"),
            formData: settings.get(startup ? "startup.formData" : "cleanAll.formData"),
            passwords: settings.get(startup ? "startup.passwords" : "cleanAll.passwords"),
            indexedDB: settings.get(startup ? "startup.indexedDB" : "cleanAll.indexedDB"),
            pluginData: settings.get(startup ? "startup.pluginData" : "cleanAll.pluginData"),
            serverBoundCertificates: settings.get(
                startup ? "startup.serverBoundCertificates" : "cleanAll.serverBoundCertificates"
            ),
            serviceWorkers: settings.get(startup ? "startup.serviceWorkers" : "cleanAll.serviceWorkers"),
            cache: settings.get(startup ? "startup.cache" : "cleanAll.cache"),
        };

        await Promise.all(this.cleaners.map((cleaner) => cleaner.clean(typeSet, startup)));
        await browser.browsingData.remove({ originTypes: { unprotectedWeb: true } }, typeSet);
    }

    private getCleanupScheduler(id?: string) {
        if (!id) id = this.defaultCookieStoreId;
        let scheduler = this.cleanupScheduler[id];
        if (!scheduler) {
            const storeId = id;
            scheduler = new CleanupScheduler(
                this.context,
                async (domain) => {
                    await Promise.all(this.cleaners.map((cleaner) => cleaner.cleanDomainOnLeave(storeId, domain)));
                },
                this.snoozing
            );
            this.cleanupScheduler[id] = scheduler;
        }
        return scheduler;
    }

    public async updateBadge() {
        const tabs = await browser.tabs.query({ active: true });
        const { settings, domainUtils } = this.context;
        for (const tab of tabs) {
            if (tab?.url && !tab.incognito) {
                let badge = badges.none;
                const hostname = domainUtils.getValidHostname(tab.url);
                if (hostname) badge = getBadgeForCleanupType(settings.getCleanupTypeForDomain(hostname));
                let text = badge.i18nBadge ? wetLayer.getMessage(badge.i18nBadge) : "";
                if (!settings.get("showBadge")) text = "";
                if (browser.browserAction.setBadgeText) browser.browserAction.setBadgeText({ text, tabId: tab.id });
                if (browser.browserAction.setBadgeBackgroundColor)
                    browser.browserAction.setBadgeBackgroundColor({ color: badge.color, tabId: tab.id });
                browser.browserAction.enable(tab.id);
            } else {
                browser.browserAction.disable(tab.id);
            }
        }
    }

    public onDomainEnter(cookieStoreId: string, hostname: string) {
        const { supports, incognitoWatcher, settings } = this.context;
        if (supports.removeLocalStorageByHostname && !incognitoWatcher.hasCookieStore(cookieStoreId)) {
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
        for (const size of [16, 32, 48, 64, 96, 128]) path[size] = `icons/icon${size}${suffix}.png`;

        browser.browserAction.setIcon?.({ path });
        browser.browserAction.setTitle({
            title: wetLayer.getMessage(this.snoozing ? "actionTitleSnooze" : "actionTitle"),
        });
    }

    public async toggleSnoozingState() {
        this.snoozing = !this.snoozing;
        for (const key of Object.keys(this.cleanupScheduler)) this.cleanupScheduler[key].setSnoozing(this.snoozing);

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
