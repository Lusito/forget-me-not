/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { TabWatcher, TabWatcherListener } from "../src/background/tabWatcher";
import { createSpy, browserMock, SpyData } from "./BrowserMock";

describe("TabWatcher", () => {
	beforeEach(() => browserMock.reset());
	let listener: {
		onDomainEnter: SpyData,
		onDomainLeave: SpyData
	};
	let watcher: TabWatcher;
	function setupWatcher() {
		listener = {
			onDomainEnter: createSpy(),
			onDomainLeave: createSpy()
		};
		watcher = new TabWatcher(listener, null);
	}
	describe("listener", () => {
		it("should be called on tab create and remove", () => {
			setupWatcher();
			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			listener.onDomainEnter.assertCall(0, ['firefox-default', 'www.google.com']);

			const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
			listener.onDomainEnter.assertCall(1, ['firefox-private', 'www.google.de']);

			browserMock.tabs.remove(tabId1);
			listener.onDomainLeave.assertCall(0, ['firefox-default', 'www.google.com']);

			browserMock.tabs.remove(tabId2);
			listener.onDomainLeave.assertCall(1, ['firefox-private', 'www.google.de']);
		});
		it("should be called only for new domains tab create and remove", () => {
			setupWatcher();
			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			listener.onDomainEnter.assertCall(0, ['firefox-default', 'www.google.com']);

			const tabId1b = browserMock.tabs.create("http://www.google.com", "firefox-default");
			listener.onDomainEnter.assertNoCall(1);

			const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
			listener.onDomainEnter.assertCall(1, ['firefox-private', 'www.google.de']);

			const tabId2b = browserMock.tabs.create("http://www.google.de", "firefox-private");
			listener.onDomainEnter.assertNoCall(2);

			browserMock.tabs.remove(tabId1);
			listener.onDomainLeave.assertNoCall(0);
			browserMock.tabs.remove(tabId1b);
			listener.onDomainLeave.assertCall(0, ['firefox-default', 'www.google.com']);

			browserMock.tabs.remove(tabId2);
			listener.onDomainLeave.assertNoCall(1);
			browserMock.tabs.remove(tabId2b);
			listener.onDomainLeave.assertCall(1, ['firefox-private', 'www.google.de']);
		});
		it("should be called after web navigation commit", () => {
			setupWatcher();
			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			listener.onDomainEnter.assertCall(0, ['firefox-default', 'www.google.com']);
			browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
			listener.onDomainEnter.assertNoCall(1);
			listener.onDomainLeave.assertNoCall(0);
			browserMock.webNavigation.commit(tabId1, "http://www.google.de");
			listener.onDomainEnter.assertCall(1, ['firefox-default', 'www.google.de']);
			listener.onDomainLeave.assertCall(0, ['firefox-default', 'www.google.com']);
		});
		it("should be called if tabs exist before creation", () => {
			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
			setupWatcher();
			listener.onDomainEnter.assertCall(0, ['firefox-default', 'www.google.com']);
			listener.onDomainEnter.assertCall(1, ['firefox-private', 'www.google.de']);
		});
	});
	describe("cookieStoreContainsDomain", () => {
		it("should work with multiple cookie stores", () => {
			setupWatcher();

			assert.isFalse(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
			assert.isFalse(watcher.cookieStoreContainsDomain('firefox-private', 'www.google.com'));

			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
			assert.isFalse(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.de'));
			assert.isFalse(watcher.cookieStoreContainsDomain('firefox-private', 'www.google.com'));

			const tabId2 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));

			browserMock.tabs.remove(tabId1);
			assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
			browserMock.tabs.remove(tabId2);
			assert.isFalse(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
		});
		it("should work during navigation", () => {
			setupWatcher();

			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
			assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
			assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.de'));
			browserMock.webNavigation.commit(tabId1, "http://www.google.de");
			assert.isFalse(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
			assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.de'));
		});
	});
	describe("cookieStoreContainsSubDomain", () => {
		it("should work with multiple cookie stores", () => {
			setupWatcher();

			assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
			assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-private', '.google.com'));

			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
			assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-default', '.www.google.com'));
			assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.de'));
			assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-private', '.google.com'));

			const tabId2 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));

			browserMock.tabs.remove(tabId1);
			assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
			browserMock.tabs.remove(tabId2);
			assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
		});
		it("should work during navigation", () => {
			setupWatcher();

			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
			assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
			assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.de'));
			browserMock.webNavigation.commit(tabId1, "http://www.google.de");
			assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
			assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.de'));
		});
	});
	describe("isThirdPartyCookieOnTab", () => {
		it("should detect third party cookies correctly", () => {
			setupWatcher();

			assert.isFalse(watcher.isThirdPartyCookieOnTab(1, 'google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(1, 'www.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(1, 'google.de'));

			const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, '.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'google.com'));
			assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, 'google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'www.google.com'));

			// during navigation both domains are first party
			browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'www.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, '.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, '.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'what.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, '.what.www.google.de'));
			browserMock.webNavigation.commit(tabId1, "http://www.google.de");
			assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, 'www.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, '.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, '.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'what.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, '.what.www.google.de'));

			// Second level
			browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
			browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
			assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, 'www.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'michelgagne.blogspot.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnTab(tabId1, 'hello.michelgagne.blogspot.de'));
			assert.isTrue(watcher.isThirdPartyCookieOnTab(tabId1, 'blogspot.de'));
		});
	});
	describe("isThirdPartyCookieOnCookieStore", () => {
		it("should detect third party cookies correctly", () => {
			setupWatcher();

			const cookieStoreId = "firefox-default";
			const cookieStoreId2 = "firefox-alternative";
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'google.com'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'www.google.com'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'google.de'));

			const tabId1 = browserMock.tabs.create("http://www.google.com", cookieStoreId);
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, '.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'google.com'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'www.google.com'));
			// in another store
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, '.google.com'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, 'google.com'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, 'google.de'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, 'www.google.com'));
			// if there is a tab open in the other store
			browserMock.tabs.create("http://www.google.de", cookieStoreId2);
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, '.google.com'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, 'google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, 'google.de'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId2, 'www.google.com'));

			// during navigation both domains are first party
			browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'www.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, '.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, '.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'what.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, '.what.www.google.de'));
			browserMock.webNavigation.commit(tabId1, "http://www.google.de");
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'www.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, '.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, '.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'what.www.google.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, '.what.www.google.de'));

			// Second level
			browserMock.webNavigation.beforeNavigate(tabId1, "http://michelgagne.blogspot.de");
			browserMock.webNavigation.commit(tabId1, "http://michelgagne.blogspot.de");
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'www.google.com'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'michelgagne.blogspot.de'));
			assert.isFalse(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'hello.michelgagne.blogspot.de'));
			assert.isTrue(watcher.isThirdPartyCookieOnCookieStore(cookieStoreId, 'blogspot.de'));
		});
	});
});
