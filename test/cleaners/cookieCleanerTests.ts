/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { browser, BrowsingData, Cookies } from "webextension-polyfill-ts";
import { TabWatcher } from "../../src/background/tabWatcher";
import { RecentlyAccessedDomains } from "../../src/background/recentlyAccessedDomains";
import { browserMock } from "../browserMock";
import { destroyAndNull, destroyAllAndEmpty } from "../../src/shared";
import { settings } from "../../src/lib/settings";
import { CleanupType } from "../../src/lib/settingsSignature";
import { CookieCleaner, removeCookie } from "../../src/background/cleaners/cookieCleaner";
import { ensureNotNull, doneHandler, booleanVariations, sleep, createSpy } from "../testHelpers";
import { messageUtil, ReceiverHandle } from "../../src/lib/messageUtil";

const COOKIE_STORE_ID = "mock";
const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const BLACKLISTED_DOMAIN = "instantly.com";
const OPEN_DOMAIN = "open.com";
const OPEN_DOMAIN2 = "open2.com";
const UNKNOWN_DOMAIN = "unknown.com";
const UNKNOWN_DOMAIN2 = "unknown2.com";
const UNKNOWN_SUBDOMAIN = "sub.unknown.com";

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

function simpleCookieRemove(domain: string, name: string, path: string, storeId: string, firstPartyDomain: string, secure: boolean = false) {
    return removeCookie({
        name,
        domain,
        path,
        storeId,
        firstPartyDomain,
        value: "",
        hostOnly: false,
        secure,
        httpOnly: false,
        session: false,
        sameSite: "no_restriction"
    });
}

function assertRemainingCookieDomains(done: MochaDone, domainList: string[], storeId = COOKIE_STORE_ID) {
    setTimeout(() => {
        browser.cookies.getAll({
            firstPartyDomain: null,
            storeId
        }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.sameMembers(cookies.map((c) => c.domain), domainList);
        }, done));
    }, 10);
}

describe("removeCookie", () => {
    const receivers: ReceiverHandle[] = [];

    beforeEach((done) => {
        messageUtil.clearCallbacksMap();
        browserMock.reset();

        setCookie("google.com", "hello", "world", "", "firefox-default", "");
        setCookie("google.com", "foo", "bar", "", "firefox-default", "");
        setCookie("google.com", "oh_long", "johnson", "", "firefox-default", "");
        setCookie("google.de", "hello", "world", "", "firefox-default", "");
        setCookie("google.de", "foo", "bar", "", "firefox-default", "");
        setCookie("google.com", "hello", "world", "", "firefox-default-2", "");
        setCookie("google.com", "foo", "bar", "", "firefox-default-2", "");
        setCookie("", "foo", "bar", "/C:/path/to/somewhere/", "firefox-default", "");

        let doneCount = 0;
        browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.strictEqual(cookies.length, 6);
        }, done, () => (++doneCount === 2)));
        browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.strictEqual(cookies.length, 2);
        }, done, () => (++doneCount === 2)));
    });

    afterEach(() => {
        destroyAllAndEmpty(receivers);
    });

    it("should emit cookieRemoved event", () => {
        const spy = createSpy();
        receivers.push(messageUtil.receive("cookieRemoved", spy));
        simpleCookieRemove("google.com", "hello", "", "firefox-default", "");
        simpleCookieRemove("google.com", "foo", "", "firefox-default", "");
        simpleCookieRemove("google.de", "hello", "", "firefox-default", "");
        simpleCookieRemove("google.de", "foo", "", "firefox-default", "");
        simpleCookieRemove("google.com", "hello", "", "firefox-default-2", "");
        simpleCookieRemove("google.com", "foo", "", "firefox-default-2", "");
        simpleCookieRemove("", "foo", "/C:/path/to/somewhere/", "firefox-default", "");
        spy.assertCalls([
            ["google.com", {}],
            ["google.com", {}],
            ["google.de", {}],
            ["google.de", {}],
            ["google.com", {}],
            ["google.com", {}],
            ["/C:/path/to/somewhere/", {}]
        ]);
    });
    it("should remove cookies from the specified store", (done) => {
        simpleCookieRemove("google.com", "hello", "", "firefox-default", "");
        simpleCookieRemove("google.com", "foo", "", "firefox-default", "");
        simpleCookieRemove("google.com", "foo", "", "firefox-default-2", "");
        let doneCount = 0;
        browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.strictEqual(cookies.length, 4);
            assert.isUndefined(cookies.find((c) => c.name === "hello" && c.domain === "google.com"));
            assert.isUndefined(cookies.find((c) => c.name === "foo" && c.domain === "google.com"));
            assert.notEqual(cookies.findIndex((c) => c.name === "oh_long" && c.domain === "google.com"), -1);
        }, done, () => (++doneCount === 2)));
        browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.strictEqual(cookies.length, 1);
            assert.notEqual(cookies.findIndex((c) => c.name === "hello" && c.domain === "google.com"), -1);
            assert.isUndefined(cookies.find((c) => c.name === "foo" && c.domain === "google.com"));
        }, done, () => (++doneCount === 2)));
    });

    it("should call browser.cookies.remove with the correct parameters", () => {
        simpleCookieRemove("google.com", "hello", "", "firefox-default", "");
        simpleCookieRemove("google.com", "foo", "", "firefox-default", "");
        simpleCookieRemove("google.com", "foo", "", "firefox-default-2", "");
        simpleCookieRemove("google.de", "foo", "", "firefox-default", "", true);
        simpleCookieRemove("", "foo", "/C:/path/to/somewhere/", "firefox-default", "");

        browserMock.cookies.remove.assertCalls([
            [{ name: "hello", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "http://google.com", storeId: "firefox-default-2", firstPartyDomain: "" }],
            [{ name: "foo", url: "https://google.de", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "file:///C:/path/to/somewhere/", storeId: "firefox-default", firstPartyDomain: "" }]
        ]);
    });
});

