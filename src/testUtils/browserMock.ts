/* eslint-disable */
/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import {
    ContextualIdentities,
    Cookies,
    History,
    Tabs,
    ExtensionTypes,
    WebNavigation,
    WebRequest,
    Runtime,
    Storage,
    BrowsingData,
} from "webextension-polyfill-ts";

import { clone } from "./testHelpers";

type ListenerCallback = (...args: any[]) => any;
// tslint:disable-next-line:ban-types
class ListenerMock<T extends Function> {
    private listeners: ListenerCallback[] = [];

    public emit: T;

    public readonly mock: { [s: string]: jest.Mock };

    public constructor() {
        // @ts-ignore
        this.emit = (...args) => {
            const results = [];
            for (const listener of this.listeners) {
                results.push(listener.apply(null, args));
            }
            return results;
        };

        this.mock = {
            addListener: jest.fn((listener: ListenerCallback) => {
                this.listeners.push(listener);
            }),
            removeListener: jest.fn((listener: ListenerCallback) => {
                this.listeners = this.listeners.filter((cb) => listener !== cb);
            }),
            hasListener: jest.fn((listener: ListenerCallback) => {
                return this.listeners.includes(listener);
            }),
            hasListeners: jest.fn(() => {
                return this.listeners.length > 0;
            }),
        };
    }

    public reset() {
        this.listeners.length = 0;
        for (const key in this.mock) this.mock[key].mockClear();
    }
}

class BrowsingDataMock {
    public remove = jest.fn();

    public reset() {
        this.remove.mockClear();
    }
}

class BrowserContextualIdentitiesMock {
    public contextualIdentities: ContextualIdentities.ContextualIdentity[] = [];

    public reset() {
        this.contextualIdentities = [];
    }

    public query(details: ContextualIdentities.QueryDetailsType): Promise<ContextualIdentities.ContextualIdentity[]> {
        return Promise.resolve(clone(this.contextualIdentities));
    }
}

const DOMAIN_PATH_SPLIT = /\/(.*)/;

class BrowserCookiesMock {
    private readonly cookies: Cookies.Cookie[] = [];

    public remove = jest.fn(this._remove);

    public set = jest.fn(this._set);

    public getAll = jest.fn(this._getAll);

    public getAllCookieStores = jest.fn(this._getAllCookieStores);

    public cookieStores: Cookies.CookieStore[] = [];

    public onChanged = new ListenerMock<(changeInfo: Cookies.OnChangedChangeInfoType) => void>();

    public reset() {
        this.cookies.length = 0;
        this.remove.mockClear();
        this.set.mockClear();
        this.getAll.mockClear();
        this.getAllCookieStores.mockClear();
        this.cookieStores = [];
        this.onChanged.reset();
    }

    public resetCookies() {
        this.cookies.length = 0;
    }

    private findCookie(
        name: string,
        secure: boolean,
        domain: string,
        path: string,
        storeId: string,
        firstPartyDomain?: string
    ) {
        let cookies = firstPartyDomain
            ? this.cookies.filter((c) => c.firstPartyDomain === firstPartyDomain)
            : this.cookies;
        cookies = cookies.filter(
            (c) =>
                c.secure === secure &&
                c.path === path &&
                c.storeId === storeId &&
                c.name === name &&
                c.domain === domain
        );
        if (cookies.length === 1) return cookies[0];
        return null;
    }

    private _set(details: Cookies.SetDetailsType) {
        let cookie = this.findCookie(
            details.name ?? "",
            details.secure || false,
            details.domain ?? "",
            details.path ?? "",
            details.storeId || "firefox-default",
            details.firstPartyDomain
        );
        if (cookie) {
            cookie.value = details.value ?? "";
        } else {
            cookie = {
                name: details.name ?? "",
                value: details.value ?? "",
                domain: details.domain ?? "",
                hostOnly: false,
                path: details.path ?? "",
                secure: details.secure || false,
                httpOnly: false,
                session: false,
                storeId: details.storeId || "firefox-default",
                firstPartyDomain: details.firstPartyDomain ?? "",
                sameSite: "no_restriction",
            };
            this.cookies.push(cookie);
        }
        this.onChanged.emit({
            removed: false,
            cookie: clone(cookie),
            cause: "explicit",
        });
        return Promise.resolve(clone(cookie));
    }

    private _remove(details: Cookies.RemoveDetailsType) {
        const secure = details.url.startsWith("https://");
        const withoutProtocol = details.url.substr(secure ? 8 : 7);
        const parts = withoutProtocol.split(DOMAIN_PATH_SPLIT);
        const domain = parts[0].toLowerCase();
        const path = domain === "" ? withoutProtocol : parts[1] || "";
        const cookie = this.findCookie(
            details.name || "",
            secure,
            domain,
            path,
            details.storeId || "firefox-default",
            details.firstPartyDomain
        );
        if (cookie) {
            const index = this.cookies.indexOf(cookie);
            this.cookies.splice(index, 1);
            this.onChanged.emit({
                removed: true,
                cookie: clone(cookie),
                cause: "explicit",
            });
            return Promise.resolve({
                url: details.url,
                name: details.name,
                storeId: cookie.storeId,
                firstPartyDomain: cookie.firstPartyDomain,
            });
        }
        return Promise.reject(`Was not able to find mocked cookie '${details.name}'`);
    }

