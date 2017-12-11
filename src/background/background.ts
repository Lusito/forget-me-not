/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import * as messageUtil from "../lib/messageUtil";
import { settings } from "../lib/settings";
import DelayedExecution from '../lib/delayedExecution';
import { loadJSONFile } from '../lib/fileHelper';
import { CookieDomainInfo } from '../shared';
import { badges, removeCookie, cleanLocalStorage, removeLocalStorageByHostname, getBadgeForDomain } from './backgroundShared';
import { CleanStore } from './cleanStore';

const allowedProtocols = /https?:/;
const MAX_COOKIE_DOMAIN_HISTORY = 20;

class Background {
    private readonly cleanStores: { [s: string]: CleanStore } = {};
    private lastDomainChangeRequest = Date.now();
    private delayedDomainUpdate = new DelayedExecution(this.updateDomainList.bind(this));
    private mostRecentCookieDomains: string[] = [];
    private readonly tabDomains: { [s: string]: string } = {};
    private readonly tabNextDomains: { [s: string]: string } = {};

    public constructor() {
        this.updateBadge();
        this.updateDomainList();
    }

    public onStartup() {
        if (!settings.get('startup.enabled'))
            return;
        let typeSet: browser.browsingData.DataTypeSet = {
            history: settings.get('startup.history'),
            downloads: settings.get('startup.downloads'),
            formData: settings.get('startup.formData'),
            passwords: settings.get('startup.passwords'),
            indexedDB: settings.get('startup.indexedDB'),
            pluginData: settings.get('startup.pluginData'),
            serverBoundCertificates: settings.get('startup.serverBoundCertificates'),
            serviceWorkers: settings.get('startup.serviceWorkers')
        };
        let options: browser.browsingData.RemovalOptions = {
            originTypes: { unprotectedWeb: true }
        };
        if (settings.get('startup.cookies')) {
            if (settings.get('startup.cookies.applyRules'))
                this.cleanCookiesWithRulesNow();
            else
                typeSet.cookies = true;
        }
        if (settings.get('startup.localStorage')) {
            if (settings.get('startup.localStorage.applyRules'))
                this.cleanLocalStorage(this.getDomainsToClean(true));
            else {
                typeSet.localStorage = true;
                settings.set('domainsToClean', {});
                settings.save();
            }
        }
        browser.browsingData.remove(options, typeSet);
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
        let typeSet: browser.browsingData.DataTypeSet = {
            history: settings.get('cleanAll.history'),
            downloads: settings.get('cleanAll.downloads'),
            formData: settings.get('cleanAll.formData'),
            passwords: settings.get('cleanAll.passwords'),
            indexedDB: settings.get('cleanAll.indexedDB'),
            pluginData: settings.get('cleanAll.pluginData'),
            serverBoundCertificates: settings.get('cleanAll.serverBoundCertificates'),
            serviceWorkers: settings.get('cleanAll.serviceWorkers')
        };
        let options: browser.browsingData.RemovalOptions = {
            originTypes: { unprotectedWeb: true }
        };
        if (settings.get('cleanAll.cookies')) {
            if (settings.get('cleanAll.cookies.applyRules'))
                this.cleanCookiesWithRulesNow();
            else
                typeSet.cookies = true;
        }
        if (settings.get('cleanAll.localStorage')) {
            if (settings.get('cleanAll.localStorage.applyRules'))
                this.cleanLocalStorage(this.getDomainsToClean(false));
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

    private isDomainProtected(domain: string, ignoreGrayList?: boolean): boolean {
        for (let key in this.cleanStores) {
            if (this.cleanStores[key].isActiveDomain(domain))
                return true;
        }
        let badge = getBadgeForDomain(domain);
        if (ignoreGrayList)
            return badge === badges.white;
        return badge !== badges.none && badge !== badges.forget;
    }

    public getMostRecentCookieDomains(): CookieDomainInfo[] {
        let result: CookieDomainInfo[] = [];
        for (const domain of this.mostRecentCookieDomains) {
            let badgeKey = getBadgeForDomain(domain).i18nKey;
            if (badgeKey) {
                result.push({
                    domain: domain,
                    badge: badgeKey
                });
            }
        }
        return result;
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
        if (domain.startsWith('.'))
            domain = domain.substr(1);
        let index = this.mostRecentCookieDomains.indexOf(domain);
        if (index !== 0) {
            if (index !== -1)
                this.mostRecentCookieDomains.splice(index, 1);
            this.mostRecentCookieDomains.unshift(domain);
            if (this.mostRecentCookieDomains.length > MAX_COOKIE_DOMAIN_HISTORY)
                this.mostRecentCookieDomains.length = MAX_COOKIE_DOMAIN_HISTORY;
        }
    }

    public onCookieChanged(changeInfo: browser.cookies.CookieChangeInfo) {
        if (!changeInfo.removed) {
            this.runIfCookieStoreNotIncognito(changeInfo.cookie.storeId, () => {
                this.addToMostRecentCookieDomains(changeInfo.cookie.domain);
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
        return this.getCleanStore(cookieStoreId).isCookieDomainAllowed(domain);
    }

    private cleanCookiesWithRulesNow() {
        browser.cookies.getAllCookieStores().then((stores) => {
            for (let store of stores)
                this.getCleanStore(store.id).cleanCookiesWithRulesNow();
        });
    }

    private getCleanStore(id?: string): CleanStore {
        if (!id)
            id = 'default';
        let store = this.cleanStores[id];
        if (!store)
            store = this.cleanStores[id] = new CleanStore(id);
        return store;
    }

    private updateDomainList() {
        browser.tabs.query({}).then((tabs) => {
            for (let cookieStoreId in this.cleanStores)
                this.cleanStores[cookieStoreId].prepareNewDomains();
            for (let tab of tabs) {
                if (tab.url && !tab.incognito) {
                    let url = new URL(tab.url);
                    if (allowedProtocols.test(url.protocol))
                        this.getCleanStore(tab.cookieStoreId).addNewDomain(url.hostname);
                }
            }

            for (let cookieStoreId in this.cleanStores)
                this.cleanStores[cookieStoreId].finishNewDomains();
        });
    }

    public checkDomainChanges() {
        if (settings.get('domainLeave.enabled') && (settings.get('domainLeave.cookies')
            || removeLocalStorageByHostname && settings.get('domainLeave.localStorage'))) {
            this.lastDomainChangeRequest = Date.now();
            this.delayedDomainUpdate.restart(200);
        }
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
                    browser.browserAction.setBadgeText({ text: text, tabId: tab.id });
                    browser.browserAction.setBadgeBackgroundColor({ color: badge.color, tabId: tab.id });
                    browser.browserAction.enable(tab.id);
                } else {
                    browser.browserAction.disable(tab.id);
                }
            }
        });
    }

    public onBeforeNavigate(tabId: number, url: string) {
        this.tabNextDomains[tabId] = new URL(url).hostname;
    }

    public onCommitted(tabId: number, url: string) {
        this.tabDomains[tabId] = new URL(url).hostname;
        delete this.tabNextDomains[tabId];
    }

    public onTabRemoved(tabId: number) {
        delete this.tabDomains[tabId];
        delete this.tabNextDomains[tabId];
    }

    public isThirdPartyCookie(tabId: number, domain: string) {
        const allowSubDomains = domain.startsWith('.');
        const tabUrl = this.tabDomains[tabId];
        if (tabUrl && (allowSubDomains ? tabUrl.endsWith(domain) : tabUrl === domain))
            return false;
        const tabNextUrl = this.tabNextDomains[tabId];
        if (tabNextUrl && (allowSubDomains ? tabNextUrl.endsWith(domain) : tabNextUrl === domain))
            return false;
        return true;
    }
}

const cookieDomainRegexp = /domain=([\.a-z0-9\-]+);/;
function getCookieDomainFromCookieHeader(header: string) {
    var match = cookieDomainRegexp.exec(header);
    if (match)
        return match[1];
    return false;
}
let background: Background;
let doStartup = false;
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
    browser.webNavigation.onBeforeNavigate.addListener((details) => {
        background.onBeforeNavigate(details.tabId, details.url);
    });
    browser.webNavigation.onCommitted.addListener((details) => {
        background.onCommitted(details.tabId, details.url);
        background.checkDomainChanges();
    });
    browser.tabs.onRemoved.addListener((tabId) => {
        background.onTabRemoved(tabId);
        background.checkDomainChanges();
    });