describe("CookieCleaner", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let tabWatcher: TabWatcher | null = null;
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let cleaner: CookieCleaner | null = null;

    afterEach(() => {
        recentlyAccessedDomains = destroyAndNull(recentlyAccessedDomains);
        tabWatcher = destroyAndNull(tabWatcher);
        cleaner = null;
        settings.restoreDefaults();
    });

    beforeEach(() => {
        browserMock.reset();
        recentlyAccessedDomains = new RecentlyAccessedDomains();
        tabWatcher = new TabWatcher(tabWatcherListener, recentlyAccessedDomains);

        const tabIds = [
            browserMock.tabs.create(`http://${OPEN_DOMAIN}`, COOKIE_STORE_ID),
            browserMock.tabs.create(`http://${OPEN_DOMAIN2}`, COOKIE_STORE_ID)
        ];
        browserMock.cookies.cookieStores = [
            { id: COOKIE_STORE_ID, tabIds, incognito: false }
        ];
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
        cleaner = new CookieCleaner(tabWatcher, recentlyAccessedDomains);
    });

    describe("clean", () => {
        const typeSet: BrowsingData.DataTypeSet = {
            cookies: true
        };
        beforeEach(() => {
            typeSet.cookies = true;
        });

        booleanVariations(4).forEach(([cookies, startup, startupApplyRules, cleanAllApplyRules]) => {
            context(`cookies=${cookies}, startup = ${startup}, startupApplyRules = ${startupApplyRules}, startupApplyRules = ${cleanAllApplyRules}`, () => {
                beforeEach(() => {
                    typeSet.cookies = cookies;
                    settings.set("startup.cookies.applyRules", startupApplyRules);
                    settings.set("cleanAll.cookies.applyRules", cleanAllApplyRules);
                    settings.save();
                });
                if (cookies && (startup && startupApplyRules || !startup && cleanAllApplyRules)) {
                    it("should clean up", () => {
                        cleaner = ensureNotNull(cleaner);
                        cleaner.clean(typeSet, startup);
                        browserMock.cookies.getAllCookieStores.assertCalls([[]]);
                        assert.isFalse(typeSet.cookies);
                    });
                } else {
                    it("should not do anything", () => {
                        cleaner = ensureNotNull(cleaner);
                        cleaner.clean(typeSet, startup);
                        browserMock.cookies.getAllCookieStores.assertNoCall();
                        assert.strictEqual(typeSet.cookies, cookies);
                    });
                }
            });
        });

        [true, false].forEach((protectOpenDomains) => {
            context(`startup = true, protectOpenDomains = ${protectOpenDomains}`, () => {
                beforeEach(() => {
                    settings.set("cleanAll.protectOpenDomains", protectOpenDomains);
                    settings.save();
                });
                it("should protect whitelisted cookies and open domains", (done) => {
                    cleaner = ensureNotNull(cleaner);
                    cleaner.clean(typeSet, true);
                    assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN, OPEN_DOMAIN, OPEN_DOMAIN2]);
                    assert.isFalse(typeSet.cookies);
                });
            });
        });
        context("startup = false, protectOpenDomains = true", () => {
            beforeEach(() => {
                settings.set("cleanAll.protectOpenDomains", true);
                settings.save();
            });
            it("should protect whitelisted and graylisted cookies, as well as open domains", (done) => {
                cleaner = ensureNotNull(cleaner);
                cleaner.clean(typeSet, false);
                assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN, OPEN_DOMAIN, OPEN_DOMAIN2]);
                assert.isFalse(typeSet.cookies);
            });
        });
        context("startup = false, protectOpenDomains = false", () => {
            beforeEach(() => {
                settings.set("cleanAll.protectOpenDomains", false);
                settings.save();
            });
            it("should protect whitelisted and graylisted cookies", (done) => {
                cleaner = ensureNotNull(cleaner);
                cleaner.clean(typeSet, false);
                assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN]);
                assert.isFalse(typeSet.cookies);
            });
        });
    });

    describe("cleanDomainOnLeave", () => {
        context("domainLeave.enabled = false", () => {
            beforeEach(() => {
                assert.isFalse(settings.get("domainLeave.enabled"));
            });
            it("should not do anything", () => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
            });
        });
        context("domainLeave.enabled = true, domainLeave.cookies=false", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", false);
                settings.save();
            });
            it("should not do anything", () => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
            });
        });
        context("domainLeave.enabled = true, domainLeave.cookies=false", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", false);
                settings.save();
            });
            it("should not do anything on cookies", () => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
            });
            it("should not clean anything if the domain is protected", () => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();

                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, WHITELISTED_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();

                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, GRAYLISTED_DOMAIN);

                browserMock.cookies.remove.assertNoCall();
                browserMock.cookies.getAll.assertNoCall();
            });
        });
        context("domainLeave.enabled = true, domainLeave.cookies=true", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", true);
                settings.save();

                // should clean subdomain cookies as well
                setCookie(UNKNOWN_SUBDOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
            });
            it("should clean cookies", (done) => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                assertRemainingCookieDomains(done, [OPEN_DOMAIN, OPEN_DOMAIN2, UNKNOWN_DOMAIN2, WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN, BLACKLISTED_DOMAIN]);
            });
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
                    cleaner = ensureNotNull(cleaner);
                    assert.strictEqual(cleaner.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains), expected);
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

    describe("cleanDomain", () => {
        context("Non-first-party-domain cookies", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", false);
                settings.set("domainLeave.cookies", false);
                settings.save();
            });
            it("should clean regardless of rules and settings", (done) => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomain(COOKIE_STORE_ID, WHITELISTED_DOMAIN);

                assertRemainingCookieDomains(done, [OPEN_DOMAIN, OPEN_DOMAIN2, UNKNOWN_DOMAIN, UNKNOWN_DOMAIN2, GRAYLISTED_DOMAIN, BLACKLISTED_DOMAIN]);
            });
        });
        context("First-party-domain cookies", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", false);
                settings.set("domainLeave.cookies", false);
                settings.save();
                browserMock.cookies.resetCookies();
                setCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                setCookie(GRAYLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, BLACKLISTED_DOMAIN);
            });
            it("should not remove cookies which have a first party domain if that first party domain is not the one to be cleaned", (done) => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomain(COOKIE_STORE_ID, WHITELISTED_DOMAIN);

                assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN]);
            });
            it("should remove cookies which have a first party domain if that first party domain is the one to be cleaned", (done) => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomain(COOKIE_STORE_ID, UNKNOWN_DOMAIN);

                assertRemainingCookieDomains(done, [GRAYLISTED_DOMAIN]);
            });
        });
    });

    describe("onCookieChanged", () => {
        beforeEach(() => {
            browserMock.cookies.resetCookies();
        });

        booleanVariations(4).forEach(([incognito, instantlyEnabled, instantlyCookies, snoozing]) => {
            context(`incognito = ${incognito}, instantly.enabled = ${instantlyEnabled}, instantly.cookies = ${instantlyCookies}, snoozing = ${snoozing}`, () => {
                beforeEach(() => {
                    settings.set("instantly.enabled", instantlyEnabled);
                    settings.set("instantly.cookies", instantlyCookies);
                    settings.save();
                    ensureNotNull(cleaner).setSnoozing(snoozing);
                });
                if (!incognito && instantlyEnabled && instantlyCookies) {
                    it("Should remove blacklisted cookies", (done) => {
                        cleaner = ensureNotNull(cleaner);
                        setCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                        assertRemainingCookieDomains(done, []);
                    });
                    it("Should not remove whitelisted cookies", (done) => {
                        cleaner = ensureNotNull(cleaner);
                        setCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                        assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN]);
                    });
                } else {
                    const localCookieStoreId = incognito ? "firefox-private" : COOKIE_STORE_ID;
                    it("Should not remove blacklisted cookies", (done) => {
                        cleaner = ensureNotNull(cleaner);
                        setCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", localCookieStoreId, "");
                        assertRemainingCookieDomains(done, [BLACKLISTED_DOMAIN], localCookieStoreId);
                    });
                    it("Should not remove whitelisted cookies", (done) => {
                        cleaner = ensureNotNull(cleaner);
                        setCookie(WHITELISTED_DOMAIN, "foo", "bar", "", localCookieStoreId, "");
                        assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN], localCookieStoreId);
                    });
                }
            });
        });

        booleanVariations(5).forEach(([incognito, thirdPartyEnabled, snoozing, delayed, whitelisted]) => {
            const delay = delayed ? 0.01 : 0; // in seconds
            const localCookieStoreId = incognito ? "firefox-private" : COOKIE_STORE_ID;
            const localDomain = whitelisted ? WHITELISTED_DOMAIN : UNKNOWN_DOMAIN;
            context(`incognito = ${incognito}, cleanThirdPartyCookies.enabled = ${thirdPartyEnabled}, cleanThirdPartyCookies.delay = ${delay}s, snoozing = ${snoozing}, whitelisted=${whitelisted}`, () => {
                beforeEach(() => {
                    settings.set("cleanThirdPartyCookies.enabled", thirdPartyEnabled);
                    settings.set("cleanThirdPartyCookies.delay", delay);
                    settings.save();
                    ensureNotNull(cleaner).setSnoozing(snoozing);
                });
                if (!incognito && thirdPartyEnabled && !snoozing && !whitelisted) {
                    it(`Should remove cookie${delayed ? " delayed" : ""}`, function (done) {
                        this.slow(300);
                        cleaner = ensureNotNull(cleaner);
                        setCookie(localDomain, "foo", "bar", "", localCookieStoreId, "");
                        const finalAssert = () => assertRemainingCookieDomains(done, [], localCookieStoreId);
                        if (delayed)
                            assertRemainingCookieDomains((e) => e ? done(e) : sleep(100).then(finalAssert), [localDomain], localCookieStoreId);
                        else
                            finalAssert();
                    });
                } else {
                    it(`Should not remove cookie${delayed ? " delayed" : ""}`, function (done) {
                        this.slow(300);
                        cleaner = ensureNotNull(cleaner);
                        setCookie(localDomain, "foo", "bar", "", localCookieStoreId, "");
                        const finalAssert = () => assertRemainingCookieDomains(done, [localDomain], localCookieStoreId);
                        if (delayed)
                            assertRemainingCookieDomains((e) => e ? done(e) : sleep(100).then(finalAssert), [localDomain], localCookieStoreId);
                        else
                            finalAssert();
                    });
                }
            });
        });
    });
});
