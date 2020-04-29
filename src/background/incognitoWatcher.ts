import { singleton } from "tsyringe";
import { browser, Tabs } from "webextension-polyfill-ts";

import { StoreUtils } from "../shared/storeUtils";

@singleton()
export class IncognitoWatcher {
    private cookieStores = new Set<string>();

    private tabs = new Set<number>();

    private readonly defaultCookieStoreId: string;

    public constructor(storeUtils: StoreUtils) {
        this.defaultCookieStoreId = storeUtils.defaultCookieStoreId;
    }

    public init(tabs: Tabs.Tab[]) {
        tabs.forEach(this.onTabCreated);
        browser.tabs.onRemoved.addListener(this.onTabRemoved);
        browser.tabs.onCreated.addListener(this.onTabCreated);
    }

    private onTabCreated = (tab: Tabs.Tab) => {
        if (tab.id && tab.incognito) {
            this.tabs.add(tab.id);
            this.cookieStores.add(tab.cookieStoreId || this.defaultCookieStoreId);
        }
    };

    private onTabRemoved = (tabId: number) => {
        this.tabs.delete(tabId);
    };

    public hasCookieStore(cookieStoreId: string) {
        return this.cookieStores.has(cookieStoreId);
    }

    public hasTab(tabId: number) {
        return this.tabs.has(tabId);
    }
}