    private _getAll(details: Cookies.GetAllDetailsType) {
        // Mocking only supports limited functionality right now
        expect(details.firstPartyDomain).toBeNull();
        expect(details.storeId).not.toBeNull();
        expect(Object.keys(details)).toHaveSameMembers(["firstPartyDomain", "storeId"]);
        const cookies = this.cookies.filter((c) => c.storeId === details.storeId);
        return Promise.resolve(clone(cookies));
    }

    private _getAllCookieStores() {
        return Promise.resolve(clone(this.cookieStores));
    }
}

class BrowserHistoryMock {
    public onVisited = new ListenerMock<(result: History.HistoryItem) => void>();

    public deleteUrl = jest.fn();

    public search = jest.fn(this._search.bind(this));

    public readonly items: History.HistoryItem[] = [];

    public reset() {
        this.onVisited.reset();
        this.deleteUrl.mockClear();
        this.search.mockClear();
        this.items.length = 0;
    }

    private _search(query: History.SearchQueryType): Promise<History.HistoryItem[]> {
        return Promise.resolve(clone(this.items));
    }
}

class BrowserTabsMock {
    private idCount = 0;

    private tabs: Tabs.Tab[] = [];

    public onRemoved = new ListenerMock<(tabId: number, removeInfo: Tabs.OnRemovedRemoveInfoType) => void>();

    public onCreated = new ListenerMock<(tab: Tabs.Tab) => void>();

    public executeScriptSuccess = false;

    public executeScript = jest.fn(this._executeScript);

    public reset() {
        this.tabs.length = 0;
        this.onRemoved.reset();
        this.onCreated.reset();
        this.executeScript.mockClear();
        this.executeScriptSuccess = false;
    }

    public get(tabId: number) {
        const tab = this.tabs.find((t) => t.id === tabId);
        if (tab) {
            return Promise.resolve(clone(tab));
        }
        return Promise.reject("Tab doesn't exist");
    }

    public getTabs() {
        return this.tabs;
    }

    public byId(tabId: number) {
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
            windowId: 1,
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
        while (i < this.tabs.length) this.tabs[i].index = i++;
    }

    public query(queryInfo: Tabs.QueryQueryInfoType) {
        return {
            then(resolve: (tabs: Tabs.Tab[]) => void) {
                resolve(browserMock.tabs.getTabs());
            },
        };
    }

    public _executeScript(tabId: number | undefined, details: ExtensionTypes.InjectDetails) {
        if (this.executeScriptSuccess) {
            return Promise.resolve([]);
        }
        return Promise.reject({});
    }
}

class BrowserWebNavigationMock {
    public onBeforeNavigate = new ListenerMock<(details: WebNavigation.OnBeforeNavigateDetailsType) => void>();

    public onCommitted = new ListenerMock<(details: WebNavigation.OnCommittedDetailsType) => void>();

    public onCompleted = new ListenerMock<(details: WebNavigation.OnCompletedDetailsType) => void>();

    public reset() {
        this.onBeforeNavigate.reset();
        this.onCommitted.reset();
        this.onCompleted.reset();
    }

    public beforeNavigate(tabId: number, url: string) {
        const tab = browserMock.tabs.byId(tabId);
        expect(tab).toBeDefined();
        if (tab) {
            this.onBeforeNavigate.emit({
                tabId,
                url,
                timeStamp: Date.now(),
                frameId: 0,
                parentFrameId: 0,
            });
        }
    }

    public commit(tabId: number, url: string) {
        const tab = browserMock.tabs.byId(tabId);
        expect(tab).toBeDefined();
        if (tab) {
            tab.url = url;
            this.onCommitted.emit({
                tabId,
                url,
                timeStamp: Date.now(),
                frameId: 0,
            });
        }
    }

    public complete(tabId: number, url: string) {
        const tab = browserMock.tabs.byId(tabId);
        expect(tab).toBeDefined();
        if (tab) {
            tab.url = url;
            this.onCompleted.emit({
                tabId,
                url,
                timeStamp: Date.now(),
                frameId: 0,
            });
        }
    }
}

class BrowserWebRequestMock {
    public onHeadersReceived = new ListenerMock<
        (details: WebRequest.OnHeadersReceivedDetailsType) => Array<WebRequest.BlockingResponse | undefined>
    >();

    public onBeforeRedirect = new ListenerMock<(details: WebRequest.OnBeforeRedirectDetailsType) => void>();

    public reset() {
        this.onHeadersReceived.reset();
        this.onBeforeRedirect.reset();
    }

    public headersReceived(details: WebRequest.OnHeadersReceivedDetailsType) {
        return this.onHeadersReceived.emit(details);
    }

    public beforeRedirect(details: WebRequest.OnBeforeRedirectDetailsType) {
        return this.onBeforeRedirect.emit(details);
    }
}

