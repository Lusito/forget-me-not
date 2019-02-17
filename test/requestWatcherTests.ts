/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browserMock } from "./browserMock";
import { createSpy } from "./testHelpers";
import { RequestWatcher } from "../src/background/requestWatcher";
import { describe } from "mocha";
import { quickBeforeRedirectDetails } from "./quickHelpers";

class RequestWatcherSpy {
    public readonly prepareNavigation = createSpy();
    public readonly commitNavigation = createSpy();
    public readonly completeNavigation = createSpy();

    public reset() {
        this.commitNavigation.reset();
        this.commitNavigation.reset();
        this.completeNavigation.reset();
    }
}

describe("Request Watcher", () => {
    const listenerSpy = new RequestWatcherSpy();
    let requestWatcher: RequestWatcher | null = null;

    afterEach(() => {
        requestWatcher = null;
    });

    beforeEach(() => {
        browserMock.reset();
        listenerSpy.reset();
        requestWatcher = new RequestWatcher(listenerSpy);
    });

    describe("listeners", () => {
        it("should add listeners on creation", () => {
            browserMock.webNavigation.onBeforeNavigate.mock.addListener.assertCalls([[(requestWatcher as any).onBeforeNavigate]]);
            browserMock.webNavigation.onCommitted.mock.addListener.assertCalls([[(requestWatcher as any).onCommitted]]);
            browserMock.webNavigation.onCompleted.mock.addListener.assertCalls([[(requestWatcher as any).onCompleted]]);
            browserMock.webRequest.onBeforeRedirect.mock.addListener.assertCalls([
                [(requestWatcher as any).onBeforeRedirect, { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] }]
            ]);
        });
    });

    describe("onBeforeNavigate", () => {
        it("should call listener.prepareNavigation", () => {
            browserMock.webNavigation.onBeforeNavigate.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                parentFrameId: -1,
                timeStamp: -1
            });
            listenerSpy.prepareNavigation.assertCalls([
                [42, 1337, "www.amazon.com"]
            ]);
        });
    });

    describe("onCommitted", () => {
        it("should call listener.prepareNavigation", () => {
            browserMock.webNavigation.onCommitted.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                timeStamp: -1
            });
            listenerSpy.commitNavigation.assertCalls([
                [42, 1337, "www.amazon.com"]
            ]);
        });
    });

    describe("onCompleted", () => {
        it("should call listener.prepareNavigation", () => {
            browserMock.webNavigation.onCompleted.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                timeStamp: -1
            });
            listenerSpy.completeNavigation.assertCalls([
                [42, 1337]
            ]);
        });
    });

    describe("onBeforeRedirect", () => {
        it("should call listener.prepareNavigation", () => {
            browserMock.webRequest.onBeforeRedirect.emit(quickBeforeRedirectDetails("http://www.amazon.de", "http://www.amazon.com", 42, 1337));
            listenerSpy.prepareNavigation.assertCalls([
                [42, 1337, "www.amazon.com"]
            ]);
        });
    });
});
