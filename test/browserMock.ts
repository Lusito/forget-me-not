/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Tabs, WebNavigation, Runtime, Storage, WebRequest, Cookies, ContextualIdentities } from "webextension-polyfill-ts";
import { assert } from "chai";
import { createSpy, clone } from "./testHelpers";

// @ts-ignore
// tslint:disable-next-line:no-var-requires
const parseUrl = require("url").parse;
// @ts-ignore
const glob = (function () { return this; }()) || Function("return this")();
glob.URL = function (url: string) {
    const parsed = parseUrl(url);
    for (const key in parsed) {
        if (parsed.hasOwnProperty(key))
            this[key] = parsed[key];
    }
};

type ListenerCallback = (...args: any[]) => any;
// tslint:disable-next-line:ban-types
class ListenerMock<T extends Function> {
    private listeners: ListenerCallback[] = [];
    public emit: T;
    public constructor() {
        // @ts-ignore
        this.emit = (...args) => {
            const results = [];
            for (const listener of this.listeners) {
                results.push(listener.apply(null, args));
            }
            return results;
        };
    }

    public get() {
        return {
            addListener: (listener: ListenerCallback) => {
                this.listeners.push(listener);
            },
            removeListener: (listener: ListenerCallback) => {
                this.listeners = this.listeners.filter((cb) => listener !== cb);
            },
            hasListener: (listener: ListenerCallback) => {
                return this.listeners.indexOf(listener) >= 0;
            },
            hasListeners: () => {
                return this.listeners.length > 0;
            }
        };
    }

    public reset() {
        this.listeners.length = 0;
    }
}

class BrowsingDataMock {
    public remove = createSpy();

    public reset() {
        this.remove.reset();
    }
}

class BrowserContextualIdentitiesMock {
    public contextualIdentities: ContextualIdentities.ContextualIdentity[] = [];

    public reset() {
        this.contextualIdentities = [];
    }

    public query(details: ContextualIdentities.QueryDetailsType): Promise<ContextualIdentities.ContextualIdentity[]> {
        return new Promise<ContextualIdentities.ContextualIdentity[]>((resolve, reject) => {
            resolve(clone(this.contextualIdentities));
        });
    }
}

const DOMAIN_PATH_SPLIT = /\/(.*)/;

class BrowserCookiesMock {
    private readonly cookies: Cookies.Cookie[] = [];
    public remove = createSpy(this._remove);
    public set = createSpy(this._set);
    public getAll = createSpy(this._getAll);
    public getAllCookieStores = createSpy(this._getAllCookieStores);
    public cookieStores: Cookies.CookieStore[] = [];

    public reset() {
        this.cookies.length = 0;
        this.remove.reset();
        this.set.reset();
        this.getAll.reset();
        this.cookieStores = [];
    }

    private findCookie(name: string, secure: boolean, domain: string, path: string, storeId: string, firstPartyDomain?: string) {
        let cookies = firstPartyDomain ? this.cookies.filter((c) => c.firstPartyDomain === firstPartyDomain) : this.cookies;
        cookies = cookies.filter((c) => c.secure === secure && c.path === path && c.storeId === storeId && c.name === name && c.domain === domain);
        if (cookies.length === 1)
            return cookies[0];
        return null;
    }

    private _set(details: Cookies.SetDetailsType) {
        return new Promise<Cookies.Cookie>((resolve, reject) => {
            let cookie = this.findCookie(details.name || "", details.secure || false, details.domain || "", details.path || "", details.storeId || "firefox-default", details.firstPartyDomain);
            if (cookie) {
                cookie.value = details.value || "";
            } else {
                cookie = {
                    name: details.name || "",
                    value: details.value || "",
                    domain: details.domain || "",
                    hostOnly: false,
                    path: details.path || "",
                    secure: details.secure || false,
                    httpOnly: false,
                    session: false,
                    storeId: details.storeId || "firefox-default",
                    firstPartyDomain: details.firstPartyDomain || "",
                    sameSite: "no_restriction"
                };
                this.cookies.push(cookie);
            }
            resolve(clone(cookie));
        });
    }

    private _remove(details: Cookies.RemoveDetailsType) {
        return new Promise<Cookies.RemoveCallbackDetailsType>((resolve, reject) => {
            const secure = details.url.startsWith("https://");
            const withoutProtocol = details.url.substr(secure ? 8 : 7);
            const parts = withoutProtocol.split(DOMAIN_PATH_SPLIT);
            const domain = parts[0].toLowerCase();
            const path = parts[1] || "";
            const cookie = this.findCookie(details.name || "", secure, domain, path, details.storeId || "firefox-default", details.firstPartyDomain);
            if (cookie) {
                const index = this.cookies.indexOf(cookie);
                this.cookies.splice(index, 1);
                resolve({
                    url: details.url,
                    name: details.name,
                    storeId: cookie.storeId,
                    firstPartyDomain: cookie.firstPartyDomain
                });
            } else {
                reject(null);
            }
        });
    }