class BrowserRuntimeMock {
    public onMessage = new ListenerMock<
        (message: any | undefined, sender: Runtime.MessageSender, sendResponse: () => void) => void
    >();

    public reset() {
        this.onMessage.reset();
    }

    public sendMessage(message: any, options?: Runtime.SendMessageOptionsType): Promise<any> {
        this.onMessage.emit(message, { id: "mock" }, () => undefined);
        return Promise.resolve();
    }

    public getManifest() {
        return {
            version: "2.0.0",
        };
    }
}

class StorageAreaMock {
    public readonly QUOTA_BYTES: 5242880 = 5242880;

    private readonly data: any = {};

    public get(keys?: null | string | string[] | { [s: string]: any }) {
        expect(keys).toBeNull(); // only null supported for now
        return Promise.resolve(clone(this.data));
    }

    private setInternal(key: string, newValue: any, changes: { [key: string]: Storage.StorageChange }) {
        if (!this.data.hasOwnProperty(key)) {
            this.data[key] = clone(newValue);
            changes[key] = { newValue: clone(newValue) };
        } else if (JSON.stringify(this.data[key]) !== JSON.stringify(newValue)) {
            const oldValue = this.data[key];
            this.data[key] = clone(newValue);
            changes[key] = { oldValue: clone(oldValue), newValue: clone(newValue) };
        }
    }

    public set(items: Storage.StorageAreaSetItemsType) {
        const changes: { [s: string]: Storage.StorageChange } = {};
        for (const key in items) {
            // @ts-ignore
            const value = items[key];
            this.setInternal(key, value, changes);
        }
        browserMock.storage.onChanged.emit(changes, "local");
        return Promise.resolve();
    }

    private removeInternal(key: string, changes: { [key: string]: Storage.StorageChange }) {
        if (this.data.hasOwnProperty(key)) {
            const oldValue = this.data[key];
            changes[key] = { oldValue: clone(oldValue) };
            delete this.data[key];
        }
    }

    public remove(keys: string | string[]) {
        const changes: { [s: string]: Storage.StorageChange } = {};
        if (typeof keys === "string") this.removeInternal(keys, changes);
        else {
            for (const key of keys) this.removeInternal(key, changes);
        }
        browserMock.storage.onChanged.emit(changes, "local");
        return Promise.resolve();
    }

    public clear() {
        return this.remove(Object.getOwnPropertyNames(this.data));
    }

    public reset() {
        for (const key in this.data) delete this.data[key];
    }
}

const browserMock = {
    browsingData: new BrowsingDataMock(),
    cookies: new BrowserCookiesMock(),
    history: new BrowserHistoryMock(),
    contextualIdentities: new BrowserContextualIdentitiesMock(),
    tabs: new BrowserTabsMock(),
    webNavigation: new BrowserWebNavigationMock(),
    webRequest: new BrowserWebRequestMock(),
    runtime: new BrowserRuntimeMock(),
    storage: {
        local: new StorageAreaMock(),
        onChanged: new ListenerMock<(changes: { [s: string]: Storage.StorageChange }, areaName: string) => void>(),
    },
    reset: () => {
        browserMock.browsingData.reset();
        browserMock.cookies.reset();
        browserMock.history.reset();
        browserMock.contextualIdentities.reset();
        browserMock.tabs.reset();
        browserMock.webNavigation.reset();
        browserMock.webRequest.reset();
        browserMock.runtime.reset();
        browserMock.storage.local.reset();
    },
};

export type BrowserMock = typeof browserMock;

(window as any).browserMock = browserMock;

function bindMocks<DT>(source: any, keys: Array<keyof DT>) {
    const destination = {} as any;
    for (const key of keys) {
        let mock = source[key];
        if (typeof mock === "function") mock = mock.bind(source);
        else if (mock.constructor.name === "ListenerMock") mock = mock.mock;
        (destination as any)[key] = mock;
    }
    return destination;
}

export const browser = {
    browsingData: bindMocks<BrowsingData.Static>(browserMock.browsingData, ["remove"]),
    cookies: bindMocks<Cookies.Static>(browserMock.cookies, [
        "getAll",
        "set",
        "remove",
        "getAllCookieStores",
        "onChanged",
    ]),
    history: bindMocks<History.Static>(browserMock.history, ["onVisited", "deleteUrl", "search"]),
    contextualIdentities: bindMocks<ContextualIdentities.Static>(browserMock.contextualIdentities, ["query"]),
    tabs: bindMocks<Tabs.Static>(browserMock.tabs, ["get", "query", "onRemoved", "onCreated", "executeScript"]),
    webNavigation: bindMocks<WebNavigation.Static>(browserMock.webNavigation, [
        "onBeforeNavigate",
        "onCommitted",
        "onCompleted",
    ]),
    webRequest: bindMocks<WebRequest.Static>(browserMock.webRequest, ["onHeadersReceived", "onBeforeRedirect"]),
    runtime: bindMocks<Runtime.Static>(browserMock.runtime, ["onMessage", "sendMessage", "getManifest"]),
    storage: bindMocks<Storage.Static>(browserMock.storage, ["onChanged", "local"]),
};
