/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { browser, BrowsingData, Cookies } from "webextension-polyfill-ts";
import { TabWatcher } from "../../src/background/tabWatcher";
import { browserMock } from "../browserMock";
import { settings } from "../../src/lib/settings";
import { CleanupType } from "../../src/lib/settingsSignature";
import { CookieCleaner } from "../../src/background/cleaners/cookieCleaner";
import { ensureNotNull, doneHandler, sleep, createSpy, booleanContext } from "../testHelpers";
import { messageUtil, ReceiverHandle } from "../../src/lib/messageUtil";
import { IncognitoWatcher } from "../../src/background/incognitoWatcher";
import { quickSetCookie, quickRemoveCookie } from "../quickHelpers";

const COOKIE_STORE_ID = "mock";
const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const BLACKLISTED_DOMAIN = "instantly.com";
const OPEN_DOMAIN = "open.com";
const OPEN_DOMAIN2 = "open2.com";
const UNKNOWN_DOMAIN = "unknown.com";
const UNKNOWN_DOMAIN2 = "unknown2.com";
const UNKNOWN_SUBDOMAIN = "sub.unknown.com";

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

        quickSetCookie("google.com", "hello", "world", "", "firefox-default", "");
        quickSetCookie("google.com", "foo", "bar", "", "firefox-default", "");
        quickSetCookie("google.com", "oh_long", "johnson", "", "firefox-default", "");
        quickSetCookie("google.de", "hello", "world", "", "firefox-default", "");
        quickSetCookie("google.de", "foo", "bar", "", "firefox-default", "");
        quickSetCookie("google.com", "hello", "world", "", "firefox-default-2", "");
        quickSetCookie("google.com", "foo", "bar", "", "firefox-default-2", "");
        quickSetCookie("", "foo", "bar", "/C:/path/to/somewhere/", "firefox-default", "");

        let doneCount = 0;
        browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.strictEqual(cookies.length, 6);
        }, done, () => (++doneCount === 2)));
        browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
            assert.strictEqual(cookies.length, 2);
        }, done, () => (++doneCount === 2)));
    });

    it("should emit cookieRemoved event", () => {
        const spy = createSpy();
        receivers.push(messageUtil.receive("cookieRemoved", spy));
        quickRemoveCookie("google.com", "hello", "", "firefox-default", "");
        quickRemoveCookie("google.com", "foo", "", "firefox-default", "");
        quickRemoveCookie("google.de", "hello", "", "firefox-default", "");
        quickRemoveCookie("google.de", "foo", "", "firefox-default", "");
        quickRemoveCookie("google.com", "hello", "", "firefox-default-2", "");
        quickRemoveCookie("google.com", "foo", "", "firefox-default-2", "");
        quickRemoveCookie("", "foo", "/C:/path/to/somewhere/", "firefox-default", "");
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
        quickRemoveCookie("google.com", "hello", "", "firefox-default", "");
        quickRemoveCookie("google.com", "foo", "", "firefox-default", "");
        quickRemoveCookie("google.com", "foo", "", "firefox-default-2", "");
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
        quickRemoveCookie("google.com", "hello", "", "firefox-default", "");
        quickRemoveCookie("google.com", "foo", "", "firefox-default", "");
        quickRemoveCookie("google.com", "foo", "", "firefox-default-2", "");
        quickRemoveCookie("google.de", "foo", "", "firefox-default", "", true);
        quickRemoveCookie("", "foo", "/C:/path/to/somewhere/", "firefox-default", "");

        browserMock.cookies.remove.assertCalls([
            [{ name: "hello", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "http://google.com", storeId: "firefox-default-2", firstPartyDomain: "" }],
            [{ name: "foo", url: "https://google.de", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "file:///C:/path/to/somewhere/", storeId: "firefox-default", firstPartyDomain: "" }]
        ]);
    });
});

