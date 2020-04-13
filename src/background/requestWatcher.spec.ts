/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { RequestWatcher } from "./requestWatcher";
import { quickBeforeRedirectDetails } from "../testUtils/quickHelpers";

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

    afterEach(() => {
        requestWatcher = null;
    });

    beforeEach(() => {
        listenerSpy.reset();
        requestWatcher = new RequestWatcher(listenerSpy);
    });

    describe("listeners", () => {
        it("should add listeners on creation", () => {
            expect(browserMock.webNavigation.onBeforeNavigate.mock.addListener.mock.calls).toEqual([
                [(requestWatcher as any).onBeforeNavigate],
            ]);
            expect(browserMock.webNavigation.onCommitted.mock.addListener.mock.calls).toEqual([
                [(requestWatcher as any).onCommitted],
            ]);
            expect(browserMock.webNavigation.onCompleted.mock.addListener.mock.calls).toEqual([
                [(requestWatcher as any).onCompleted],
            ]);
            expect(browserMock.webRequest.onBeforeRedirect.mock.addListener.mock.calls).toEqual([
                [
                    (requestWatcher as any).onBeforeRedirect,
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
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
                timeStamp: -1,
            });
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledTimes(1);
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledWith(42, 1337, "www.amazon.com");
        });
    });

    describe("onCommitted", () => {
        it("should call listener.commitNavigation", () => {
            browserMock.webNavigation.onCommitted.emit({
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
            browserMock.webNavigation.onCompleted.emit({
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
            browserMock.webRequest.onBeforeRedirect.emit(
                quickBeforeRedirectDetails("http://www.amazon.de", "http://www.amazon.com", 42, 1337)
            );
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledTimes(1);
            expect(listenerSpy.prepareNavigation).toHaveBeenCalledWith(42, 1337, "www.amazon.com");
        });
    });
});
