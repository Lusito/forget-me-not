/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { TabWatcher } from "../src/background/tabWatcher";
import { browserMock } from "./browserMock";
import { ensureNotNull, createSpy, SpyData, spyOn } from "./testHelpers";
import { destroyAndNull } from "../src/shared";
import { RecentlyAccessedDomains } from "../src/background/recentlyAccessedDomains";

describe("TabWatcher", () => {
    beforeEach(() => browserMock.reset());
    let listener: {
        onDomainEnter: SpyData,
        onDomainLeave: SpyData
    };
    let watcher: TabWatcher | null = null;
    let recentlyAccessedDomainAddSpy: SpyData | null = null;
    function setupWatcher() {
        listener = {
            onDomainEnter: createSpy(),
            onDomainLeave: createSpy()
        };
        const recentlyAccessedDomain = new RecentlyAccessedDomains();
        recentlyAccessedDomainAddSpy = spyOn(recentlyAccessedDomain, "add");
        watcher = new TabWatcher(listener, recentlyAccessedDomain);
    }

    afterEach(() => {
        watcher = destroyAndNull(watcher);
    });

    describe("recentlyAccessedDomain", () => {
        it("add() should be called on tab create and commit", () => {
            setupWatcher();
            recentlyAccessedDomainAddSpy = ensureNotNull(recentlyAccessedDomainAddSpy);
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.jp");
            browserMock.webNavigation.commit(tabId1, "http://www.google.fr");
            browserMock.tabs.remove(tabId2);
            recentlyAccessedDomainAddSpy.assertCalls([
                ["www.google.com"],
                ["www.google.de"],
                ["www.google.fr"]
            ]);
        });
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
        it("should be called if tabs exist before creation", () => {
            browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.tabs.create("http://www.google.de", "firefox-private");
            setupWatcher();
            listener.onDomainEnter.assertCalls([
                ["firefox-default", "www.google.com"],
                ["firefox-private", "www.google.de"]
            ]);
        });
    });
    describe("cookieStoreContainsDomain", () => {
        it("should work with multiple cookie stores", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com"));
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-private", "www.google.com"));

            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com"));
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de"));
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-private", "www.google.com"));

            const tabId2 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com"));

            browserMock.tabs.remove(tabId1);
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com"));
            browserMock.tabs.remove(tabId2);
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com"));
        });
        it("should work during navigation", () => {
            setupWatcher();

            watcher = ensureNotNull(watcher);
            const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com"));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de"));
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            assert.isFalse(watcher.cookieStoreContainsDomain("firefox-default", "www.google.com"));
            assert.isTrue(watcher.cookieStoreContainsDomain("firefox-default", "www.google.de"));
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

            // Second level
            browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
            browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
            assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, "www.google.com"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "michelgagne.blogspot.de"));
            assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, "hello.michelgagne.blogspot.de"));
            assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, "blogspot.de"));
        });
    });
    describe("isFirstPartyDomainOnCookieStore", () => {
        it("should detect if a first party domain is opened in a cookie store and if it is not", () => {
            setupWatcher();

            const cookieStoreId = "firefox-default";
            const cookieStoreId2 = "firefox-alternative";
            watcher = ensureNotNull(watcher);
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.com"));
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.de"));

            const tabId1 = browserMock.tabs.create("http://www.google.com", cookieStoreId);
            assert.isTrue(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.com"));
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.de"));
            // in another store
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId2, "google.com"));
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId2, "google.de"));
            // if there is a tab open in the other store
            browserMock.tabs.create("http://www.google.de", cookieStoreId2);
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId2, "google.com"));
            assert.isTrue(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId2, "google.de"));

            // during navigation both domains are first party
            browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
            assert.isTrue(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.com"));
            assert.isTrue(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.de"));
            browserMock.webNavigation.commit(tabId1, "http://www.google.de");
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.com"));
            assert.isTrue(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.de"));

            // Second level
            browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
            browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "google.com"));
            assert.isTrue(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "michelgagne.blogspot.de"));
            assert.isFalse(watcher.isFirstPartyDomainOnCookieStore(cookieStoreId, "blogspot.de"));
        });
    });
});
