/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getValidHostname, DEFAULT_COOKIE_STORE_ID } from "../shared";
import { browser, Tabs } from "webextension-polyfill-ts";
import { getFirstPartyCookieDomain } from "./backgroundHelpers";
import { RequestWatcher, RequestWatcherListener } from "./requestWatcher";
import { TabInfo } from "./tabInfo";

export interface TabWatcherListener {
    onDomainEnter(cookieStoreId: string, hostname: string): void;
    onDomainLeave(cookieStoreId: string, hostname: string): void;
}

export class TabWatcher implements RequestWatcherListener {
    public destroy: () => void = () => undefined;
    private readonly listener: TabWatcherListener;
    private readonly tabInfos: { [s: string]: TabInfo } = {};
    private readonly tabInfosByCookieStore: { [s: string]: TabInfo[] } = {};

    public constructor(listener: TabWatcherListener) {
        this.listener = listener;

        browser.tabs.query({}).then((tabs) => {
            for (const tab of tabs)
                this.onTabCreated(tab);

            browser.tabs.onRemoved.addListener(this.onTabRemoved);
            browser.tabs.onCreated.addListener(this.onTabCreated);

            new RequestWatcher(this);
        });
    }

    public prepareNavigation(tabId: number, frameId: number, hostname: string) {
        const tabInfo = this.tabInfos[tabId];
        tabInfo && this.checkDomainLeave(tabInfo.cookieStoreId, tabInfo.prepareNavigation(frameId, hostname));
    }

    public commitNavigation(tabId: number, frameId: number, hostname: string) {
        const tabInfo = this.tabInfos[tabId];
        if (tabInfo) {
            this.checkDomainEnter(tabInfo.cookieStoreId, hostname);
            this.checkDomainLeaveSet(tabInfo.cookieStoreId, tabInfo.commitNavigation(frameId, hostname));
        }
    }

    public async completeNavigation(tabId: number, frameId: number) {
        const tabInfo = this.tabInfos[tabId];
        if (tabInfo)
            await tabInfo.scheduleDeadFramesCheck();
    }

    private checkDomainEnter(cookieStoreId: string, hostname: string) {
        if (hostname && !this.cookieStoreContainsDomain(cookieStoreId, hostname, false))
            this.listener.onDomainEnter(cookieStoreId, hostname);
    }

    private checkDomainLeaveSet = (cookieStoreId: string, hostnames: Set<string>) => {
        for (const hostname of hostnames)
            hostname && this.checkDomainLeave(cookieStoreId, hostname);
    }

    private checkDomainLeave(cookieStoreId: string, hostname: string) {
        if (hostname && !this.cookieStoreContainsDomain(cookieStoreId, hostname, true))
            this.listener.onDomainLeave(cookieStoreId, hostname);
    }

    public cookieStoreContainsDomain(cookieStoreId: string, domain: string, checkNext: boolean) {
        const list = this.tabInfosByCookieStore[cookieStoreId];
        return list ? list.some((ti) => ti.contains(domain, checkNext)) : false;
    }

    public containsDomain(domain: string) {
        for (const key in this.tabInfos) {
            const ti = this.tabInfos[key];
            if (ti.contains(domain, true))
                return true;
        }
        return false;
    }

    // fixme: add tests
    public containsRuleFP(rule: RegExp) {
        for (const key in this.tabInfos) {
            const ti = this.tabInfos[key];
            if (ti.containsRuleFP(rule))
                return true;
        }
        return false;
    }

    private onTabRemoved = (tabId: number) => {
        const tabInfo = this.tabInfos[tabId];
        if (tabInfo) {
            delete this.tabInfos[tabId];
            const list = this.tabInfosByCookieStore[tabInfo.cookieStoreId];
            if (list) {
                const index = list.findIndex((ti) => ti.tabId === tabId);
                if (index !== -1)
                    list.splice(index, 1);
            }
            this.checkDomainLeaveSet(tabInfo.cookieStoreId, tabInfo.commitNavigation(0, ""));
        }
    }

    private onTabCreated = (tab: Tabs.Tab) => {
        if (tab.id && !tab.incognito) {
            const cookieStoreId = tab.cookieStoreId || DEFAULT_COOKIE_STORE_ID;
            const hostname = tab.url ? getValidHostname(tab.url) : "";
            this.checkDomainEnter(cookieStoreId, hostname);

            const tabInfo = this.tabInfos[tab.id] = new TabInfo(tab.id, hostname, cookieStoreId, this.checkDomainLeaveSet);
            const list = this.tabInfosByCookieStore[cookieStoreId];
            if (!list)
                this.tabInfosByCookieStore[cookieStoreId] = [tabInfo];
            else {
                const index = list.findIndex((ti) => ti.tabId === tabInfo.tabId);
                if (index === -1)
                    list.push(tabInfo);
                else
                    list[index] = tabInfo;
            }
        }
    }

    public isThirdPartyCookieOnTab(tabId: number, domain: string) {
        const tabInfo = this.tabInfos[tabId];
        if (!tabInfo)
            return false;
        return !tabInfo.matchHostnameFP(getFirstPartyCookieDomain(domain));
    }

    public cookieStoreContainsDomainFP(storeId: string, domainFP: string, deep: boolean) {
        const tabInfos = this.tabInfosByCookieStore[storeId];
        if (!tabInfos || !tabInfos.length)
            return false;
        if (deep)
            return tabInfos.some((ti) => ti.containsHostnameFP(domainFP));
        return tabInfos.some((ti) => ti.matchHostnameFP(domainFP));
    }
}
