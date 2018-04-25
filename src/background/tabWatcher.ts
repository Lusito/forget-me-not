/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getValidHostname } from '../shared';
import { browser, Tabs, WebNavigation } from 'webextension-polyfill-ts';
import { isFirefox, isNodeTest } from '../lib/browserInfo';
import { RecentlyAccessedDomains } from './recentlyAccessedDomains';
import { getDomain } from "tldjs";

export const DEFAULT_COOKIE_STORE_ID = isFirefox ? 'firefox-default' : '0';


interface TabInfo {
    tabId: number;
    hostname: string;
    hostnameFP: string;
    nextHostname: string;
    nextHostnameFP: string;
    cookieStoreId: string;
}

export interface TabWatcherListener {
    onDomainEnter(cookieStoreId: string, hostname: string): void;
    onDomainLeave(cookieStoreId: string, hostname: string): void;
}

export class TabWatcher {
    public destroy: () => void;
    private readonly listener: TabWatcherListener;
    private tabInfos: { [s: string]: TabInfo } = {};
    private tabInfosByCookieStore: { [s: string]: TabInfo[] } = {};
    private readonly recentlyAccessedDomains: RecentlyAccessedDomains | null;

    public constructor(listener: TabWatcherListener, recentlyAccessedDomains: RecentlyAccessedDomains | null) {
        this.listener = listener;
        this.recentlyAccessedDomains = recentlyAccessedDomains;
        browser.tabs.query({}).then((tabs) => {
            for (let tab of tabs)
                this.onTabCreated(tab);
        });

        const onBeforeNavigate: (details: WebNavigation.OnBeforeNavigateDetailsType) => void = (details) => details.frameId === 0 && this.onBeforeNavigate(details.tabId, details.url);
        const onCommitted: (details: WebNavigation.OnCommittedDetailsType) => void = (details) => details.frameId === 0 && this.onCommitted(details.tabId, details.url);
        const onRemoved: (tabId: number, removeInfo: Tabs.OnRemovedRemoveInfoType) => void = (tabId) => this.onTabRemoved(tabId);
        const onCreated: (tab: Tabs.Tab) => void = (tab) => this.onTabCreated(tab);
        browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
        browser.webNavigation.onCommitted.addListener(onCommitted);
        browser.tabs.onRemoved.addListener(onRemoved);
        browser.tabs.onCreated.addListener(onCreated);

        this.destroy = () => {
            browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
            browser.webNavigation.onCommitted.removeListener(onCommitted);
            browser.tabs.onRemoved.removeListener(onRemoved);
            browser.tabs.onCreated.removeListener(onCreated);
            this.destroy = () => { };
        }
    }

    private onBeforeNavigate(tabId: number, url: string) {
        const tabInfo = this.tabInfos[tabId];
        if (tabInfo) {
            tabInfo.nextHostname = getValidHostname(url);
            tabInfo.nextHostnameFP = (tabInfo.nextHostname && getDomain(tabInfo.nextHostname)) || tabInfo.nextHostname;
        } else {
            this.getTab(tabId);
        }
    }

    private onCommitted(tabId: number, url: string) {
        const tabInfo = this.tabInfos[tabId];
        if (tabInfo) {
            const hostname = getValidHostname(url);
            this.checkDomainEnter(tabInfo.cookieStoreId, hostname);
            const previousHostname = tabInfo.hostname;
            tabInfo.hostname = hostname;
            tabInfo.hostnameFP = getDomain(hostname) || hostname;
            tabInfo.nextHostname = tabInfo.nextHostnameFP = '';
            this.checkDomainLeave(tabInfo.cookieStoreId, previousHostname);
            if (hostname && this.recentlyAccessedDomains)
                this.recentlyAccessedDomains.add(hostname);
        } else {
            this.getTab(tabId);
        }
    }

    private checkDomainEnter(cookieStoreId: string, hostname: string) {
        if (hostname && !this.cookieStoreContainsDomain(cookieStoreId, hostname, true))
            this.listener.onDomainEnter(cookieStoreId, hostname);
    }

