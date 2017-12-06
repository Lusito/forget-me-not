/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import * as messageUtil from "../lib/messageUtil";
import { settings, RuleType } from "../lib/settings";
import { browserInfo, isFirefox } from '../lib/browserInfo';
import DelayedExecution from '../lib/delayedExecution';
import { loadJSONFile } from '../lib/fileHelper';
import { CookieDomainInfo } from './backgroundShared';

const allowedProtocols = /https?:/;
const removeLocalStorageByHostname = isFirefox && parseFloat(browserInfo.version) >= 58;
const MAX_COOKIE_DOMAIN_HISTORY = 20;

interface BadgeInfo {
    i18nKey?: string;
    color: string | [number, number, number, number];
}

const badges = {
    white: {
        i18nKey: "badge_white",
        color: [38, 69, 151, 255]
    } as BadgeInfo,
    gray: {
        i18nKey: "badge_gray",
        color: [116, 116, 116, 255]
    } as BadgeInfo,
    forget: {
        i18nKey: "badge_forget",
        color: [190, 23, 38, 255]
    } as BadgeInfo,
    none: {
        color: [0, 0, 0, 255]
    } as BadgeInfo
}

class Background {
    private lastDomainChangeRequest = Date.now();
    private delayedDomainUpdate = new DelayedExecution(this.updateDomainList.bind(this));
    private currentDomains: string[] = [];
    private mostRecentCookieDomains: string[] = [];
    private readonly tabDomains: { [s: string]: string } = {};
    private readonly tabNextDomains: { [s: string]: string } = {};

    public constructor() {
        this.updateBadge();
        this.updateDomainList();
    }

