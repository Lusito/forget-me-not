/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Tabs } from "webextension-polyfill-ts";
import { DEFAULT_COOKIE_STORE_ID } from "../shared";

export class IncognitoWatcher {
    private cookieStores = new Set<string>();
    private tabs = new Set<number>();

    public constructor() {
        this.onCreated = this.onCreated.bind(this);
        this.onRemoved = this.onRemoved.bind(this);
        browser.tabs.query({}).then((tabs) => tabs.forEach(this.onCreated));

        browser.tabs.onRemoved.addListener(this.onRemoved);
        browser.tabs.onCreated.addListener(this.onCreated);
    }

    private onCreated (tab: Tabs.Tab) {
        if (tab.id && tab.incognito) {
            this.tabs.add(tab.id);
            this.cookieStores.add(tab.cookieStoreId || DEFAULT_COOKIE_STORE_ID);
        }
    }

    private onRemoved (tabId: number, removeInfo: Tabs.OnRemovedRemoveInfoType) {
        this.tabs.delete(tabId);
    }

    public hasCookieStore(cookieStoreId: string) {
        return this.cookieStores.has(cookieStoreId);
    }

    public hasTab(tabId: number) {
        return this.tabs.has(tabId);
    }

    // For testing purpose only
    public forceAdd(tabId: number, cookieStoreId: string) {
        this.tabs.add(tabId);
        this.cookieStores.add(cookieStoreId);
    }

    // For testing purpose only
    public forceDelete(tabId: number, cookieStoreId: string) {
        this.tabs.delete(tabId);
        this.cookieStores.delete(cookieStoreId);
    }
}
