/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { booleanContext } from "../testUtils/testHelpers";
import { TabWatcher } from "./tabWatcher";
import { quickBeforeRedirectDetails } from "../testUtils/quickHelpers";

describe("TabWatcher", () => {
    let listener: {
        onDomainEnter: jest.Mock,
        onDomainLeave: jest.Mock
    };
    let watcher: TabWatcher | null = null;
    function setupWatcher() {
        listener = {
            onDomainEnter: jest.fn(),
            onDomainLeave: jest.fn()
        };
        watcher = new TabWatcher(listener);
    }

    afterEach(() => {
        watcher = null;
    });

    describe("listener", () => {
        it("should be called on tab create and remove", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-default", "www.google.com"]]);
            listener.onDomainEnter.mockClear();

            const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-private", "www.google.de"]]);

            browserMock.tabs.remove(tabId1);
            expect(listener.onDomainLeave.mock.calls).toEqual([["firefox-default", "www.google.com"]]);
            listener.onDomainLeave.mockClear();

            browserMock.tabs.remove(tabId2);
            expect(listener.onDomainLeave.mock.calls).toEqual([["firefox-private", "www.google.de"]]);
        });
        it("should be called only for new domains tab create and remove", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-default", "www.google.com"]]);
            listener.onDomainEnter.mockClear();

            const tabId1b = browserMock.tabs.create("http://www.google.com", "firefox-default");
            expect(listener.onDomainEnter).not.toHaveBeenCalled();

            const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-private", "www.google.de"]]);
            listener.onDomainEnter.mockClear();

            const tabId2b = browserMock.tabs.create("http://www.google.de", "firefox-private");
            expect(listener.onDomainEnter).not.toHaveBeenCalled();

            browserMock.tabs.remove(tabId1);
            expect(listener.onDomainLeave).not.toHaveBeenCalled();
            browserMock.tabs.remove(tabId1b);
            expect(listener.onDomainLeave.mock.calls).toEqual([["firefox-default", "www.google.com"]]);
            listener.onDomainLeave.mockClear();

            browserMock.tabs.remove(tabId2);
            expect(listener.onDomainLeave).not.toHaveBeenCalled();
            browserMock.tabs.remove(tabId2b);
            expect(listener.onDomainLeave.mock.calls).toEqual([["firefox-private", "www.google.de"]]);
        });
        it("should be called after web navigation commit", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-default", "www.google.com"]]);
            listener.onDomainEnter.mockClear();
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            expect(listener.onDomainEnter).not.toHaveBeenCalled();
            expect(listener.onDomainLeave).not.toHaveBeenCalled();
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-default", "www.google.de"]]);
            expect(listener.onDomainLeave.mock.calls).toEqual([["firefox-default", "www.google.com"]]);
        });
        it("should be called when a navigation follows a navigation", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.tabs.create("http://www.google.co.uk", "firefox-default");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.jp");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.co.uk");
            browserMock.webRequest.onBeforeRedirect.emit(quickBeforeRedirectDetails("http://www.amazon.jp", "http://www.amazon.com", tabId1));
            browserMock.webRequest.onBeforeRedirect.emit(quickBeforeRedirectDetails("http://www.amazon.co.uk", "http://www.amazon.de", tabId1));
            expect(listener.onDomainLeave.mock.calls).toEqual([
                ["firefox-default", "www.google.de"],
                ["firefox-default", "www.google.jp"],
                ["firefox-default", "www.amazon.com"]
            ]);
        });
        it("should be called if tabs exist before creation", () => {
            browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.tabs.create("http://www.google.de", "firefox-private");
            setupWatcher();
            expect(listener.onDomainEnter.mock.calls).toEqual([
                ["firefox-default", "www.google.com"],
                ["firefox-private", "www.google.de"]
            ]);
        });
        it("should call scheduleDeadFramesCheck on tab if it exists", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            const scheduleDeadFramesCheck = jest.fn();
            (watcher as any).tabInfos[tabId1] = { scheduleDeadFramesCheck };

            browserMock.webNavigation.complete(tabId1, "");
            expect(scheduleDeadFramesCheck.mock.calls).toEqual([[]]);
        });
        it("should be called for frames", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.amazon.com", "firefox-default");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-default", "www.amazon.com"]]);
            listener.onDomainEnter.mockClear();
            watcher!.prepareNavigation(tabId1, 1, "images.google.com");
            watcher!.prepareNavigation(tabId1, 1, "www.google.com");
            expect(listener.onDomainLeave.mock.calls).toEqual([["firefox-default", "images.google.com"]]);
            expect(listener.onDomainEnter).not.toHaveBeenCalled();
            listener.onDomainLeave.mockClear();
            watcher!.commitNavigation(tabId1, 1, "www.google.com");
            expect(listener.onDomainEnter.mock.calls).toEqual([["firefox-default", "www.google.com"]]);
            listener.onDomainEnter.mockClear();

            watcher!.commitNavigation(tabId1, 1, "www.google.com");
            expect(listener.onDomainEnter).not.toHaveBeenCalled();

            watcher!.prepareNavigation(tabId1, 1, "");
            expect(listener.onDomainLeave).not.toHaveBeenCalled();
            watcher!.commitNavigation(tabId1, 1, "");
            expect(listener.onDomainLeave.mock.calls).toEqual([["firefox-default", "www.google.com"]]);

            expect(listener.onDomainEnter).not.toHaveBeenCalled();
        });
    });
    describe("cookieStoreContainsDomain", () => {
        booleanContext((checkNext) => {
            it("should work with multiple cookie stores", () => {
                setupWatcher();

                expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext)).toBe(false);
                expect(watcher!.cookieStoreContainsDomain("firefox-private", "www.google.com", checkNext)).toBe(false);

                const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
                expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext)).toBe(true);
                expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", checkNext)).toBe(false);
                expect(watcher!.cookieStoreContainsDomain("firefox-private", "www.google.com", checkNext)).toBe(false);

                const tabId2 = browserMock.tabs.create("http://www.google.com", "firefox-default");
                expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext)).toBe(true);

                browserMock.tabs.remove(tabId1);
                expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext)).toBe(true);
                browserMock.tabs.remove(tabId2);
                expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext)).toBe(false);
            });
        });
        it("should work during navigation", () => {
            setupWatcher();

            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", false)).toBe(true);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", false)).toBe(false);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", true)).toBe(true);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", true)).toBe(true);
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", false)).toBe(false);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", false)).toBe(true);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", true)).toBe(false);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", true)).toBe(true);
        });
        it("should work with frames", () => {
            setupWatcher();

            const tabId1 = browserMock.tabs.create("", "firefox-default");
            watcher!.commitNavigation(tabId1, 1, "www.google.com");
            watcher!.prepareNavigation(tabId1, 1, "www.google.de");
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", false)).toBe(true);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", false)).toBe(false);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", true)).toBe(true);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", true)).toBe(true);
            watcher!.commitNavigation(tabId1, 1, "www.google.de");
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", false)).toBe(false);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", false)).toBe(true);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.com", true)).toBe(false);
            expect(watcher!.cookieStoreContainsDomain("firefox-default", "www.google.de", true)).toBe(true);
        });
    });
    describe("containsDomain", () => {
        it("should work with multiple cookie stores", () => {
            setupWatcher();

            expect(watcher!.containsDomain("www.google.com")).toBe(false);

            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            expect(watcher!.containsDomain("www.google.com")).toBe(true);
            expect(watcher!.containsDomain("www.google.de")).toBe(false);

            const tabId2 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            expect(watcher!.containsDomain("www.google.com")).toBe(true);

            browserMock.tabs.remove(tabId1);
            expect(watcher!.containsDomain("www.google.com")).toBe(true);
            browserMock.tabs.remove(tabId2);
            expect(watcher!.containsDomain("www.google.com")).toBe(false);
        });
        it("should work during navigation", () => {
            setupWatcher();

            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            expect(watcher!.containsDomain("www.google.com")).toBe(true);
            expect(watcher!.containsDomain("www.google.de")).toBe(true);
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            expect(watcher!.containsDomain("www.google.com")).toBe(false);
            expect(watcher!.containsDomain("www.google.de")).toBe(true);
        });
        it("should work with frames", () => {
            setupWatcher();

            const tabId1 = browserMock.tabs.create("", "firefox-default");
            watcher!.commitNavigation(tabId1, 1, "www.google.com");
            watcher!.prepareNavigation(tabId1, 1, "www.google.de");
            expect(watcher!.containsDomain("www.google.com")).toBe(true);
            expect(watcher!.containsDomain("www.google.de")).toBe(true);
            watcher!.commitNavigation(tabId1, 1, "www.google.de");
            expect(watcher!.containsDomain("www.google.com")).toBe(false);
            expect(watcher!.containsDomain("www.google.de")).toBe(true);
        });
    });
    describe("isThirdPartyCookieOnTab", () => {
        it("should detect if a cookie domain is third-party for a specified tab", () => {
            setupWatcher();

            expect(watcher!.isThirdPartyCookieOnTab(1, "google.com")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(1, "www.google.com")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(1, "google.de")).toBe(false);

            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, ".google.com")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "google.com")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "google.de")).toBe(true);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "www.google.com")).toBe(false);
            // A frame should not be detected as first party
            watcher!.commitNavigation(tabId1, 1, "google.de");
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "google.de")).toBe(true);

            // during navigation both domains are first party
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "www.google.com")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "www.google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, ".google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, ".www.google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "what.www.google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, ".what.www.google.de")).toBe(false);
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "www.google.com")).toBe(true);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "www.google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, ".google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, ".www.google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "what.www.google.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, ".what.www.google.de")).toBe(false);

            // Second level tld
            browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
            browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "www.google.com")).toBe(true);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "michelgagne.blogspot.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "hello.michelgagne.blogspot.de")).toBe(false);
            expect(watcher!.isThirdPartyCookieOnTab(tabId1, "blogspot.de")).toBe(true);
        });
    });
    describe("cookieStoreContainsDomainFP", () => {
        booleanContext((deep) => {
            it("should detect if a first party domain is opened in a cookie store and if it is not", () => {
                setupWatcher();

                const cookieStoreId = "firefox-default";
                const cookieStoreId2 = "firefox-alternative";

                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep)).toBe(false);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep)).toBe(false);

                const tabId1 = browserMock.tabs.create("http://www.google.com", cookieStoreId);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep)).toBe(true);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep)).toBe(false);
                // in another frame
                watcher!.commitNavigation(tabId1, 1, "www.amazon.com");
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "amazon.com", deep)).toBe(deep);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "amazon.de", deep)).toBe(false);
                // in another store
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId2, "google.com", deep)).toBe(false);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId2, "google.de", deep)).toBe(false);
                // if there is a tab open in the other store
                browserMock.tabs.create("http://www.google.de", cookieStoreId2);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId2, "google.com", deep)).toBe(false);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId2, "google.de", deep)).toBe(true);

                // during navigation both domains are first party
                browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep)).toBe(true);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep)).toBe(true);
                browserMock.webNavigation.commit(tabId1, "http://www.google.de");
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep)).toBe(false);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep)).toBe(true);
                // in another frame
                watcher!.commitNavigation(tabId1, 1, "www.amazon.com");
                watcher!.prepareNavigation(tabId1, 1, "www.amazon.de");
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "amazon.com", deep)).toBe(deep);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "amazon.de", deep)).toBe(deep);

                // Second level
                browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
                browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep)).toBe(false);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "michelgagne.blogspot.de", deep)).toBe(true);
                expect(watcher!.cookieStoreContainsDomainFP(cookieStoreId, "blogspot.de", deep)).toBe(false);
            });
        });
    });
});