    private _getAll(details: Cookies.GetAllDetailsType) {
        // Mocking only supports limited functionality right now
        assert.isNull(details.firstPartyDomain);
        assert.isNotNull(details.storeId);
        assert.hasAllKeys(details, ["firstPartyDomain", "storeId"]);
        return new Promise<Cookies.Cookie[]>((resolve, reject) => {
            const cookies = this.cookies.filter((c) => c.storeId === details.storeId);
            resolve(clone(cookies));
        });
    }

    private _getAllCookieStores() {
        return new Promise<Cookies.CookieStore[]>((resolve, reject) => {
            resolve(clone(this.cookieStores));
        });
    }
}

class BrowserTabsMock {
    private idCount = 0;
    private tabs: Tabs.Tab[] = [];
    public onRemoved = new ListenerMock<(tabId: number, removeInfo: Tabs.OnRemovedRemoveInfoType) => void>();
    public onCreated = new ListenerMock<(tab: Tabs.Tab) => void>();

    public reset() {
        this.tabs.length = 0;
        this.onRemoved.reset();
        this.onCreated.reset();
    }

    public get(tabId: number) {
        return new Promise<Tabs.Tab>((resolve, reject) => {
            const tab = this.tabs.find((t) => t.id === tabId);
            if (tab) {
                resolve(clone(tab));
            } else {
                reject("Tab doesn't exist");
            }
        });
    }

    public getTabs(): Tabs.Tab[] {
        return this.tabs;
    }

    public byId(tabId: number): Tabs.Tab | undefined {
        return this.tabs.find((ti) => ti.id === tabId);
    }

    public create(url: string, cookieStoreId: string, incognito = false) {
        const id = ++this.idCount;
        const tab: Tabs.Tab = {
            active: true,
            cookieStoreId,
            highlighted: false,
            id,
            incognito,
            index: this.tabs.length,
            isArticle: false,
            isInReaderMode: false,
            lastAccessed: Date.now(),
            pinned: false,
            url,
            windowId: 1
        };
        this.tabs.push(tab);
        browserMock.tabs.onCreated.emit(tab);
        return id;
    }

    public remove(tabId: number) {
        let i = 0;
        while (i < this.tabs.length) {
            if (this.tabs[i].id === tabId) {
                this.onRemoved.emit(tabId, { windowId: this.tabs[i].windowId || -1, isWindowClosing: false });
                this.tabs.splice(i, 1);
                break;
            }
            i++;
        }
        while (i < this.tabs.length)
            this.tabs[i].index = i++;
    }

    public query(queryInfo: Tabs.QueryQueryInfoType) {
        return {
            then(resolve: (tabs: Tabs.Tab[]) => void) {
                resolve(browserMock.tabs.getTabs());
            }
        };
    }
}

class BrowserWebNavigationMock {
    public onBeforeNavigate = new ListenerMock<(details: WebNavigation.OnBeforeNavigateDetailsType) => void>();
    public onCommitted = new ListenerMock<(details: WebNavigation.OnCommittedDetailsType) => void>();

    public reset() {
        this.onBeforeNavigate.reset();
        this.onCommitted.reset();
    }

    public beforeNavigate(tabId: number, url: string) {
        const tab = browserMock.tabs.byId(tabId);
        assert.isDefined(tab);
        if (tab) {
            this.onBeforeNavigate.emit({
                tabId,
                url,
                timeStamp: Date.now(),
                frameId: 0,
                parentFrameId: 0
            });
        }
    }

    public commit(tabId: number, url: string) {
        const tab = browserMock.tabs.byId(tabId);
        assert.isDefined(tab);
        if (tab) {
            tab.url = url;
            this.onCommitted.emit({
                tabId,
                url,
                timeStamp: Date.now(),
                frameId: 0
            });
        }
    }
}

class BrowserWebRequestMock {
    // Fixme: polyfill doesn't set WebRequest.BlockingResponse as return value..
    public onHeadersReceived = new ListenerMock<(details: WebRequest.OnHeadersReceivedDetailsType) => WebRequest.BlockingResponse>();

    public headersReceived(details: WebRequest.OnHeadersReceivedDetailsType): WebRequest.BlockingResponse[] {
        return this.onHeadersReceived.emit(details) as WebRequest.BlockingResponse[];
    }
}

class BrowserRuntimeMock {
    public onMessage = new ListenerMock<(message: any | undefined, sender: Runtime.MessageSender, sendResponse: () => void) => void>();

