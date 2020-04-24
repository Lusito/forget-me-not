/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { RequestWatcher } from "./requestWatcher";
import { quickBeforeRedirectDetails } from "../testUtils/quickHelpers";
import { testContext, mockContext } from "../testUtils/mockContext";
import { mockEvent, EventMockOf } from "../testUtils/mockBrowser";

class RequestWatcherSpy {
    public readonly prepareNavigation = jest.fn();

    public readonly commitNavigation = jest.fn();

    public readonly completeNavigation = jest.fn();

    public reset() {
        this.prepareNavigation.mockClear();
        this.commitNavigation.mockClear();
        this.completeNavigation.mockClear();
    }
}

describe("Request Watcher", () => {
    const listenerSpy = new RequestWatcherSpy();
    let requestWatcher: RequestWatcher | null = null;
    let onBeforeNavigate: EventMockOf<typeof mockBrowser.webNavigation.onBeforeNavigate>;
    let onCommitted: EventMockOf<typeof mockBrowser.webNavigation.onCommitted>;
    let onCompleted: EventMockOf<typeof mockBrowser.webNavigation.onCompleted>;
    let onBeforeRedirect: EventMockOf<typeof mockBrowser.webRequest.onBeforeRedirect>;

    afterEach(() => {
        requestWatcher = null;
    });

    beforeEach(() => {
        listenerSpy.reset();
        onBeforeNavigate = mockEvent(mockBrowser.webNavigation.onBeforeNavigate);
        onCommitted = mockEvent(mockBrowser.webNavigation.onCommitted);
        onCompleted = mockEvent(mockBrowser.webNavigation.onCompleted);
        onBeforeRedirect = mockEvent(mockBrowser.webRequest.onBeforeRedirect);
        requestWatcher = new RequestWatcher(listenerSpy, testContext);
    });

    describe("listeners", () => {
        it("should add listeners on creation", () => {
            expect(onBeforeNavigate.addListener.mock.calls).toEqual([[(requestWatcher as any).onBeforeNavigate]]);
            expect(onCommitted.addListener.mock.calls).toEqual([[(requestWatcher as any).onCommitted]]);
            expect(onCompleted.addListener.mock.calls).toEqual([[(requestWatcher as any).onCompleted]]);
            expect(onBeforeRedirect.addListener.mock.calls).toEqual([
                [
                    (requestWatcher as any).onBeforeRedirect,
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
            ]);
        });
    });

    describe("onBeforeNavigate", () => {
        it("should call listener.prepareNavigation", () => {
            mockContext.domainUtils.getValidHostname.expect("http://www.amazon.com").andReturn("www.amazon.com");
            onBeforeNavigate.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                parentFrameId: -1,
                timeStamp: -1,
            });
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledTimes(1);
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledWith(42, 1337, "www.amazon.com");
        });
    });

    describe("onCommitted", () => {
        it("should call listener.commitNavigation", () => {
            mockContext.domainUtils.getValidHostname.expect("http://www.amazon.com").andReturn("www.amazon.com");
            onCommitted.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                timeStamp: -1,
            });
            expect(listenerSpy.commitNavigation).toHaveBeenCalledTimes(1);
            expect(listenerSpy.commitNavigation).toHaveBeenCalledWith(42, 1337, "www.amazon.com");
        });
    });

    describe("onCompleted", () => {
        it("should call listener.completeNavigation", () => {
            onCompleted.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                timeStamp: -1,
            });
            expect(listenerSpy.completeNavigation).toHaveBeenCalledTimes(1);
            expect(listenerSpy.completeNavigation).toHaveBeenCalledWith(42, 1337);
        });
    });

    describe("onBeforeRedirect", () => {
        it("should call listener.prepareNavigation", () => {
            mockContext.domainUtils.getValidHostname.expect("http://www.amazon.com").andReturn("www.amazon.com");
            onBeforeRedirect.emit(
                quickBeforeRedirectDetails("http://www.amazon.de", "http://www.amazon.com", 42, 1337)
            );
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledTimes(1);
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledWith(42, 1337, "www.amazon.com");
        });
    });
});