// Fixme: cleanup with frames
describe("CookieCleaner", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let tabWatcher: TabWatcher | null = null;
    let cleaner: CookieCleaner | null = null;
    let incognitoWatcher: IncognitoWatcher | null = null;

    afterEach(() => {
        tabWatcher = null;
        cleaner = null;
        settings.restoreDefaults();
    });

    beforeEach(() => {
        browserMock.reset();
        tabWatcher = new TabWatcher(tabWatcherListener);
        incognitoWatcher = new IncognitoWatcher();

        const tabIds = [
            browserMock.tabs.create(`http://${OPEN_DOMAIN}`, COOKIE_STORE_ID),
            browserMock.tabs.create(`http://${OPEN_DOMAIN2}`, COOKIE_STORE_ID)
        ];
        browserMock.cookies.cookieStores = [
            { id: COOKIE_STORE_ID, tabIds, incognito: false }
        ];
        quickSetCookie(OPEN_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(OPEN_DOMAIN2, "foo", "bar", "", COOKIE_STORE_ID, OPEN_DOMAIN2);
        quickSetCookie(UNKNOWN_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(UNKNOWN_DOMAIN2, "foo", "bar", "", COOKIE_STORE_ID, UNKNOWN_DOMAIN2);
        quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(GRAYLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        settings.set("rules", [
            { rule: WHITELISTED_DOMAIN, type: CleanupType.NEVER },
            { rule: GRAYLISTED_DOMAIN, type: CleanupType.STARTUP },
            { rule: BLACKLISTED_DOMAIN, type: CleanupType.INSTANTLY }
        ]);
        settings.save();
        cleaner = new CookieCleaner(tabWatcher, incognitoWatcher);
    });

    describe("clean", () => {
        const typeSet: BrowsingData.DataTypeSet = {
            cookies: true
        };
        beforeEach(() => {
            typeSet.cookies = true;
        });

        booleanContext((cookies, startup, startupApplyRules, cleanAllApplyRules) => {
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

        booleanContext((protectOpenDomains) => {
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
                quickSetCookie(UNKNOWN_SUBDOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
            });
            it("should clean cookies", (done) => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                assertRemainingCookieDomains(done, [OPEN_DOMAIN, OPEN_DOMAIN2, UNKNOWN_DOMAIN2, WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN, BLACKLISTED_DOMAIN]);
            });
        });
    });

    describe("isCookieAllowed", () => {
        // fixme: protectSubFrames = false
        function testCookieAllowed(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean, expected: boolean, done: MochaDone, doneCondition?: () => boolean) {
            browser.cookies.getAll({
                firstPartyDomain: null,
                storeId: COOKIE_STORE_ID
            }).then(doneHandler((cookies: Cookies.Cookie[]) => {
                const cookie = cookies.find((c) => c.domain === domain);
                assert.isDefined(cookie);
                if (cookie) {
                    cleaner = ensureNotNull(cleaner);
                    assert.strictEqual(cleaner.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains, true), expected);
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
                quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                quickSetCookie(GRAYLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, BLACKLISTED_DOMAIN);
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

        booleanContext((incognito, instantlyEnabled, instantlyCookies, snoozing) => {
            beforeEach(() => {
                browserMock.tabs.create("", COOKIE_STORE_ID, incognito);
                settings.set("instantly.enabled", instantlyEnabled);
                settings.set("instantly.cookies", instantlyCookies);
                settings.save();
                ensureNotNull(cleaner).setSnoozing(snoozing);
            });
            if (!incognito && instantlyEnabled && instantlyCookies) {
                it("Should remove blacklisted cookies", (done) => {
                    cleaner = ensureNotNull(cleaner);
                    quickSetCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    assertRemainingCookieDomains(done, []);
                });
                it("Should not remove whitelisted cookies", (done) => {
                    cleaner = ensureNotNull(cleaner);
                    quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN]);
                });
            } else {
                it("Should not remove blacklisted cookies", (done) => {
                    cleaner = ensureNotNull(cleaner);
                    quickSetCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    assertRemainingCookieDomains(done, [BLACKLISTED_DOMAIN], COOKIE_STORE_ID);
                });
                it("Should not remove whitelisted cookies", (done) => {
                    cleaner = ensureNotNull(cleaner);
                    quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    assertRemainingCookieDomains(done, [WHITELISTED_DOMAIN], COOKIE_STORE_ID);
                });
            }
        });

        booleanContext((incognito, thirdPartyEnabled, snoozing, delayed, whitelisted) => {
            const delay = delayed ? 0.1 : 0; // in seconds
            const localDomain = whitelisted ? WHITELISTED_DOMAIN : UNKNOWN_DOMAIN;
            beforeEach(() => {
                browserMock.tabs.create("", COOKIE_STORE_ID, incognito);
                settings.set("cleanThirdPartyCookies.enabled", thirdPartyEnabled);
                settings.set("cleanThirdPartyCookies.delay", delay);
                settings.save();
                ensureNotNull(cleaner).setSnoozing(snoozing);
            });
            if (!incognito && thirdPartyEnabled && !snoozing && !whitelisted) {
                it(`Should remove cookie${delayed ? " delayed" : ""}`, function (done) {
                    this.slow(300);
                    cleaner = ensureNotNull(cleaner);
                    quickSetCookie(localDomain, "foo", "bar", "", COOKIE_STORE_ID, "");
                    const finalAssert = () => assertRemainingCookieDomains(done, [], COOKIE_STORE_ID);
                    if (delayed)
                        assertRemainingCookieDomains((e) => e ? done(e) : sleep(100).then(finalAssert), [localDomain], COOKIE_STORE_ID);
                    else
                        finalAssert();
                });
            } else {
                it(`Should not remove cookie${delayed ? " delayed" : ""}`, function (done) {
                    this.slow(300);
                    cleaner = ensureNotNull(cleaner);
                    quickSetCookie(localDomain, "foo", "bar", "", COOKIE_STORE_ID, "");
                    const finalAssert = () => assertRemainingCookieDomains(done, [localDomain], COOKIE_STORE_ID);
                    if (delayed)
                        assertRemainingCookieDomains((e) => e ? done(e) : sleep(100).then(finalAssert), [localDomain], COOKIE_STORE_ID);
                    else
                        finalAssert();
                });
            }
        });
    });
});
