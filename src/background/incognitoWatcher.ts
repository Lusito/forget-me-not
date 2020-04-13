/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Tabs } from "webextension-polyfill-ts";

import { ExtensionContext } from "../lib/bootstrap";

export class IncognitoWatcher {
    private cookieStores = new Set<string>();

    private tabs = new Set<number>();

    private readonly defaultCookieStoreId: string;

    public constructor(context: ExtensionContext) {
        this.defaultCookieStoreId = context.storeUtils.defaultCookieStoreId;
        browser.tabs.onRemoved.addListener(this.onRemoved);
        browser.tabs.onCreated.addListener(this.onCreated);
    }

    public async initializeExistingTabs() {
        await browser.tabs.query({}).then((tabs) => tabs.forEach(this.onCreated));
    }

    private onCreated = (tab: Tabs.Tab) => {
        if (tab.id && tab.incognito) {
            this.tabs.add(tab.id);
            this.cookieStores.add(tab.cookieStoreId || this.defaultCookieStoreId);
        }
    };

    private onRemoved = (tabId: number) => {
        this.tabs.delete(tabId);
    };

    public hasCookieStore(cookieStoreId: string) {
        return this.cookieStores.has(cookieStoreId);
    }

    public hasTab(tabId: number) {
        return this.tabs.has(tabId);
    }
}