    function isCookieDomainWhiteOrGray(domain: string) {
        let badge = getBadgeForDomain(domain.startsWith('.') ? domain.substr(1) : domain);
        return badge !== badges.none && badge !== badges.forget;
    }
    function onHeadersReceived(details: browser.webRequest.WebResponseHeadersDetails) {
        if (details.responseHeaders) {
            return {
                responseHeaders: details.responseHeaders.filter((x) => {
                    if (x.name.toLowerCase() === 'set-cookie') {
                        if (x.value) {
                            const domain = getCookieDomainFromCookieHeader(x.value);
                            if (domain && background.isThirdPartyCookie(details.tabId, domain)
                                && !isCookieDomainWhiteOrGray(domain)) {
                                background.addToMostRecentCookieDomains(domain);
                                return false;
                            }
                        }
                    }
                    return true;
                })
            }
        }
        return {};
    }
    function applyCleanThirdPartyCookiesBeforeCreationSetting() {
        if (settings.get('cleanThirdPartyCookies.beforeCreation'))
            browser.webRequest.onHeadersReceived.addListener(onHeadersReceived, { urls: ["<all_urls>"] }, ["responseHeaders", "blocking"]);
        else
            browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
    }
    applyCleanThirdPartyCookiesBeforeCreationSetting();

    // listen for tab changes to update badge
    let badgeUpdater = () => background.updateBadge();
    browser.tabs.onActivated.addListener(badgeUpdater);
    browser.tabs.onUpdated.addListener(badgeUpdater);
    messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
        if (changedKeys.indexOf('rules') !== -1 || changedKeys.indexOf('whitelistNoTLD') !== -1)
            background.updateBadge();
        if (changedKeys.indexOf('cleanThirdPartyCookies.beforeCreation') !== -1)
            applyCleanThirdPartyCookiesBeforeCreationSetting();
    });

    // for firefox compatibility, we need to show the open file dialog from background, as the browserAction popup will be hidden, stopping the script.
    messageUtil.receive('import', () => {
        loadJSONFile((json) => {
            if (json && settings.setAll(json)) {
                console.log('success');
            }
        });
    });

    messageUtil.receive('getMostRecentCookieDomains', (params: any, sender: any) => {
        messageUtil.send('onMostRecentCookieDomains', background.getMostRecentCookieDomains());
    });

    if (doStartup) {
        background.onStartup();
        doStartup = false;
    }

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
    browser.notifications.onClicked.addListener((id: string) => {
        if (id === UPDATE_NOTIFICATION_ID) {
            browser.tabs.create({
                active: true,
                url: browser.runtime.getURL("views/readme.html") + '#changelog'
            });
        }
    });
});
browser.runtime.onStartup.addListener(() => {
    if (background)
        background.onStartup();
    else
        doStartup = true;
});
