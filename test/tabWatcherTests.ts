/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { TabWatcher } from "../src/background/tabWatcher";
import { browserMock } from "./browserMock";
import { ensureNotNull, createSpy, SpyData, booleanContext } from "./testHelpers";
import { quickBeforeRedirectDetails } from "./quickHelpers";

describe("TabWatcher", () => {
    beforeEach(() => browserMock.reset());
    let listener: {
        onDomainEnter: SpyData,
        onDomainLeave: SpyData
    };
    let watcher: TabWatcher | null = null;
    function setupWatcher() {
        listener = {
            onDomainEnter: createSpy(),
            onDomainLeave: createSpy()
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
            listener.onDomainEnter.assertCalls([["firefox-default", "www.google.com"]]);

            const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
            listener.onDomainEnter.assertCalls([["firefox-private", "www.google.de"]]);

            browserMock.tabs.remove(tabId1);
            listener.onDomainLeave.assertCalls([["firefox-default", "www.google.com"]]);

            browserMock.tabs.remove(tabId2);
            listener.onDomainLeave.assertCalls([["firefox-private", "www.google.de"]]);
        });
        it("should be called only for new domains tab create and remove", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            listener.onDomainEnter.assertCalls([["firefox-default", "www.google.com"]]);

            const tabId1b = browserMock.tabs.create("http://www.google.com", "firefox-default");
            listener.onDomainEnter.assertNoCall();

            const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
            listener.onDomainEnter.assertCalls([["firefox-private", "www.google.de"]]);

            const tabId2b = browserMock.tabs.create("http://www.google.de", "firefox-private");
            listener.onDomainEnter.assertNoCall();

            browserMock.tabs.remove(tabId1);
            listener.onDomainLeave.assertNoCall();
            browserMock.tabs.remove(tabId1b);
            listener.onDomainLeave.assertCalls([["firefox-default", "www.google.com"]]);

            browserMock.tabs.remove(tabId2);
            listener.onDomainLeave.assertNoCall();
            browserMock.tabs.remove(tabId2b);
            listener.onDomainLeave.assertCalls([["firefox-private", "www.google.de"]]);
        });
        it("should be called after web navigation commit", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            listener.onDomainEnter.assertCalls([["firefox-default", "www.google.com"]]);
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            listener.onDomainEnter.assertNoCall();
            listener.onDomainLeave.assertNoCall();
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            listener.onDomainEnter.assertCalls([["firefox-default", "www.google.de"]]);
            listener.onDomainLeave.assertCalls([["firefox-default", "www.google.com"]]);
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
            listener.onDomainLeave.assertCalls([
                ["firefox-default", "www.google.de"],
                ["firefox-default", "www.google.jp"],
                ["firefox-default", "www.amazon.com"]
            ]);
        });
        it("should be called if tabs exist before creation", () => {
            browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.tabs.create("http://www.google.de", "firefox-private");
            setupWatcher();
            listener.onDomainEnter.assertCalls([
                ["firefox-default", "www.google.com"],
                ["firefox-private", "www.google.de"]
            ]);
        });
        it("should call scheduleDeadFramesCheck on tab if it exists", () => {
            setupWatcher();
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            const scheduleDeadFramesCheck = createSpy();
            (watcher as any).tabInfos[tabId1] = { scheduleDeadFramesCheck };

            browserMock.webNavigation.complete(tabId1, "");
            scheduleDeadFramesCheck.assertCalls([[]]);
        });
        it("should be called for frames", () => {
            setupWatcher();
            watcher = ensureNotNull(watcher);
            const tabId1 = browserMock.tabs.create("http://www.amazon.com", "firefox-default");
            listener.onDomainEnter.assertCalls([["firefox-default", "www.amazon.com"]]);
            watcher.prepareNavigation(tabId1, 1, "images.google.com");
            watcher.prepareNavigation(tabId1, 1, "www.google.com");
            listener.onDomainLeave.assertCalls([["firefox-default", "images.google.com"]]);
            listener.onDomainEnter.assertNoCall();
            watcher.commitNavigation(tabId1, 1, "www.google.com");
            listener.onDomainEnter.assertCalls([["firefox-default", "www.google.com"]]);

            watcher.commitNavigation(tabId1, 1, "www.google.com");
            listener.onDomainEnter.assertNoCall();

            watcher.prepareNavigation(tabId1, 1, "");
            listener.onDomainLeave.assertNoCall();
            watcher.commitNavigation(tabId1, 1, "");
            listener.onDomainLeave.assertCalls([["firefox-default", "www.google.com"]]);

            listener.onDomainEnter.assertNoCall();
        });
    });
    describe("cookieStoreContainsDomain", () => {
        booleanContext((checkNext) => {
            it("should work with multiple cookie stores", () => {
                setupWatcher();

                watcher = ensureNotNull(watcher);
                assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext));
                assert.isFalse(watcher.cookieStoreContainsDomain("firefox-private", "www.google.com", checkNext));

                const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
                assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext));
                assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", checkNext));
                assert.isFalse(watcher.cookieStoreContainsDomain("firefox-private", "www.google.com", checkNext));

                const tabId2 = browserMock.tabs.create("http://www.google.com", "firefox-default");
                assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext));

                browserMock.tabs.remove(tabId1);
                assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext));
                browserMock.tabs.remove(tabId2);
                assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", checkNext));
            });
        });
        it("should work during navigation", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", false));
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", false));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", true));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", true));
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", false));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", false));
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", true));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", true));
        });
        it("should work with frames", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            const tabId1 = browserMock.tabs.create("", "firefox-default");
            watcher.commitNavigation(tabId1, 1, "www.google.com");
            watcher.prepareNavigation(tabId1, 1, "www.google.de");
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", false));
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", false));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", true));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", true));
            watcher.commitNavigation(tabId1, 1, "www.google.de");
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", false));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", false));
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com", true));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de", true));
        });
    });
    describe("containsDomain", () => {
        it("should work with multiple cookie stores", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            assert.isFalse(watcher.containsDomain("www.google.com"));

            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            assert.isTrue(watcher.containsDomain("www.google.com"));
            assert.isFalse(watcher.containsDomain("www.google.de"));

            const tabId2 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            assert.isTrue(watcher.containsDomain("www.google.com"));

            browserMock.tabs.remove(tabId1);
            assert.isTrue(watcher.containsDomain("www.google.com"));
            browserMock.tabs.remove(tabId2);
            assert.isFalse(watcher.containsDomain("www.google.com"));
        });
        it("should work during navigation", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            assert.isTrue(watcher.containsDomain("www.google.com"));
            assert.isTrue(watcher.containsDomain("www.google.de"));
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            assert.isFalse(watcher.containsDomain("www.google.com"));
            assert.isTrue(watcher.containsDomain("www.google.de"));
        });
        it("should work with frames", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            const tabId1 = browserMock.tabs.create("", "firefox-default");
            watcher.commitNavigation(tabId1, 1, "www.google.com");
            watcher.prepareNavigation(tabId1, 1, "www.google.de");
            assert.isTrue(watcher.containsDomain("www.google.com"));
            assert.isTrue(watcher.containsDomain("www.google.de"));
            watcher.commitNavigation(tabId1, 1, "www.google.de");
            assert.isFalse(watcher.containsDomain("www.google.com"));
            assert.isTrue(watcher.containsDomain("www.google.de"));
        });
    });
    describe("isThirdPartyCookieOnTab", () => {
        it("should detect if a cookie domain is third-party for a specified tab", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            assert.isFalse(watcher.isThirdPartyCookieOnTab(1, "google.com"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(1, "www.google.com"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(1, "google.de"));

            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, ".google.com"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "google.com"));
            assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, "google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "www.google.com"));
            // A frame should not be detected as first party
            watcher.commitNavigation(tabId1, 1, "google.de");
            assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, "google.de"));

            // during navigation both domains are first party
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "www.google.com"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "www.google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, ".google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, ".www.google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "what.www.google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, ".what.www.google.de"));
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, "www.google.com"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "www.google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, ".google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, ".www.google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "what.www.google.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, ".what.www.google.de"));

            // Second level tld
            browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
            browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
            assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, "www.google.com"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "michelgagne.blogspot.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "hello.michelgagne.blogspot.de"));
            assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, "blogspot.de"));
        });
    });
    describe("cookieStoreContainsDomainFP", () => {
        booleanContext((deep) => {
            it("should detect if a first party domain is opened in a cookie store and if it is not", () => {
                setupWatcher();

                const cookieStoreId = "firefox-default";
                const cookieStoreId2 = "firefox-alternative";
                watcher = ensureNotNull(watcher);
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep));
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep));

                const tabId1 = browserMock.tabs.create("http://www.google.com", cookieStoreId);
                assert.isTrue(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep));
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep));
                // in another frame
                watcher.commitNavigation(tabId1, 1, "www.amazon.com");
                assert.equal(watcher.cookieStoreContainsDomainFP(cookieStoreId, "amazon.com", deep), deep);
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId, "amazon.de", deep));
                // in another store
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId2, "google.com", deep));
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId2, "google.de", deep));
                // if there is a tab open in the other store
                browserMock.tabs.create("http://www.google.de", cookieStoreId2);
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId2, "google.com", deep));
                assert.isTrue(watcher.cookieStoreContainsDomainFP(cookieStoreId2, "google.de", deep));

                // during navigation both domains are first party
                browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
                assert.isTrue(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep));
                assert.isTrue(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep));
                browserMock.webNavigation.commit(tabId1, "http://www.google.de");
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep));
                assert.isTrue(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.de", deep));
                // in another frame
                watcher.commitNavigation(tabId1, 1, "www.amazon.com");
                watcher.prepareNavigation(tabId1, 1, "www.amazon.de");
                assert.equal(watcher.cookieStoreContainsDomainFP(cookieStoreId, "amazon.com", deep), deep);
                assert.equal(watcher.cookieStoreContainsDomainFP(cookieStoreId, "amazon.de", deep), deep);

                // Second level
                browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
                browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId, "google.com", deep));
                assert.isTrue(watcher.cookieStoreContainsDomainFP(cookieStoreId, "michelgagne.blogspot.de", deep));
                assert.isFalse(watcher.cookieStoreContainsDomainFP(cookieStoreId, "blogspot.de", deep));
            });
        });
    });
});
