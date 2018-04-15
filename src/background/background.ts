/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as messageUtil from "../lib/messageUtil";
import { settings } from "../lib/settings";
import DelayedExecution from '../lib/delayedExecution';
import { loadJSONFile } from '../lib/fileHelper';
import { badges, removeCookie, cleanLocalStorage, removeLocalStorageByHostname, getBadgeForDomain } from './backgroundShared';
import { CleanStore } from './cleanStore';
import { TabWatcher, TabWatcherListener, DEFAULT_COOKIE_STORE_ID } from './tabWatcher';
import { RecentlyAccessedDomains } from './recentlyAccessedDomains';
import { HeaderFilter } from './headerFilter';
import { getValidHostname } from '../shared';
import { browser, BrowsingData, Cookies } from "webextension-polyfill-ts";

class Background implements TabWatcherListener {
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
        let typeSet: BrowsingData.DataTypeSet = {
            history: settings.get(startup ? 'startup.history' : 'cleanAll.history'),
            downloads: settings.get(startup ? 'startup.downloads' : 'cleanAll.downloads'),
            formData: settings.get(startup ? 'startup.formData' : 'cleanAll.formData'),
            passwords: settings.get(startup ? 'startup.passwords' : 'cleanAll.passwords'),
            indexedDB: settings.get(startup ? 'startup.indexedDB' : 'cleanAll.indexedDB'),
            pluginData: settings.get(startup ? 'startup.pluginData' : 'cleanAll.pluginData'),
            serverBoundCertificates: settings.get(startup ? 'startup.serverBoundCertificates' : 'cleanAll.serverBoundCertificates'),
            serviceWorkers: settings.get(startup ? 'startup.serviceWorkers' : 'cleanAll.serviceWorkers')
        };
        let options: BrowsingData.RemovalOptions = {
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
                    for (let store of cookieStores)
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
        let domainsToClean = settings.get('domainsToClean');
        let result = [];
        for (const domain in domainsToClean) {
            if (domainsToClean.hasOwnProperty(domain) && !this.isDomainProtected(domain, ignoreGrayList, protectOpenDomains))
                result.push(domain);
        }
        return result;
    }

    private isDomainProtected(domain: string, ignoreGrayList: boolean, protectOpenDomains: boolean): boolean {
        if (protectOpenDomains) {
            for (let key in this.cleanStores) {
                if (this.tabWatcher.cookieStoreContainsDomain(key, domain))
                    return true;
            }
        }
        let badge = getBadgeForDomain(domain);
        return badge === badges.white || (badge === badges.gray && !ignoreGrayList);
    }

    private runIfCookieStoreNotIncognito(storeId: string, callback: () => void) {
        if (storeId.indexOf('private') >= 0)
            return;
        if (storeId.indexOf('firefox') >= 0)
            callback();
        else {
            browser.cookies.getAllCookieStores().then((cookieStores) => {
                for (let store of cookieStores) {
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
                let allowSubDomains = changeInfo.cookie.domain.startsWith('.');
                let rawDomain = allowSubDomains ? changeInfo.cookie.domain.substr(1) : changeInfo.cookie.domain;
                if (getBadgeForDomain(rawDomain) === badges.block)
                    removeCookie(changeInfo.cookie);
                else if (settings.get('cleanThirdPartyCookies.enabled'))
                    this.removeCookieIfThirdparty(changeInfo.cookie);
            });
        }
    }

    public removeCookieIfThirdparty(cookie: Cookies.Cookie) {
        if (!this.isCookieAllowed(cookie)) {
            if (this.snoozing) {
                this.snoozedThirdpartyCookies.push(cookie);
                return;
            }
            let exec = new DelayedExecution(() => {
                if (this.snoozing) {
                    this.snoozedThirdpartyCookies.push(cookie);
                    return;
                }
                let delta = Date.now() - this.lastDomainChangeRequest;
                if (delta < 1000)
                    exec.restart(500);
                else if (!this.isCookieAllowed(cookie))
                    removeCookie(cookie);
            });
            exec.restart(settings.get('cleanThirdPartyCookies.delay') * 60 * 1000);
        }
    }

    public isCookieAllowed(cookie: Cookies.Cookie) {
        return this.getCleanStore(cookie.storeId).isCookieAllowed(cookie, false, true);
    }

    private cleanCookiesWithRulesNow(ignoreGrayList: boolean, protectOpenDomains: boolean) {
        browser.cookies.getAllCookieStores().then((stores) => {
            for (let store of stores)
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
            for (let tab of tabs) {
                if (tab && tab.url && !tab.incognito) {
                    let badge = badges.none;
                    const hostname = getValidHostname(tab.url);
                    if (hostname)
                        badge = getBadgeForDomain(hostname);
                    let text = badge.i18nKey ? browser.i18n.getMessage(badge.i18nKey) : "";
                    if (!settings.get('showBadge'))
                        text = '';
                    browser.browserAction.setBadgeText({ text: text, tabId: tab.id });
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
            let domainsToClean = { ...settings.get('domainsToClean') };
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

        browser.browserAction.setIcon({
            path: path
        });
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

let background: Background;
const UPDATE_NOTIFICATION_ID: string = "UpdateNotification";
interface CleanUrlNowConfig {
    hostname: string;
    cookieStoreId: string;
}
settings.onReady(() => {
    background = new Background();
    messageUtil.receive('cleanAllNow', () => background.cleanAllNow());
    messageUtil.receive('cleanUrlNow', (config: CleanUrlNowConfig) => background.cleanUrlNow(config));
    messageUtil.receive('toggleSnoozingState', () => background.toggleSnoozingState());
    messageUtil.receive('getSnoozingState', () => background.sendSnoozingState());
    browser.cookies.onChanged.addListener((i) => background.onCookieChanged(i));

    // listen for tab changes to update badge
    let badgeUpdater = () => background.updateBadge();
    browser.tabs.onActivated.addListener(badgeUpdater);
    browser.tabs.onUpdated.addListener(badgeUpdater);
    messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
        if (changedKeys.indexOf('rules') !== -1 || changedKeys.indexOf('fallbackRule') !== -1 || changedKeys.indexOf('whitelistNoTLD') !== -1
            || changedKeys.indexOf('showBadge') !== -1)
            background.updateBadge();
    });

    // for firefox compatibility, we need to show the open file dialog from background, as the browserAction popup will be hidden, stopping the script.
    messageUtil.receive('import', () => {
        loadJSONFile((json) => {
            if (json && settings.setAll(json)) {
                console.log('success');
            }
        });
    });

    browser.notifications.onClicked.addListener((id: string) => {
        if (id === UPDATE_NOTIFICATION_ID) {
            browser.tabs.create({
                active: true,
                url: browser.runtime.getURL("views/readme.html") + '#changelog'
            });
        }
    });

    setTimeout(() => {
        background.onStartup();

        const manifestVersion = browser.runtime.getManifest().version;
        if (settings.get('version') !== manifestVersion) {
            settings.set('version', manifestVersion);
            settings.save();

            if (settings.get('showUpdateNotification')) {
                browser.notifications.create(UPDATE_NOTIFICATION_ID, {
                    "type": "basic",
                    "iconUrl": browser.extension.getURL("icons/icon96.png"),
                    "title": browser.i18n.getMessage('update_notification_title'),
                    "message": browser.i18n.getMessage('update_notification_message')
                });
            }
        }
    }, 1000);
});