    private getLocalStorageDomains(ignoreGrayList: boolean): string[] {
        let domainsToClean = settings.get('domainsToClean');
        let result = [];
        for (const domain in domainsToClean) {
            if (domainsToClean.hasOwnProperty(domain) && !this.isDomainAllowed(domain, ignoreGrayList))
                result.push(domain);
        }
        return result;
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
                this.cleanLocalStorage(this.getLocalStorageDomains(true));
            else {
                typeSet.localStorage = true;
                settings.set('domainsToClean', {});
                settings.save();
            }
        }
        browser.browsingData.remove(options, typeSet);
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
                this.cleanLocalStorage(this.getLocalStorageDomains(false));
            else {
                typeSet.localStorage = true;
                settings.set('domainsToClean', {});
                settings.save();
            }
        }
        browser.browsingData.remove(options, typeSet);
    }

    private cleanLocalStorage(hostnames: string[]) {
        if (removeLocalStorageByHostname) {
            let domainsToClean = { ...settings.get('domainsToClean') };
            for (const hostname of hostnames)
                delete domainsToClean[hostname];
            settings.set('domainsToClean', domainsToClean);
            settings.save();
            browser.browsingData.remove({
                originTypes: { unprotectedWeb: true },
                hostnames: hostnames
            }, { localStorage: true });
            return true;
        }
        return false;
    }

    public cleanUrlNow(hostname: string) {
        this.cleanLocalStorage([hostname]);
        this.cleanCookiesByDomain(hostname, true);
    }

    private removeCookie(cookie: browser.cookies.Cookie) {
        let allowSubDomains = cookie.domain.startsWith('.');
        let rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        browser.cookies.remove({
            name: cookie.name,
            url: (cookie.secure ? 'https://' : 'http://') + rawDomain + cookie.path,
            storeId: cookie.storeId
        });
    }

    private isDomainAllowed(domain: string, ignoreGrayList?: boolean): boolean {
        if (this.currentDomains.indexOf(domain) !== -1)
            return true;
        let badge = this.getBadgeForDomain(domain);
        if (ignoreGrayList)
            return badge === badges.white;
        return badge !== badges.none && badge !== badges.forget;
    }

    public isCookieDomainAllowed(domain: string) {
        let allowSubDomains = domain.startsWith('.');
        let rawDomain = allowSubDomains ? domain.substr(1) : domain;
        if (this.isDomainAllowed(rawDomain))
            return true;
        if (allowSubDomains) {
            for (const otherDomain of this.currentDomains) {
                if (otherDomain.endsWith(domain))
                    return true;
            }
        }
        return false;
    }

    public getMostRecentCookieDomains(): CookieDomainInfo[] {
        let result: CookieDomainInfo[] = [];
        for (const domain of this.mostRecentCookieDomains) {
            let badgeKey = this.getBadgeForDomain(domain).i18nKey;
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
                        else if (!this.isCookieDomainAllowed(changeInfo.cookie.domain))
                            this.removeCookie(changeInfo.cookie);
                    });
                    exec.restart(settings.get('cleanThirdPartyCookies.delay') * 60 * 1000);
                }
            });
        }
    }

    private cleanCookiesWithRulesNow() {
        browser.cookies.getAll({}).then((cookies) => {
            for (const cookie of cookies) {
                if (!this.isCookieDomainAllowed(cookie.domain))
                    this.removeCookie(cookie);
            }
        });
    }

    private cleanCookiesByDomain(domain: string, ignoreRules?: boolean) {
        browser.cookies.getAll({}).then((cookies) => {
            for (const cookie of cookies) {
                let allowSubDomains = cookie.domain.startsWith('.');
                let match = allowSubDomains ? domain.endsWith(cookie.domain) : (domain === cookie.domain);
                if (match && (ignoreRules || !this.isCookieDomainAllowed(cookie.domain)))
                    this.removeCookie(cookie);
            }
        });
    }

    private cleanByDomainWithRulesNow(domain: string) {
        if (!settings.get('domainLeave.enabled') || this.isDomainAllowed(domain))
            return;

        if (settings.get('domainLeave.cookies')) {
            this.cleanCookiesByDomain(domain);
        }
        if (settings.get('domainLeave.localStorage'))
            this.cleanLocalStorage([domain]);
    }

    private updateDomainList() {
        browser.tabs.query({}).then((tabs) => {
            let oldDomains = this.currentDomains;
            this.currentDomains = [];
            for (let tab of tabs) {
                if (tab.url && !tab.incognito) {
                    let url = new URL(tab.url);
                    if (allowedProtocols.test(url.protocol) && this.currentDomains.indexOf(url.hostname) === -1)
                        this.currentDomains.push(url.hostname);
                }
            }

            let removedDomains = oldDomains.filter((domain) => this.currentDomains.indexOf(domain) === -1);
            if (removedDomains.length)
                this.onDomainsRemoved(removedDomains);
            let addedDomains = this.currentDomains.filter((domain) => oldDomains.indexOf(domain) === -1);
            if (addedDomains.length)
                this.onDomainsAdded(addedDomains);
        });
    }

    private onDomainsRemoved(removedDomains: string[]) {
        let timeout = settings.get('domainLeave.delay') * 60 * 1000;
        if (timeout <= 0) {
            for (let domain of removedDomains)
                this.cleanByDomainWithRulesNow(domain);
        } else {
            setTimeout(() => {
                for (let domain of removedDomains)
                    this.cleanByDomainWithRulesNow(domain);
            }, timeout);
        }
    }

    private onDomainsAdded(addedDomains: string[]) {
        if (removeLocalStorageByHostname) {
            let domainsToClean = { ...settings.get('domainsToClean') };
            for (const domain of addedDomains)
                domainsToClean[domain] = true;
            settings.set('domainsToClean', domainsToClean);
            settings.save();
        }
    }

    public checkDomainChanges() {
        if (settings.get('domainLeave.enabled') && (settings.get('domainLeave.cookies')
            || removeLocalStorageByHostname && settings.get('domainLeave.localStorage'))) {
            this.lastDomainChangeRequest = Date.now();
            this.delayedDomainUpdate.restart(200);
        }
    }

    private getBadgeForDomain(domain: string) {
        if (settings.get('whitelistNoTLD') && domain.indexOf('.') === -1)
            return badges.white;
        let matchingRules = settings.getMatchingRules(domain);
        if (matchingRules.length === 0)
            return badges.forget;
        for (const rule of matchingRules) {
            if (rule.type === RuleType.WHITE)
                return badges.white;
        }
        return badges.gray;
    }

    public updateBadge() {
        browser.tabs.query({ active: true }).then((tabs) => {
            for (let tab of tabs) {
                if (tab && tab.url && !tab.incognito) {
                    let badge = badges.none;
                    let url = new URL(tab.url);
                    if (allowedProtocols.test(url.protocol))
                        badge = this.getBadgeForDomain(url.hostname);
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

settings.onReady(() => {
    background = new Background();
    messageUtil.receive('cleanAllNow', () => background.cleanAllNow());
    messageUtil.receive('cleanUrlNow', (url) => background.cleanUrlNow(url));
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

    function onHeadersReceived(details: browser.webRequest.WebResponseHeadersDetails) {
        if (details.responseHeaders) {
            return {
                responseHeaders: details.responseHeaders.filter((x) => {
                    if (x.name.toLowerCase() === 'set-cookie') {
                        if (x.value) {
                            const domain = getCookieDomainFromCookieHeader(x.value);
                            if (domain && background.isThirdPartyCookie(details.tabId, domain)
                                && !background.isCookieDomainAllowed(domain)) {
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
                url: browser.runtime.getURL("templates/readme.html") + '#changelog'
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