    public sendMessage(message: any, options?: Runtime.SendMessageOptionsType): Promise<any> {
        return new Promise((resolve, reject) => {
            this.onMessage.emit(message, { id: "mock" }, () => undefined);
            resolve();
        });
    }
}

class StorageAreaMock {
    public readonly QUOTA_BYTES: 5242880 = 5242880;
    private readonly data: any = {};

    public get(keys?: null | string | string[] | { [s: string]: any }) {
        assert.equal(keys, null); // only null supported for now
        return new Promise<{ [s: string]: any }>((resolve, reject) => {
            resolve(clone(this.data));
        });
    }

    private setInternal(key: string, newValue: any, changes: { [key: string]: Storage.StorageChange }) {
        if (!this.data.hasOwnProperty(key)) {
            this.data[key] = clone(newValue);
            changes[key] = { newValue: clone(newValue) };
        }
        else if (JSON.stringify(this.data[key]) !== JSON.stringify(newValue)) {
            const oldValue = this.data[key];
            this.data[key] = clone(newValue);
            changes[key] = { oldValue: clone(oldValue), newValue: clone(newValue) };
        }
    }

    public set(items: Storage.StorageAreaSetItemsType) {
        return new Promise<void>((resolve, reject) => {
            const changes: { [s: string]: Storage.StorageChange } = {};
            for (const key in items) {
                // @ts-ignore
                const value = items[key];
                this.setInternal(key, value, changes);
            }
            browserMock.storage.onChanged.emit(changes, "local");
            resolve();
        });
    }

    private removeInternal(key: string, changes: { [key: string]: Storage.StorageChange }) {
        if (this.data.hasOwnProperty(key)) {
            const oldValue = this.data[key];
            changes[key] = { oldValue: clone(oldValue) };
            delete this.data[key];
        }
    }

    public remove(keys: string | string[]) {
        return new Promise<void>((resolve, reject) => {
            const changes: { [s: string]: Storage.StorageChange } = {};
            if (typeof (keys) === "string")
                this.removeInternal(keys, changes);
            else {
                for (const key of keys)
                    this.removeInternal(key, changes);
            }
            browserMock.storage.onChanged.emit(changes, "local");
            resolve();
        });
    }

    public clear() {
        return this.remove(Object.getOwnPropertyNames(this.data));
    }

    public reset() {
        for (const key in this.data)
            delete this.data[key];
    }
}

export const browserMock = {
    browsingData: new BrowsingDataMock(),
    cookies: new BrowserCookiesMock(),
    contextualIdentities: new BrowserContextualIdentitiesMock(),
    tabs: new BrowserTabsMock(),
    webNavigation: new BrowserWebNavigationMock(),
    webRequest: new BrowserWebRequestMock(),
    runtime: new BrowserRuntimeMock(),
    storage: {
        local: new StorageAreaMock(),
        onChanged: new ListenerMock<(changes: { [s: string]: Storage.StorageChange }, areaName: string) => void>()
    },
    reset: () => {
        browserMock.browsingData.reset();
        browserMock.cookies.reset();
        browserMock.contextualIdentities.reset();
        browserMock.tabs.reset();
        browserMock.webNavigation.reset();
        browserMock.storage.local.reset();
    }
};

function mockMethods<DT>(destination: DT, source: any, keys: Array<keyof DT>) {
    if (!destination) destination = {} as any;
    for (const key of keys) {
        let mock = source[key];
        if (typeof (mock.get) === "function")
            mock = mock.get();
        else
            mock = mock.bind(source);
        (destination as any)[key] = mock;
    }
    return destination;
}

browser.browsingData = mockMethods(browser.browsingData, browserMock.browsingData, ["remove"]);
browser.cookies = mockMethods(browser.cookies, browserMock.cookies, ["getAll", "set", "remove", "getAllCookieStores"]);
browser.contextualIdentities = mockMethods(browser.contextualIdentities, browserMock.contextualIdentities, ["query"]);
browser.tabs = mockMethods(browser.tabs, browserMock.tabs, ["get", "query", "onRemoved", "onCreated"]);
browser.webNavigation = mockMethods(browser.webNavigation, browserMock.webNavigation, ["onBeforeNavigate", "onCommitted"]);
browser.webRequest = mockMethods(browser.webRequest, browserMock.webRequest, ["onHeadersReceived"]);
browser.runtime = mockMethods(browser.runtime, browserMock.runtime, ["onMessage", "sendMessage"]);
browser.webRequest = mockMethods(browser.webRequest, browserMock.webRequest, ["onHeadersReceived"]);
browser.storage = mockMethods(browser.storage, browserMock.storage, ["onChanged"]);
browser.storage.local = browserMock.storage.local;
