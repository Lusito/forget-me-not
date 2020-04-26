/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { container } from "tsyringe";

import { RequestWatcher } from "./requestWatcher";
import { quickBeforeRedirectDetails } from "../testUtils/quickHelpers";
import { mockEvent, EventMockOf } from "../testUtils/mockBrowser";
import { mocks } from "../testUtils/mocks";

describe("Request Watcher", () => {
    let requestWatcher: RequestWatcher | null = null;
    let onBeforeNavigate: EventMockOf<typeof mockBrowser.webNavigation.onBeforeNavigate>;
    let onCommitted: EventMockOf<typeof mockBrowser.webNavigation.onCommitted>;
    let onCompleted: EventMockOf<typeof mockBrowser.webNavigation.onCompleted>;
    let onBeforeRedirect: EventMockOf<typeof mockBrowser.webRequest.onBeforeRedirect>;

    afterEach(() => {
        requestWatcher = null;
    });

    beforeEach(() => {
        onBeforeNavigate = mockEvent(mockBrowser.webNavigation.onBeforeNavigate);
        onCommitted = mockEvent(mockBrowser.webNavigation.onCommitted);
        onCompleted = mockEvent(mockBrowser.webNavigation.onCompleted);
        onBeforeRedirect = mockEvent(mockBrowser.webRequest.onBeforeRedirect);
        mocks.domainUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        requestWatcher = container.resolve(RequestWatcher);
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
            mocks.domainUtils.getValidHostname.expect("http://www.amazon.com").andReturn("www.amazon.com");
            mocks.tabWatcher.prepareNavigation.expect(42, 1337, "www.amazon.com");
            onBeforeNavigate.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                parentFrameId: -1,
                timeStamp: -1,
            });
        });
    });

    describe("onCommitted", () => {
        it("should call listener.commitNavigation", () => {
            mocks.domainUtils.getValidHostname.expect("http://www.amazon.com").andReturn("www.amazon.com");
            mocks.tabWatcher.commitNavigation.expect(42, 1337, "www.amazon.com");
            onCommitted.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                timeStamp: -1,
            });
        });
    });

    describe("onCompleted", () => {
        it("should call listener.completeNavigation", () => {
            mocks.tabWatcher.completeNavigation.expect(42);
            onCompleted.emit({
                tabId: 42,
                url: "http://www.amazon.com",
                frameId: 1337,
                timeStamp: -1,
            });
        });
    });

    describe("onBeforeRedirect", () => {
        it("should call listener.prepareNavigation", () => {
            mocks.domainUtils.getValidHostname.expect("http://www.amazon.com").andReturn("www.amazon.com");
            mocks.tabWatcher.prepareNavigation.expect(42, 1337, "www.amazon.com");
            onBeforeRedirect.emit(
                quickBeforeRedirectDetails("http://www.amazon.de", "http://www.amazon.com", 42, 1337)
            );
        });
    });
});
