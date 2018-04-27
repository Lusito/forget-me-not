/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Tabs, WebNavigation, Runtime, Storage } from "webextension-polyfill-ts";
import { assert } from "chai";

// @ts-ignore
// tslint:disable-next-line:no-var-requires
const parseUrl = require('url').parse;
// @ts-ignore
const glob = (function () { return this; }()) || Function('return this')();
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
            for (const listener of this.listeners) {
                listener.apply(null, args);
            }
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

class BrowserRuntimeMock {
    public onMessage = new ListenerMock<(message: any | undefined, sender: Runtime.MessageSender, sendResponse: () => void) => void>();

    public sendMessage(message: any, options?: Runtime.SendMessageOptionsType): Promise<any> {
        return new Promise((resolve, reject) => {
            this.onMessage.emit(message, { id: 'mock' }, () => undefined);
            resolve();
        });
    }
}

export const clone = (value: any) => JSON.parse(JSON.stringify(value));

class StorageAreaMock {
    public readonly QUOTA_BYTES: 5242880 = 5242880;
    private readonly data: any = {};

    public get(keys?: null | string | string[] | { [s: string]: any }) {
        return new Promise<{ [s: string]: any }>((resolve, reject) => {
            assert.equal(keys, null); // only null supported for now
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
            browserMock.storage.onChanged.emit(changes, 'local');
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
            browserMock.storage.onChanged.emit(changes, 'local');
            resolve();
        });
    }

    public clear() {
        return this.remove(Object.getOwnPropertyNames(this.data));
    }
}

export const browserMock = {
    tabs: new BrowserTabsMock(),
    webNavigation: new BrowserWebNavigationMock(),
    runtime: new BrowserRuntimeMock(),
    storage: {
        local: new StorageAreaMock(),
        onChanged: new ListenerMock<(changes: { [s: string]: Storage.StorageChange }, areaName: string) => void>()
    },
    reset: () => {
        browserMock.tabs.reset();
        browserMock.webNavigation.reset();
        browser.storage.local.clear();
    }
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

export function ensureNotNull<T>(value: T | null): T {
    assert.isNotNull(value);
    // @ts-ignore
    return value;
}
