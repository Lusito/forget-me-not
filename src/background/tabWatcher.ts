/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getValidHostname } from '../shared';
import { browser } from '../browser/browser';
import { Tabs } from '../browser/tabs';
import { isFirefox } from '../lib/browserInfo';

export const DEFAULT_COOKIE_STORE_ID = isFirefox ? 'firefox-default' : '0';


interface TabInfo {
    tabId: number;
    hostname: string;
    nextHostname: string;
    cookieStoreId: string;
}

export interface TabWatcherListener {
    onDomainEnter(cookieStoreId: string, hostname: string): void;
    onDomainLeave(cookieStoreId: string, hostname: string): void;
}

export class TabWatcher {
    private readonly listener: TabWatcherListener;
    private tabInfos: { [s: string]: TabInfo } = {};
    private tabInfosByCookieStore: { [s: string]: TabInfo[] } = {};

    public constructor(listener: TabWatcherListener) {
        this.listener = listener;
        browser.tabs.query({}).then((tabs) => {
            for (let tab of tabs)
                this.onTabCreated(tab);
        });
        browser.webNavigation.onBeforeNavigate.addListener((details) => details.frameId === 0 && this.onBeforeNavigate(details.tabId, details.url));
        browser.webNavigation.onCommitted.addListener((details) => details.frameId === 0 && this.onCommitted(details.tabId, details.url));
        browser.tabs.onRemoved.addListener((tabId) => this.onTabRemoved(tabId));
        browser.tabs.onCreated.addListener((tab) => this.onTabCreated(tab));
    }

    private onBeforeNavigate(tabId: number, url: string) {
        const tabInfo = this.tabInfos[tabId];
        if (tabInfo) {
            tabInfo.nextHostname = getValidHostname(url);
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
            tabInfo.nextHostname = '';
            this.checkDomainLeave(tabInfo.cookieStoreId, previousHostname);
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
            }
        });
    }

    private setTabInfo(tabId: number, hostname: string, cookieStoreId?: string) {
        cookieStoreId = cookieStoreId || DEFAULT_COOKIE_STORE_ID;
        this.checkDomainEnter(cookieStoreId, hostname);
        const tabInfo = this.tabInfos[tabId] = { tabId, hostname, nextHostname: '', cookieStoreId };
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

    public cookieStoreContainsSubDomain(cookieStoreId: string, suffix: string, ignoreNext?: boolean) {
        let list = this.tabInfosByCookieStore[cookieStoreId];
        if (list)
            return list.findIndex((ti) => ti.hostname.endsWith(suffix) || !ignoreNext && ti.nextHostname.endsWith(suffix)) !== -1;
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
            if (tabInfo)
                tabInfo.hostname = hostname;
            else
                this.setTabInfo(tab.id, hostname, tab.cookieStoreId);
        }
    }

    public isThirdPartyCookie(tabId: number, domain: string) {
        const tabInfo = this.tabInfos[tabId];
        if (!tabInfo) {
            console.warn(`No info about tabId ${tabId} available`);
            return false;
        }
        const allowSubDomains = domain.startsWith('.');
        const rawDomain = allowSubDomains ? domain.substr(1) : domain;
        if (tabInfo.hostname === rawDomain || tabInfo.nextHostname === rawDomain)
            return false;
        if (allowSubDomains) {
            if (tabInfo.hostname && tabInfo.hostname.endsWith(domain))
                return false;
            if (tabInfo.nextHostname && tabInfo.nextHostname.endsWith(domain))
                return false;
        }
        return true;
    }
}
