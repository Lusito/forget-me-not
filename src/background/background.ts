/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil } from "../lib/messageUtil";
import { settings } from "../lib/settings";
import DelayedExecution from "../lib/delayedExecution";
import { removeCookie, cleanLocalStorage, removeLocalStorageByHostname } from "./backgroundShared";
import { CleanStore } from "./cleanStore";
import { TabWatcher, TabWatcherListener, DEFAULT_COOKIE_STORE_ID } from "./tabWatcher";
import { RecentlyAccessedDomains } from "./recentlyAccessedDomains";
import { HeaderFilter } from "./headerFilter";
import { getValidHostname } from "../shared";
import { browser, BrowsingData, Cookies } from "webextension-polyfill-ts";
import { RuleType } from "../lib/settingsSignature";
import { getFirstPartyCookieDomain, getBadgeForRuleType, badges } from "./backgroundHelpers";

// fixme: make this file unit-testable and add tests

export class Background implements TabWatcherListener {
    private readonly cleanStores: { [s: string]: CleanStore } = {};
    private lastDomainChangeRequest = Date.now();
    private readonly recentlyAccessedDomains = new RecentlyAccessedDomains();
    private readonly tabWatcher = new TabWatcher(this, this.recentlyAccessedDomains);
    private snoozing = false;
    private readonly snoozedThirdpartyCookies: Cookies.Cookie[] = [];

    public constructor() {
        this.updateBadge();
        new HeaderFilter(this.tabWatcher, this.recentlyAccessedDomains);
    }

    public onStartup() {
        if (settings.get('startup.enabled'))
            this.runCleanup(true);
    }

    public cleanUrlNow(config: CleanUrlNowConfig) {
        this.getCleanStore(config.cookieStoreId).cleanUrlNow(config.hostname);
    }

    public cleanAllNow() {
        this.runCleanup(false);
    }

    private runCleanup(startup: boolean) {
        const typeSet: BrowsingData.DataTypeSet = {
            history: settings.get(startup ? 'startup.history' : 'cleanAll.history'),
            downloads: settings.get(startup ? 'startup.downloads' : 'cleanAll.downloads'),
            formData: settings.get(startup ? 'startup.formData' : 'cleanAll.formData'),
            passwords: settings.get(startup ? 'startup.passwords' : 'cleanAll.passwords'),
            indexedDB: settings.get(startup ? 'startup.indexedDB' : 'cleanAll.indexedDB'),
            pluginData: settings.get(startup ? 'startup.pluginData' : 'cleanAll.pluginData'),
            serverBoundCertificates: settings.get(startup ? 'startup.serverBoundCertificates' : 'cleanAll.serverBoundCertificates'),
            serviceWorkers: settings.get(startup ? 'startup.serviceWorkers' : 'cleanAll.serviceWorkers')
        };
        const options: BrowsingData.RemovalOptions = {
            originTypes: { unprotectedWeb: true }
        };
        const protectOpenDomains = startup || settings.get('cleanAll.protectOpenDomains');
        if (settings.get(startup ? 'startup.cookies' : 'cleanAll.cookies')) {
            if (settings.get(startup ? 'startup.cookies.applyRules' : 'cleanAll.cookies.applyRules'))
                this.cleanCookiesWithRulesNow(startup, protectOpenDomains);
            else
                typeSet.cookies = true;
        }
        if (settings.get(startup ? 'startup.localStorage' : 'cleanAll.localStorage')) {
            if (settings.get(startup ? 'startup.localStorage.applyRules' : 'cleanAll.localStorage.applyRules')) {
                browser.cookies.getAllCookieStores().then((cookieStores) => {
                    const hostnames = this.getDomainsToClean(startup, protectOpenDomains);
                    for (const store of cookieStores)
                        cleanLocalStorage(hostnames, store.id);
                });
            } else {
                typeSet.localStorage = true;
                settings.set('domainsToClean', {});
                settings.save();
            }
        }
        browser.browsingData.remove(options, typeSet);
    }

    private getDomainsToClean(ignoreGrayList: boolean, protectOpenDomains: boolean): string[] {
        const domainsToClean = settings.get('domainsToClean');
        const result = [];
        for (const domain in domainsToClean) {
            if (domainsToClean.hasOwnProperty(domain) && !this.isDomainProtected(domain, ignoreGrayList, protectOpenDomains))
                result.push(domain);
        }
        return result;
    }

