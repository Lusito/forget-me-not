import { suite, test } from "mocha-typescript";
import { assert } from "chai";
import { TabWatcher } from "../src/background/tabWatcher";
import { createSpy, browserMock } from "./BrowserMock";

@suite export class TabWatcherTests {
	createListener() {
		return {
			onDomainEnter: createSpy(),
			onDomainLeave: createSpy()
		};
	}

	@test domain_enter_leave() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

		const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
		listener.onDomainEnter.assertCall(0, ['firefox-default', 'www.google.com']);

		const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");
		listener.onDomainEnter.assertCall(1, ['firefox-private', 'www.google.de']);

		browserMock.tabs.remove(tabId1);
		listener.onDomainLeave.assertCall(0, ['firefox-default', 'www.google.com']);

		browserMock.tabs.remove(tabId2);
		listener.onDomainLeave.assertCall(1, ['firefox-private', 'www.google.de']);
	}

	@test domain_enter_leave_multiple() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

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
	}

	@test domain_enter_leave_navigation() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

		const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
		listener.onDomainEnter.assertCall(0, ['firefox-default', 'www.google.com']);
		browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
		listener.onDomainEnter.assertNoCall(1);
		listener.onDomainLeave.assertNoCall(0);
		browserMock.webNavigation.commit(tabId1, "http://www.google.de");
		listener.onDomainEnter.assertCall(1, ['firefox-default', 'www.google.de']);
		listener.onDomainLeave.assertCall(0, ['firefox-default', 'www.google.com']);
	}

	@test tabs_exist_before() {
		browserMock.reset();
		const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
		const tabId2 = browserMock.tabs.create("http://www.google.de", "firefox-private");

		const listener = this.createListener();
		const watcher = new TabWatcher(listener);
		listener.onDomainEnter.assertCall(0, ['firefox-default', 'www.google.com']);
		listener.onDomainEnter.assertCall(1, ['firefox-private', 'www.google.de']);
	}

	@test cookie_store_contains_domain() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

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
	}

	@test cookie_store_contains_sub_domain() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

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
	}

	@test cookie_store_contains_domain_navigation() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

		const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
		browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
		assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
		assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.de'));
		browserMock.webNavigation.commit(tabId1, "http://www.google.de");
		assert.isFalse(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.com'));
		assert.isTrue(watcher.cookieStoreContainsDomain('firefox-default', 'www.google.de'));
	}

	@test cookie_store_contains_sub_domain_navigation() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

		const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
		browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
		assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
		assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.de'));
		browserMock.webNavigation.commit(tabId1, "http://www.google.de");
		assert.isFalse(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.com'));
		assert.isTrue(watcher.cookieStoreContainsSubDomain('firefox-default', '.google.de'));
	}

	@test is_third_party_cookie() {
		browserMock.reset();
		const listener = this.createListener();
		const watcher = new TabWatcher(listener);

		assert.isFalse(watcher.isThirdPartyCookie(1, 'google.com'));
		assert.isFalse(watcher.isThirdPartyCookie(1, 'www.google.com'));
		assert.isFalse(watcher.isThirdPartyCookie(1, 'google.de'));

		const tabId1 = browserMock.tabs.create("http://www.google.com", "firefox-default");
		assert.isFalse(watcher.isThirdPartyCookie(tabId1, '.google.com'));
		assert.isTrue(watcher.isThirdPartyCookie(tabId1, 'google.com'));
		assert.isTrue(watcher.isThirdPartyCookie(tabId1, 'google.de'));
		assert.isFalse(watcher.isThirdPartyCookie(tabId1, 'www.google.com'));

		// during navigation both domains are first party
		browserMock.webNavigation.beforeNavigate(tabId1, "http://www.google.de");
		assert.isFalse(watcher.isThirdPartyCookie(tabId1, 'www.google.com'));
		assert.isFalse(watcher.isThirdPartyCookie(tabId1, 'www.google.de'));
		browserMock.webNavigation.commit(tabId1, "http://www.google.de");
		assert.isTrue(watcher.isThirdPartyCookie(tabId1, 'www.google.com'));
		assert.isFalse(watcher.isThirdPartyCookie(tabId1, 'www.google.de'));
	}
}
