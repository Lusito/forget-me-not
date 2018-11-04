/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil } from "../lib/messageUtil";
import { settings } from "../lib/settings";
import DelayedExecution from "../lib/delayedExecution";
import { cleanLocalStorage, removeLocalStorageByHostname, removeCookie } from "./backgroundShared";
import { CleanStore } from "./cleanStore";
import { TabWatcher, TabWatcherListener, DEFAULT_COOKIE_STORE_ID } from "./tabWatcher";
import { RecentlyAccessedDomains } from "./recentlyAccessedDomains";
import { HeaderFilter } from "./headerFilter";
import { getValidHostname } from "../shared";
import { browser, BrowsingData, Cookies } from "webextension-polyfill-ts";
import { CleanupType } from "../lib/settingsSignature";
import { getFirstPartyCookieDomain, getBadgeForCleanupType, badges } from "./backgroundHelpers";
import { NotificationHandler } from "./notificationHandler";
import { CleanupScheduler } from "./cleanupScheduler";
import { wetLayer } from "wet-layer";

// fixme: make this file unit-testable and add tests

// Workaround for getAllCookieStores returning only active cookie stores.
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=1486274
function getAllCookieStoreIds() {
    const ids: {[s: string]: boolean} = {
        "firefox-default": true,
        "firefox-private": true
    };
    return browser.cookies.getAllCookieStores().then((cookieStores) => {
        for (const store of cookieStores)
            ids[store.id] = true;
        if (browser.contextualIdentities)
            return browser.contextualIdentities.query({});
        return [];
    }).then((contextualIdentities) => {
        for (const ci of contextualIdentities)
            ids[ci.cookieStoreId] = true;
        return Object.getOwnPropertyNames(ids);
    });
}

export class Background implements TabWatcherListener {
    private readonly cleanStores: { [s: string]: CleanStore } = {};
    private readonly cleanupScheduler: { [s: string]: CleanupScheduler } = {};
    private lastDomainChangeRequest = Date.now();
    private readonly recentlyAccessedDomains = new RecentlyAccessedDomains();
    private readonly tabWatcher = new TabWatcher(this, this.recentlyAccessedDomains);
    private snoozing = false;
    private readonly snoozedThirdpartyCookies: Cookies.Cookie[] = [];
    // @ts-ignore
    private readonly notificationHandler = new NotificationHandler();

    public constructor() {
        this.updateBadge();
        new HeaderFilter(this.tabWatcher, this.recentlyAccessedDomains);
        wetLayer.addListener(() => {
            this.updateBadge();
            this.updateBrowserAction();
        });
    }

    public onStartup() {
        if (settings.get("startup.enabled"))
            this.runCleanup(true);
    }

    public cleanUrlNow(config: CleanUrlNowConfig) {
        this.getCleanStore(config.cookieStoreId).cleanDomainNow(config.hostname);
    }

    public cleanAllNow() {
        this.runCleanup(false);
    }

