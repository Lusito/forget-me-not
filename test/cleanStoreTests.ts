/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { RecentlyAccessedDomains } from "../src/background/recentlyAccessedDomains";
import { settings } from "../src/lib/settings";
import { TabWatcher } from "../src/background/tabWatcher";
import { destroyAndNull } from "../src/shared";
import { browserMock } from "./browserMock";
import { CleanStore } from "../src/background/cleanStore";
import { assert } from "chai";
import { ensureNotNull, doneHandler } from "./testHelpers";
import { CleanupType } from "../src/lib/settingsSignature";
import { browser, Cookies } from "webextension-polyfill-ts";

function setCookie(domain: string, name: string, value: string, path: string, storeId: string, firstPartyDomain: string) {
    browser.cookies.set({
        url: "mock",
        name,
        value,
        domain,
        path,
        storeId,
        firstPartyDomain
    });
}

const COOKIE_STORE_ID = "mock";

function assertRemainingCookieDomains(done: MochaDone, domainList: string[]) {
    setTimeout(() => {
        browser.cookies.getAll({
            firstPartyDomain: null,
            storeId: COOKIE_STORE_ID
        }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.sameMembers(cookies.map((c) => c.domain), domainList);
        }, done));
    }, 10);
}

const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const BLACKLISTED_DOMAIN = "instantly.com";
const OPEN_DOMAIN = "open.com";
const OPEN_DOMAIN2 = "open2.com";
const UNKNOWN_DOMAIN = "unknown.com";
const UNKNOWN_DOMAIN2 = "unknown2.com";
const UNKNOWN_SUBDOMAIN = "sub.unknown.com";