    private checkDomainLeave(cookieStoreId: string, hostname: string) {
        if (hostname && !this.cookieStoreContainsDomain(cookieStoreId, hostname))
            this.listener.onDomainLeave(cookieStoreId, hostname);
    }

    private getTab(tabId: number) {
        browser.tabs.get(tabId).then((tab) => {
            if (!tab.incognito && !this.tabInfos[tabId]) {
                const hostname = tab.url ? getValidHostname(tab.url) : '';
                this.setTabInfo(tabId, hostname, tab.cookieStoreId);
                if (hostname && this.recentlyAccessedDomains)
                    this.recentlyAccessedDomains.add(hostname);
            }
        });
    }

    private setTabInfo(tabId: number, hostname: string, cookieStoreId?: string) {
        cookieStoreId = cookieStoreId || DEFAULT_COOKIE_STORE_ID;
        this.checkDomainEnter(cookieStoreId, hostname);
        const tabInfo = this.tabInfos[tabId] = { tabId, hostname, hostnameFP: getDomain(hostname) || hostname, nextHostname: '', nextHostnameFP: '', cookieStoreId };
        let list = this.tabInfosByCookieStore[cookieStoreId];
        if (!list)
            list = this.tabInfosByCookieStore[cookieStoreId] = [tabInfo];
        else {
            const index = list.findIndex((ti) => ti.tabId === tabId);
            if (index === -1)
                list.push(tabInfo);
            else
                list[index] = tabInfo;
        }
    }

    public cookieStoreContainsDomain(cookieStoreId: string, domain: string, ignoreNext?: boolean) {
        let list = this.tabInfosByCookieStore[cookieStoreId];
        if (list)
            return list.findIndex((ti) => ti.hostname === domain || !ignoreNext && ti.nextHostname === domain) !== -1;
        return false;
    }

    private onTabRemoved(tabId: number) {
        const tabInfo = this.tabInfos[tabId];
        if (tabInfo) {
            delete this.tabInfos[tabId];
            let list = this.tabInfosByCookieStore[tabInfo.cookieStoreId];
            if (list) {
                const index = list.findIndex((ti) => ti.tabId === tabId);
                if (index !== -1)
                    list.splice(index, 1);
            }
            this.checkDomainLeave(tabInfo.cookieStoreId, tabInfo.hostname);
        }
    }

    private onTabCreated(tab: Tabs.Tab) {
        if (tab.id && !tab.incognito) {
            const hostname = tab.url ? getValidHostname(tab.url) : '';
            const tabInfo = this.tabInfos[tab.id];
            if (tabInfo) {
                tabInfo.hostname = hostname;
                tabInfo.hostnameFP = getDomain(hostname) || hostname;
            } else {
                this.setTabInfo(tab.id, hostname, tab.cookieStoreId);
            }
            if (hostname && this.recentlyAccessedDomains)
                this.recentlyAccessedDomains.add(hostname);
        }
    }

    public isThirdPartyCookieOnTab(tabId: number, domain: string) {
        const tabInfo = this.tabInfos[tabId];
        if (!tabInfo) {
            if (!isNodeTest)
                console.warn(`No info about tabId ${tabId} available`);
            return false;
        }
        const rawDomain = domain.startsWith('.') ? domain.substr(1) : domain;
        const domainFP = getDomain(rawDomain) || rawDomain;
        return tabInfo.hostnameFP !== domainFP && tabInfo.nextHostnameFP !== domainFP;
    }

    public isFirstPartyDomainOnCookieStore(storeId: string, domainFP: string) {
        const tabInfos = this.tabInfosByCookieStore[storeId];
        if (!tabInfos) {
            if (!isNodeTest)
                console.warn(`No info about storeId ${storeId} available`);
            return false;
        }
        if (!tabInfos.length)
            return false;
        return tabInfos.findIndex((tabInfo) => tabInfo.hostnameFP === domainFP || tabInfo.nextHostnameFP === domainFP) >= 0;
    }
}
