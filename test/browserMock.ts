/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Tabs, WebNavigation, Runtime, Storage, WebRequest, Cookies } from "webextension-polyfill-ts";
import { assert } from "chai";

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

const DOMAIN_PATH_SPLIT = /\/(.*)/;

class BrowserCookiesMock {
    private readonly cookies: Cookies.Cookie[] = [];

    public reset() {
        this.cookies.length = 0;
    }

    private findCookie(name: string, secure: boolean, domain: string, path: string, storeId: string, firstPartyDomain?: string) {
        let cookies = firstPartyDomain ? this.cookies.filter((c) => c.firstPartyDomain === firstPartyDomain) : this.cookies;
        cookies = cookies.filter((c) => c.secure === secure && c.path === path && c.storeId === storeId && c.name === name && c.domain === domain);
        if (cookies.length === 1)
            return cookies[0];
        return null;
    }

    public set(details: Cookies.SetDetailsType) {
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
                    firstPartyDomain: details.firstPartyDomain || ""
                };
                this.cookies.push(cookie);
            }
            resolve(clone(cookie));
        });
    }

    public remove(details: Cookies.RemoveDetailsType) {
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

    public getAll(details: Cookies.GetAllDetailsType) {
        // Mocking only supports limited functionality right now
        assert.isNull(details.firstPartyDomain);
        assert.isNotNull(details.storeId);
        assert.hasAllKeys(details, ["firstPartyDomain", "storeId"]);
        return new Promise<Cookies.Cookie[]>((resolve, reject) => {
            const cookies = this.cookies.filter((c) => c.storeId === details.storeId);
            resolve(clone(cookies));
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

    public getTabs(): Tabs.Tab[] {
        return this.tabs;
    }

    public get(tabId: number): Tabs.Tab | undefined {
        return this.tabs.find((ti) => ti.id === tabId);
    }

    public create(url: string, cookieStoreId: string) {
        const id = ++this.idCount;
        const tab: Tabs.Tab = {
            active: true,
            cookieStoreId,
            highlighted: false,
            id,
            incognito: false,
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
}

class BrowserWebNavigationMock {
    public onBeforeNavigate = new ListenerMock<(details: WebNavigation.OnBeforeNavigateDetailsType) => void>();
    public onCommitted = new ListenerMock<(details: WebNavigation.OnCommittedDetailsType) => void>();

    public reset() {
        this.onBeforeNavigate.reset();
        this.onCommitted.reset();
    }

    public beforeNavigate(tabId: number, url: string) {
        const tab = browserMock.tabs.get(tabId);
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
        const tab = browserMock.tabs.get(tabId);
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
}

export const browserMock = {
    cookies: new BrowserCookiesMock(),
    tabs: new BrowserTabsMock(),
    webNavigation: new BrowserWebNavigationMock(),
    webRequest: new BrowserWebRequestMock(),
    runtime: new BrowserRuntimeMock(),
    storage: {
        local: new StorageAreaMock(),
        onChanged: new ListenerMock<(changes: { [s: string]: Storage.StorageChange }, areaName: string) => void>()
    },
    reset: () => {
        browserMock.cookies.reset();
        browserMock.tabs.reset();
        browserMock.webNavigation.reset();
        browser.storage.local.clear();
    }
};

// @ts-ignore
browser.cookies = {
    getAll: browserMock.cookies.getAll.bind(browserMock.cookies),
    set: browserMock.cookies.set.bind(browserMock.cookies),
    remove: browserMock.cookies.remove.bind(browserMock.cookies)
};

// @ts-ignore
browser.tabs = {
    query: () => {
        return {
            then(resolve: (tabs: Tabs.Tab[]) => void) {
                resolve(browserMock.tabs.getTabs());
            }
        };
    },
    onRemoved: browserMock.tabs.onRemoved.get(),
    onCreated: browserMock.tabs.onCreated.get()
};

// @ts-ignore
browser.webNavigation = {
    onBeforeNavigate: browserMock.webNavigation.onBeforeNavigate.get(),
    onCommitted: browserMock.webNavigation.onCommitted.get()
};

// @ts-ignore
browser.webRequest = {
    onHeadersReceived: browserMock.webRequest.onHeadersReceived.get()
};

// @ts-ignore
browser.runtime = {
    onMessage: browserMock.runtime.onMessage.get(),
    sendMessage: browserMock.runtime.sendMessage.bind(browserMock.runtime)
};

// @ts-ignore
browser.storage = {
    onChanged: browserMock.storage.onChanged.get(),
    local: browserMock.storage.local
};

export interface SpyData {
    (...args: any[]): any;
    callCount: number;
    thisValues: any[];
    args: any[][];
    assertCalls: (args: any[], thisValues?: any[]) => void;
    assertNoCall: () => void;
    reset: () => void;
}
export function createSpy() {
    const spyData = function (...args: any[]) {
        spyData.callCount++;
        // @ts-ignore
        spyData.thisValues.push(this);
        spyData.args.push(Array.from(args));
    } as SpyData;
    spyData.callCount = 0;
    spyData.thisValues = [];
    spyData.args = [];
    spyData.assertCalls = (args, thisValues?) => {
        assert.deepEqual(spyData.args, args);
        if (thisValues)
            assert.deepEqual(spyData.thisValues, thisValues);
        spyData.reset();
    };
    spyData.assertNoCall = () => {
        assert.equal(spyData.callCount, 0);
    };

    spyData.reset = () => {
        spyData.callCount = 0;
        spyData.thisValues.length = 0;
        spyData.args.length = 0;
    };
    return spyData;
}

export const clone = (value: any) => JSON.parse(JSON.stringify(value));

export function ensureNotNull<T>(value: T | null): T {
    assert.isNotNull(value);
    // @ts-ignore
    return value;
}

// tslint:disable-next-line:ban-types
export function doneHandler<T extends Function>(handler: T, done: (error?: any) => void, doneCondition?: () => boolean) {
    return (...args: any[]) => {
        try {
            handler.apply(null, args);
            if (!doneCondition || doneCondition())
                done();
        } catch (e) {
            done(e);
        }
    };
}