describe("Clean Store", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let tabWatcher: TabWatcher | null = null;
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let cleanStore: CleanStore | null = null;

    afterEach(() => {
        recentlyAccessedDomains = destroyAndNull(recentlyAccessedDomains);
        tabWatcher = destroyAndNull(tabWatcher);
        cleanStore = null;
        settings.restoreDefaults();
    });

    beforeEach(() => {
        browserMock.reset();
        recentlyAccessedDomains = new RecentlyAccessedDomains();
        tabWatcher = new TabWatcher(tabWatcherListener, recentlyAccessedDomains);
        cleanStore = new CleanStore(COOKIE_STORE_ID, tabWatcher);

        browserMock.tabs.create(`http://${OPEN_DOMAIN}`, COOKIE_STORE_ID);
        browserMock.tabs.create(`http://${OPEN_DOMAIN2}`, COOKIE_STORE_ID);
        setCookie(OPEN_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        setCookie(OPEN_DOMAIN2, "foo", "bar", "", COOKIE_STORE_ID, OPEN_DOMAIN2);
        setCookie(UNKNOWN_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        setCookie(UNKNOWN_DOMAIN2, "foo", "bar", "", COOKIE_STORE_ID, UNKNOWN_DOMAIN2);
        setCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        setCookie(GRAYLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        setCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        settings.set("rules", [
            { rule: WHITELISTED_DOMAIN, type: CleanupType.NEVER },
            { rule: GRAYLISTED_DOMAIN, type: CleanupType.STARTUP },
            { rule: BLACKLISTED_DOMAIN, type: CleanupType.INSTANTLY }
        ]);
        settings.save();
    });

    describe("cleanCookiesWithRules", () => {
        context("ignoreStartupType = true, protectOpenDomains = false", () => {
            it("should neither protect graylisted cookies nor open domains", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanCookiesWithRules(true, false);
                assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN]);
            });
        });
        context("ignoreStartupType = false, protectOpenDomains = false", () => {
            it("should protect graylisted cookies, but not open domains", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanCookiesWithRules(false, false);
                assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN]);
            });
        });
        context("ignoreStartupType = true, protectOpenDomains = true", () => {
            it("should protect graylisted cookies, but not open domains", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanCookiesWithRules(true, true);
                assertRemainingCookieDomains(done, [OPEN_DOMAIN, OPEN_DOMAIN2, WHITELISTED_DOMAIN]);
            });
        });
        context("ignoreStartupType = false, protectOpenDomains = true", () => {
            it("should protect graylisted cookies, but not open domains", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanCookiesWithRules(false, true);
                assertRemainingCookieDomains(done, [OPEN_DOMAIN, OPEN_DOMAIN2, WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN]);
            });
        });
    });

    describe("cleanByDomainWithRules", () => {
        context("domainLeave.enabled = false", () => {
            beforeEach(() => {
                assert.isFalse(settings.get("domainLeave.enabled"));
            });
            it("should not do anything", () => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanByDomainWithRules(OPEN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
                browserMock.browsingData.remove.assertNoCall();
            });
        });
        context("domainLeave.enabled = true, domainLeave.cookies=false, domainLeave.localStorage=false", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", false);
                settings.set("domainLeave.localStorage", false);
                settings.save();
            });
            it("should not do anything", () => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanByDomainWithRules(OPEN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
                browserMock.browsingData.remove.assertNoCall();
            });
        });
        context("domainLeave.enabled = true, domainLeave.cookies=false, domainLeave.localStorage=true", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", false);
                settings.set("domainLeave.localStorage", true);
                settings.save();
            });
            it("should clean localstorage, but not do anything on cookies", () => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanByDomainWithRules(UNKNOWN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
                browserMock.browsingData.remove.assertCalls([[{
                    originTypes: { unprotectedWeb: true },
                    hostnames: [UNKNOWN_DOMAIN]
                }, { localStorage: true }]]);
            });
            it("should not clean localstorage if the domain is protected", () => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanByDomainWithRules(OPEN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
                browserMock.browsingData.remove.assertNoCall();

                cleanStore.cleanByDomainWithRules(WHITELISTED_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
                browserMock.browsingData.remove.assertNoCall();

                cleanStore.cleanByDomainWithRules(GRAYLISTED_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
                browserMock.browsingData.remove.assertNoCall();
            });
        });
        context("domainLeave.enabled = true, domainLeave.cookies=true, domainLeave.localStorage=false", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", true);
                settings.set("domainLeave.localStorage", false);
                settings.save();

                // should clean subdomain cookies as well
                setCookie(UNKNOWN_SUBDOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
            });
            it("should not clean localstorage, but should clean cookies", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanByDomainWithRules(UNKNOWN_DOMAIN);
                browserMock.browsingData.remove.assertNoCall();
                assertRemainingCookieDomains(done, [OPEN_DOMAIN, OPEN_DOMAIN2, UNKNOWN_DOMAIN2, WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN, BLACKLISTED_DOMAIN]);
            });
        });
    });

    describe("isLocalStorageProtected", () => {
        it("should return true for an open domain and for protected domains, false otherwise", () => {
            cleanStore = ensureNotNull(cleanStore);
            assert.isTrue(cleanStore.isLocalStorageProtected(OPEN_DOMAIN));
            assert.isTrue(cleanStore.isLocalStorageProtected(GRAYLISTED_DOMAIN));
            assert.isTrue(cleanStore.isLocalStorageProtected(WHITELISTED_DOMAIN));
            assert.isFalse(cleanStore.isLocalStorageProtected(UNKNOWN_DOMAIN));
        });
    });

    describe("isCookieAllowed", () => {
        function testCookieAllowed(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean, expected: boolean, done: MochaDone, doneCondition?: () => boolean) {
            browser.cookies.getAll({
                firstPartyDomain: null,
                storeId: COOKIE_STORE_ID
            }).then(doneHandler((cookies: Cookies.Cookie[]) => {
                const cookie = cookies.find((c) => c.domain === domain);
                assert.isDefined(cookie);
                if (cookie) {
                    cleanStore = ensureNotNull(cleanStore);
                    assert.equal(cleanStore.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains), expected);
                }
            }, done, doneCondition));
        }
        it("should return true if the matching rule is never", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 4;
            testCookieAllowed(WHITELISTED_DOMAIN, true, true, true, done, doneCondition);
            testCookieAllowed(WHITELISTED_DOMAIN, false, true, true, done, doneCondition);
            testCookieAllowed(WHITELISTED_DOMAIN, false, false, true, done, doneCondition);
            testCookieAllowed(WHITELISTED_DOMAIN, true, false, true, done, doneCondition);
        });
        it("should return true if the matching rule is startup and ignoreStartupType=false", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 2;
            testCookieAllowed(GRAYLISTED_DOMAIN, false, false, true, done, doneCondition);
            testCookieAllowed(GRAYLISTED_DOMAIN, false, true, true, done, doneCondition);
        });
        it("should return true if the matching rule is startup and ignoreStartupType=false", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 2;
            testCookieAllowed(GRAYLISTED_DOMAIN, false, false, true, done, doneCondition);
            testCookieAllowed(GRAYLISTED_DOMAIN, false, true, true, done, doneCondition);
        });
        it("should return false if the matching rule is instantly", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 4;
            testCookieAllowed(BLACKLISTED_DOMAIN, true, true, false, done, doneCondition);
            testCookieAllowed(BLACKLISTED_DOMAIN, false, true, false, done, doneCondition);
            testCookieAllowed(BLACKLISTED_DOMAIN, false, false, false, done, doneCondition);
            testCookieAllowed(BLACKLISTED_DOMAIN, true, false, false, done, doneCondition);
        });
        it("should return false if the matching rule is leave and protectOpenDomains = false", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 2;
            testCookieAllowed(UNKNOWN_DOMAIN, false, false, false, done, doneCondition);
            testCookieAllowed(UNKNOWN_DOMAIN, true, false, false, done, doneCondition);
        });
        it("should return false if the matching rule is startup, ignoreStartupType = true and protectOpenDomains = false", (done) => {
            testCookieAllowed(GRAYLISTED_DOMAIN, true, false, false, done);
        });
        it("should return true if protectOpenDomains = true and cookie has firstpartydomain, which is on watcher", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 2;
            testCookieAllowed(OPEN_DOMAIN2, true, true, true, done, doneCondition);
            testCookieAllowed(OPEN_DOMAIN2, false, true, true, done, doneCondition);
        });
        it("should return false if protectOpenDomains = true and cookie has firstpartydomain, which is not on watcher", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 2;
            testCookieAllowed(UNKNOWN_DOMAIN2, true, true, false, done, doneCondition);
            testCookieAllowed(UNKNOWN_DOMAIN2, false, true, false, done, doneCondition);
        });
        it("should return true if protectOpenDomains = true and first party domain of cookie is on watcher", (done) => {
            let count = 0;
            const doneCondition = () => ++count === 2;
            testCookieAllowed(OPEN_DOMAIN, true, true, true, done, doneCondition);
            testCookieAllowed(OPEN_DOMAIN, false, true, true, done, doneCondition);
        });
    });

    describe("cleanDomainNow", () => {
        context("Non-first-party-domain cookies", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", false);
                settings.set("domainLeave.cookies", false);
                settings.set("domainLeave.localStorage", false);
                settings.save();
            });
            it("should clean regardless of rules and settings", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanDomainNow(WHITELISTED_DOMAIN);
                browserMock.browsingData.remove.assertCalls([[{
                    originTypes: { unprotectedWeb: true },
                    hostnames: [WHITELISTED_DOMAIN]
                }, { localStorage: true }]]);

                assertRemainingCookieDomains(done, [OPEN_DOMAIN, OPEN_DOMAIN2, UNKNOWN_DOMAIN, UNKNOWN_DOMAIN2, GRAYLISTED_DOMAIN, BLACKLISTED_DOMAIN]);
            });
        });
        context("First-party-domain cookies", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", false);
                settings.set("domainLeave.cookies", false);
                settings.set("domainLeave.localStorage", false);
                settings.save();
                browserMock.cookies.reset();
                setCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                setCookie(GRAYLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, BLACKLISTED_DOMAIN);
            });
            it("should not remove cookies which have a first party domain if that first party domain is not the one to be cleaned", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanDomainNow(WHITELISTED_DOMAIN);

                assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN]);
            });
            it("should remove cookies which have a first party domain if that first party domain is the one to be cleaned", (done) => {
                cleanStore = ensureNotNull(cleanStore);
                cleanStore.cleanDomainNow(UNKNOWN_DOMAIN);

                assertRemainingCookieDomains(done, [GRAYLISTED_DOMAIN]);
            });
        });
    });
});
