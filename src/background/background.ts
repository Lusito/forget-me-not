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
import { MostRecentCookieDomains } from './mostRecentCookieDomains';
import { HeaderFilter } from './headerFilter';
import { allowedProtocols } from '../shared';
import { browser } from "../browser/browser";
import { BrowsingData } from "../browser/browsingData";
import { Cookies } from "../browser/cookies";

class Background implements TabWatcherListener {
    private readonly cleanStores: { [s: string]: CleanStore } = {};
    private lastDomainChangeRequest = Date.now();
    private readonly mostRecentCookieDomains = new MostRecentCookieDomains();
    private readonly tabWatcher = new TabWatcher(this);

    public constructor() {
        this.updateBadge();
        new HeaderFilter(this.tabWatcher, this.mostRecentCookieDomains);
    }

    public onStartup() {
        if (settings.get('startup.enabled'))
            this.runCleanup(true);
    }

    public cleanLocalStorage(hostnames: string[]) {
        browser.cookies.getAllCookieStores().then((cookieStores) => {
            for (let store of cookieStores)
                cleanLocalStorage(this.getDomainsToClean(true), store.id);
        });
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
        if (settings.get(startup ? 'startup.cookies' : 'cleanAll.cookies')) {
            if (settings.get(startup ? 'startup.cookies.applyRules' : 'cleanAll.cookies.applyRules'))
                this.cleanCookiesWithRulesNow(startup);
            else
                typeSet.cookies = true;
        }
        if (settings.get(startup ? 'startup.localStorage' : 'cleanAll.localStorage')) {
            if (settings.get(startup ? 'startup.localStorage.applyRules' : 'cleanAll.localStorage.applyRules'))
                this.cleanLocalStorage(this.getDomainsToClean(startup));
            else {
                typeSet.localStorage = true;
                settings.set('domainsToClean', {});
                settings.save();
            }
        }
        browser.browsingData.remove(options, typeSet);
    }

    private getDomainsToClean(ignoreGrayList: boolean): string[] {
        let domainsToClean = settings.get('domainsToClean');
        let result = [];
        for (const domain in domainsToClean) {
            if (domainsToClean.hasOwnProperty(domain) && !this.isDomainProtected(domain, ignoreGrayList))
                result.push(domain);
        }
        return result;
    }

    private isDomainProtected(domain: string, ignoreGrayList: boolean): boolean {
        for (let key in this.cleanStores) {
            if (this.tabWatcher.cookieStoreContainsDomain(key, domain))
                return true;
        }
        let badge = getBadgeForDomain(domain);
        if (ignoreGrayList)
            return badge === badges.white;
        return badge !== badges.none && badge !== badges.forget;
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

    public addToMostRecentCookieDomains(domain: string) {
        this.mostRecentCookieDomains.add(domain);
    }

    public onCookieChanged(changeInfo: Cookies.CookieChangeInfo) {
        if (!changeInfo.removed) {
            this.runIfCookieStoreNotIncognito(changeInfo.cookie.storeId, () => {
                this.mostRecentCookieDomains.add(changeInfo.cookie.domain);
                if (settings.get('cleanThirdPartyCookies.enabled')) {
                    let exec = new DelayedExecution(() => {
                        let delta = Date.now() - this.lastDomainChangeRequest;
                        if (delta < 1000)
                            exec.restart(500);
                        else if (!this.isCookieDomainAllowed(changeInfo.cookie.storeId, changeInfo.cookie.domain))
                            removeCookie(changeInfo.cookie);
                    });
                    exec.restart(settings.get('cleanThirdPartyCookies.delay') * 60 * 1000);
                }
            });
        }
    }

    public isCookieDomainAllowed(cookieStoreId: string, domain: string) {
        return this.getCleanStore(cookieStoreId).isCookieDomainAllowed(domain, false);
    }

    private cleanCookiesWithRulesNow(ignoreGrayList: boolean) {
        browser.cookies.getAllCookieStores().then((stores) => {
            for (let store of stores)
                this.getCleanStore(store.id).cleanCookiesWithRulesNow(ignoreGrayList);
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

    public updateBadge() {
        browser.tabs.query({ active: true }).then((tabs) => {
            for (let tab of tabs) {
                if (tab && tab.url && !tab.incognito) {
                    let badge = badges.none;
                    let url = new URL(tab.url);
                    if (allowedProtocols.test(url.protocol))
                        badge = getBadgeForDomain(url.hostname);
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

    public isThirdPartyCookie(tabId: number, domain: string) {
        return this.tabWatcher.isThirdPartyCookie(tabId, domain);
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
    browser.cookies.onChanged.addListener((i) => background.onCookieChanged(i));

    // listen for tab changes to update badge
    let badgeUpdater = () => background.updateBadge();
    browser.tabs.onActivated.addListener(badgeUpdater);
    browser.tabs.onUpdated.addListener(badgeUpdater);
    messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
        if (changedKeys.indexOf('rules') !== -1 || changedKeys.indexOf('whitelistNoTLD') !== -1
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

            browser.notifications.create(UPDATE_NOTIFICATION_ID, {
                "type": "basic",
                "iconUrl": browser.extension.getURL("icons/icon96.png"),
                "title": browser.i18n.getMessage('update_notification_title'),
                "message": browser.i18n.getMessage('update_notification_message')
            });
        }
    }, 1000);
});