    private isDomainProtected(domain: string, ignoreGrayList: boolean, protectOpenDomains: boolean): boolean {
        if (protectOpenDomains) {
            for (const key in this.cleanStores) {
                if (this.tabWatcher.cookieStoreContainsDomain(key, domain))
                    return true;
            }
        }
        const type = settings.getRuleTypeForDomain(domain);
        return type === RuleType.WHITE || (type === RuleType.GRAY && !ignoreGrayList);
    }

    private runIfCookieStoreNotIncognito(storeId: string, callback: () => void) {
        if (storeId.indexOf('private') >= 0)
            return;
        if (storeId.indexOf('firefox') >= 0)
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
                const allowSubDomains = changeInfo.cookie.domain.startsWith('.');
                const rawDomain = allowSubDomains ? changeInfo.cookie.domain.substr(1) : changeInfo.cookie.domain;
                if (settings.getRuleTypeForCookie(rawDomain, changeInfo.cookie.name) === RuleType.BLOCK)
                    removeCookie(changeInfo.cookie);
                else if (settings.get('cleanThirdPartyCookies.enabled'))
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
            exec.restart(settings.get('cleanThirdPartyCookies.delay') * 60 * 1000);
        }
    }

    private isThirdpartyCookie(cookie: Cookies.Cookie) {
        const firstPartyDomain = getFirstPartyCookieDomain(cookie.domain);
        if (cookie.firstPartyDomain)
            return cookie.firstPartyDomain !== firstPartyDomain;
        return !this.tabWatcher.isFirstPartyDomainOnCookieStore(cookie.storeId, firstPartyDomain);
    }

    private cleanCookiesWithRulesNow(ignoreGrayList: boolean, protectOpenDomains: boolean) {
        browser.cookies.getAllCookieStores().then((stores) => {
            for (const store of stores)
                this.getCleanStore(store.id).cleanCookiesWithRulesNow(ignoreGrayList, protectOpenDomains);
        });
    }

    private getCleanStore(id?: string): CleanStore {
        if (!id)
            id = DEFAULT_COOKIE_STORE_ID;
        let store = this.cleanStores[id];
        if (!store)
            store = this.cleanStores[id] = new CleanStore(id, this.tabWatcher, this.snoozing);
        return store;
    }

    public updateBadge() {
        browser.tabs.query({ active: true }).then((tabs) => {
            for (const tab of tabs) {
                if (tab && tab.url && !tab.incognito) {
                    let badge = badges.none;
                    const hostname = getValidHostname(tab.url);
                    if (hostname)
                        badge = getBadgeForRuleType(settings.getRuleTypeForDomain(hostname));
                    let text = badge.i18nKey ? browser.i18n.getMessage(badge.i18nKey) : "";
                    if (!settings.get('showBadge'))
                        text = '';
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
            const domainsToClean = { ...settings.get('domainsToClean') };
            domainsToClean[hostname] = true;
            settings.set('domainsToClean', domainsToClean);
            settings.save();
        }
    }

    public onDomainLeave(cookieStoreId: string, hostname: string): void {
        this.getCleanStore(cookieStoreId).onDomainLeave(hostname);
    }

    private updateBrowserAction() {
        const path: { [s: string]: string } = {};
        const suffix = this.snoozing ? 'z' : '';
        for (const size of [16, 32, 48, 64, 96, 128])
            path[size] = `icons/icon${size}${suffix}.png`;

        browser.browserAction.setIcon({ path });
        browser.browserAction.setTitle({
            title: browser.i18n.getMessage(this.snoozing ? 'actionTitleSnooze' : 'actionTitle')
        });
    }

    public toggleSnoozingState() {
        this.snoozing = !this.snoozing;
        for (const key in this.cleanStores)
            this.cleanStores[key].setSnoozing(this.snoozing);

        if (!this.snoozing) {
            for (const cookie of this.snoozedThirdpartyCookies)
                this.removeCookieIfThirdparty(cookie);
            this.snoozedThirdpartyCookies.length = 0;
        }

        this.updateBrowserAction();
        this.sendSnoozingState();
    }

    public sendSnoozingState() {
        messageUtil.send('onSnoozingState', this.snoozing);
    }
}

export interface CleanUrlNowConfig {
    hostname: string;
    cookieStoreId: string;
}