    private runCleanup(startup: boolean) {
        const typeSet: BrowsingData.DataTypeSet = {
            history: settings.get(startup ? "startup.history" : "cleanAll.history"),
            downloads: settings.get(startup ? "startup.downloads" : "cleanAll.downloads"),
            formData: settings.get(startup ? "startup.formData" : "cleanAll.formData"),
            passwords: settings.get(startup ? "startup.passwords" : "cleanAll.passwords"),
            indexedDB: settings.get(startup ? "startup.indexedDB" : "cleanAll.indexedDB"),
            pluginData: settings.get(startup ? "startup.pluginData" : "cleanAll.pluginData"),
            serverBoundCertificates: settings.get(startup ? "startup.serverBoundCertificates" : "cleanAll.serverBoundCertificates"),
            serviceWorkers: settings.get(startup ? "startup.serviceWorkers" : "cleanAll.serviceWorkers")
        };
        const options: BrowsingData.RemovalOptions = {
            originTypes: { unprotectedWeb: true }
        };

        if (typeSet.downloads && !typeSet.history) {
            // Need to manually clear downloads from history before cleaning downloads, as otherwise the history entries will remain on firefox.
            // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1380445
            typeSet.downloads = false;
            browser.downloads.search({}).then((downloads) => {
                downloads.forEach((download) => browser.history.deleteUrl({ url: download.url }));
                browser.browsingData.remove(options, { downloads: true });
            });
        }

        const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
        if (settings.get(startup ? "startup.cookies" : "cleanAll.cookies")) {
            if (settings.get(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules"))
                this.cleanCookiesWithRulesNow(startup, protectOpenDomains);
            else
                typeSet.cookies = true;
        }
        if (settings.get(startup ? "startup.localStorage" : "cleanAll.localStorage")) {
            if (settings.get(startup ? "startup.localStorage.applyRules" : "cleanAll.localStorage.applyRules")) {
                getAllCookieStoreIds().then((ids) => {
                    const hostnames = this.getDomainsToClean(startup, protectOpenDomains);
                    for (const id of ids)
                        cleanLocalStorage(hostnames, id);
                });
            } else {
                typeSet.localStorage = true;
                settings.set("domainsToClean", {});
                settings.save();
            }
        }
        browser.browsingData.remove(options, typeSet);
    }

    private getDomainsToClean(ignoreStartupType: boolean, protectOpenDomains: boolean): string[] {
        const domainsToClean = settings.get("domainsToClean");
        const result = [];
        for (const domain in domainsToClean) {
            if (domainsToClean.hasOwnProperty(domain) && !this.isDomainProtected(domain, ignoreStartupType, protectOpenDomains))
                result.push(domain);
        }
        return result;
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean): boolean {
        if (protectOpenDomains) {
            for (const key in this.cleanStores) {
                if (this.tabWatcher.cookieStoreContainsDomain(key, domain))
                    return true;
            }
        }
        const type = settings.getCleanupTypeForDomain(domain);
        return type === CleanupType.NEVER || (type === CleanupType.STARTUP && !ignoreStartupType);
    }

    private runIfCookieStoreNotIncognito(storeId: string, callback: () => void) {
        if (storeId.indexOf("private") >= 0)
            return;
        if (storeId.indexOf("firefox") >= 0)
            callback();
        else {
            browser.cookies.getAllCookieStores().then((cookieStores) => {
                for (const store of cookieStores) {
                    if (store.id === storeId) {
                        if (store.tabIds.length) {
                            browser.tabs.get(store.tabIds[0]).then((tab) => {
                                if (!tab.incognito)
                                    callback();
                            });
                        }
                        return;
                    }
                }
            });
        }
    }

    public onCookieChanged(changeInfo: Cookies.OnChangedChangeInfoType) {
        if (!changeInfo.removed) {
            this.runIfCookieStoreNotIncognito(changeInfo.cookie.storeId, () => {
                this.recentlyAccessedDomains.add(changeInfo.cookie.domain);
                // Cookies set by javascript can't be denied, but can be removed instantly.
                const allowSubDomains = changeInfo.cookie.domain.startsWith(".");
                const rawDomain = allowSubDomains ? changeInfo.cookie.domain.substr(1) : changeInfo.cookie.domain;
                if (settings.getCleanupTypeForCookie(rawDomain, changeInfo.cookie.name) === CleanupType.INSTANTLY)
                    removeCookie(changeInfo.cookie);
                else if (settings.get("cleanThirdPartyCookies.enabled"))
                    this.removeCookieIfThirdparty(changeInfo.cookie);
            });
        }
    }

    public removeCookieIfThirdparty(cookie: Cookies.Cookie) {
        if (this.isThirdpartyCookie(cookie)) {
            if (this.snoozing) {
                this.snoozedThirdpartyCookies.push(cookie);
                return;
            }
            const exec = new DelayedExecution(() => {
                if (this.snoozing) {
                    this.snoozedThirdpartyCookies.push(cookie);
                    return;
                }
                const delta = Date.now() - this.lastDomainChangeRequest;
                if (delta < 1000)
                    exec.restart(500);
                else if (this.isThirdpartyCookie(cookie))
                    removeCookie(cookie);
            });
            exec.restart(settings.get("cleanThirdPartyCookies.delay") * 60 * 1000);
        }
    }

    private isThirdpartyCookie(cookie: Cookies.Cookie) {
        const firstPartyDomain = getFirstPartyCookieDomain(cookie.domain);
        if (cookie.firstPartyDomain)
            return cookie.firstPartyDomain !== firstPartyDomain;
        return !this.tabWatcher.isFirstPartyDomainOnCookieStore(cookie.storeId, firstPartyDomain);
    }

    private cleanCookiesWithRulesNow(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        getAllCookieStoreIds().then((ids) => {
            for (const id of ids)
                this.getCleanStore(id).cleanCookiesWithRules(ignoreStartupType, protectOpenDomains);
        });
    }

    private getCleanStore(id?: string): CleanStore {
        if (!id)
            id = DEFAULT_COOKIE_STORE_ID;
        let store = this.cleanStores[id];
        if (!store)
            store = this.cleanStores[id] = new CleanStore(id, this.tabWatcher);
        return store;
    }

    private getCleanupScheduler(id?: string): CleanupScheduler {
        if (!id)
            id = DEFAULT_COOKIE_STORE_ID;
        let scheduler = this.cleanupScheduler[id];
        if (!scheduler) {
            const store = this.getCleanStore(id);
            scheduler = this.cleanupScheduler[id] = new CleanupScheduler(store.cleanByDomainWithRules.bind(store), this.snoozing);
        }
        return scheduler;
    }

    public updateBadge() {
        browser.tabs.query({ active: true }).then((tabs) => {
            for (const tab of tabs) {
                if (tab && tab.url && !tab.incognito) {
                    let badge = badges.none;
                    const hostname = getValidHostname(tab.url);
                    if (hostname)
                        badge = getBadgeForCleanupType(settings.getCleanupTypeForDomain(hostname));
                    let text = badge.i18nBadge ? wetLayer.getMessage(badge.i18nBadge) : "";
                    if (!settings.get("showBadge"))
                        text = "";
                    browser.browserAction.setBadgeText({ text, tabId: tab.id });
                    browser.browserAction.setBadgeBackgroundColor({ color: badge.color, tabId: tab.id });
                    browser.browserAction.enable(tab.id);
                } else {
                    browser.browserAction.disable(tab.id);
                }
            }
        });
    }

    public onDomainEnter(cookieStoreId: string, hostname: string): void {
        if (removeLocalStorageByHostname) {
            const domainsToClean = { ...settings.get("domainsToClean") };
            domainsToClean[hostname] = true;
            settings.set("domainsToClean", domainsToClean);
            settings.save();
        }
    }

    public onDomainLeave(cookieStoreId: string, hostname: string): void {
        this.getCleanupScheduler(cookieStoreId).schedule(hostname);
    }

    private updateBrowserAction() {
        const path: { [s: string]: string } = {};
        const suffix = this.snoozing ? "z" : "";
        for (const size of [16, 32, 48, 64, 96, 128])
            path[size] = `icons/icon${size}${suffix}.png`;

        browser.browserAction.setIcon({ path });
        browser.browserAction.setTitle({
            title: wetLayer.getMessage(this.snoozing ? "actionTitleSnooze" : "actionTitle")
        });
    }

    public toggleSnoozingState() {
        this.snoozing = !this.snoozing;
        for (const key in this.cleanupScheduler)
            this.cleanupScheduler[key].setSnoozing(this.snoozing);

        if (!this.snoozing) {
            for (const cookie of this.snoozedThirdpartyCookies)
                this.removeCookieIfThirdparty(cookie);
            this.snoozedThirdpartyCookies.length = 0;
        }

        this.updateBrowserAction();
        this.sendSnoozingState();
    }

    public sendSnoozingState() {
        messageUtil.send("onSnoozingState", this.snoozing);
    }
}

export interface CleanUrlNowConfig {
    hostname: string;
    cookieStoreId: string;
}
