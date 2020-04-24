/* eslint-disable max-classes-per-file */
/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { Browser, Events } from "webextension-polyfill-ts";

import { deepMock } from "./deepMock";
import { DeepMockNode } from "./deepMockNode";
import { DeepMock } from "./deepMockTypes";

export class EventMock<T extends (...args: any[]) => any> {
    private listeners: Function[] = [];

    private disabled = false;

    private prefix: string;

    public constructor(prefix: string) {
        this.prefix = prefix;
    }

    public addListener = jest.fn((callback: Function) => {
        this.disabledCheck("addListener");
        this.listeners.push(callback);
    });

    public removeListener = jest.fn((callback: Function) => {
        this.disabledCheck("removeListener");
        this.listeners = this.listeners.filter((listener) => listener !== callback);
    });

    public hasListener = jest.fn((callback: Function) => {
        this.disabledCheck("hasListener");
        return this.listeners.includes(callback);
    });

    public hasListeners = jest.fn(() => {
        this.disabledCheck("hasListeners");
        return this.listeners.length > 0;
    });

    public disable() {
        this.disabled = true;
    }

    public emit = jest.fn((...args: Parameters<T>) => {
        this.listeners.forEach((listener) => listener(...args));
    });

    private disabledCheck(what: string) {
        if (this.disabled)
            throw new Error(
                `Mock "${this.prefix}.${what}" has been used after tests have finished! You might have a memory leak there.`
            );
    }
}

export type MockEventParameters<T> = T extends (...args: any[]) => any ? Parameters<T> : any[];

export type MockEventFunction<T> = T extends Events.Event<infer TFun>
    ? (...args: MockEventParameters<TFun>) => void
    : (...args: any[]) => void;

export type EventMockOf<T> = T extends DeepMock<infer TD> ? EventMock<MockEventFunction<TD>> : unknown;

export function mockEvent<T>(builder: DeepMock<T>) {
    const mock = new EventMock<MockEventFunction<T>>(builder.mockPath);
    builder.mock(mock as any);
    return mock;
}

export const mockBrowserNode = new DeepMockNode("browser");

export const browser = mockBrowserNode.getProxy() as Browser;

(window as any).mockBrowser = deepMock<Browser>(mockBrowserNode);

beforeEach(() => {
    mockBrowserNode.enable();
});

afterEach(() => {
    mockBrowserNode.verifyAndDisable();
});
