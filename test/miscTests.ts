/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { getValidHostname, destroyAllAndEmpty } from "../src/shared";
import { getFirstPartyCookieDomain, parseSetCookieHeader, badges, getBadgeForCleanupType, getAllCookieStoreIds, getCookieStoreIncognito } from "../src/background/backgroundHelpers";
import { browser, Cookies } from "webextension-polyfill-ts";
import { removeCookie, cleanLocalStorage } from "../src/background/backgroundShared";
import { messageUtil, ReceiverHandle } from "../src/lib/messageUtil";
import { browserMock } from "./browserMock";
import { createSpy, doneHandler } from "./testHelpers";
import { settings } from "../src/lib/settings";
import { CleanupType } from "../src/lib/settingsSignature";

describe("Misc functionality", () => {
    const receivers: ReceiverHandle[] = [];
    beforeEach(() => browserMock.reset());
    afterEach(() => {
        destroyAllAndEmpty(receivers);
    });

    describe("getValidHostname", () => {
        it("should return hostnames for valid urls", () => {
            assert.strictEqual(getValidHostname("http://www.google.com"), "www.google.com");
            assert.strictEqual(getValidHostname("https://www.google.com"), "www.google.com");
        });
        it("should return emptystring for invalid urls", () => {
            assert.strictEqual(getValidHostname("hhttp://www.google.com"), "");
            assert.strictEqual(getValidHostname("httpss://www.google.com"), "");
            assert.strictEqual(getValidHostname("file://www.google.com"), "");
            assert.strictEqual(getValidHostname("chrome://www.google.com"), "");
            assert.strictEqual(getValidHostname("about:preferences"), "");
            assert.strictEqual(getValidHostname("Bu][$<|-|!7"), "");
            assert.strictEqual(getValidHostname(null as any), "");
        });
    });

    describe("getFirstPartyCookieDomain", () => {
        it("should return first party domains for valid cookie domains", () => {
            assert.strictEqual(getFirstPartyCookieDomain("www.google.com"), "google.com");
            assert.strictEqual(getFirstPartyCookieDomain(".google.com"), "google.com");
            assert.strictEqual(getFirstPartyCookieDomain("google.com"), "google.com");
            assert.strictEqual(getFirstPartyCookieDomain(".michelgagne.blogspot.de"), "michelgagne.blogspot.de");
            assert.strictEqual(getFirstPartyCookieDomain("michelgagne.blogspot.de"), "michelgagne.blogspot.de");
            assert.strictEqual(getFirstPartyCookieDomain("hello.michelgagne.blogspot.de"), "michelgagne.blogspot.de");
        });
    });

    describe("parseSetCookieHeader", () => {
        const fallbackDomain = "fallback.de";
        it("should parse set-cookie headers correctly", () => {
            assert.deepEqual(parseSetCookieHeader("hello=world;domain=www.google.de", fallbackDomain), {
                name: "hello",
                value: "world",
                domain: "www.google.de"
            });
            // fixme: not sure if whitespaces should be trimmed from key and value...
            assert.deepEqual(parseSetCookieHeader("foo = bar; domain=www.google.com", fallbackDomain), {
                name: "foo",
                value: "bar",
                domain: "www.google.com"
            });
            assert.deepEqual(parseSetCookieHeader("foo=bar; domain=.google.com", fallbackDomain), {
                name: "foo",
                value: "bar",
                domain: ".google.com"
            });
            assert.deepEqual(parseSetCookieHeader("foo=bar; shit=.google.com", fallbackDomain), {
                name: "foo",
                value: "bar",
                domain: fallbackDomain
            });
            assert.deepEqual(parseSetCookieHeader("foo=bar", fallbackDomain), {
                name: "foo",
                value: "bar",
                domain: fallbackDomain
            });
            assert.deepEqual(parseSetCookieHeader("foo=bar;some-domain=www.google.de;domain=mail.google.com", fallbackDomain), {
                name: "foo",
                value: "bar",
                domain: "mail.google.com"
            });
            assert.deepEqual(parseSetCookieHeader("foo=bar;domain=mail.google.com;domain=www.google.de", fallbackDomain), {
                name: "foo",
                value: "bar",
                domain: "mail.google.com"
            });
        });
        it("should return null if set-cookie headers is invalid", () => {
            assert.strictEqual(parseSetCookieHeader("hello; domain=www.google.de", fallbackDomain), null);
            assert.strictEqual(parseSetCookieHeader("", fallbackDomain), null);
        });
    });

    describe("getBadgeForCleanupType", () => {
        [
            { type: CleanupType.NEVER, badge: badges.never },
            { type: CleanupType.STARTUP, badge: badges.startup },
            { type: CleanupType.LEAVE, badge: badges.leave },
            { type: CleanupType.INSTANTLY, badge: badges.instantly },
            { type: "unknown" as any as CleanupType, badge: badges.leave }
        ].forEach(({ type, badge }) => {
            it(`should return the correct badge for ${type}`, () => {
                assert.strictEqual(getBadgeForCleanupType(type), badge);
            });
        });
    });

    describe("getAllCookieStoreIds", () => {
        beforeEach(() => {
            browserMock.cookies.cookieStores = [
                { id: "cs-1", tabIds: [], incognito: false },
                { id: "cs-2", tabIds: [], incognito: false },
                { id: "cs-4", tabIds: [], incognito: false }
            ];
            browserMock.contextualIdentities.contextualIdentities = [
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-1" },
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-2" },
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-4" }
            ];
        });
        it("should return the correct cookie store ids", (done) => {
            getAllCookieStoreIds().then(doneHandler((ids: string[]) => {
                assert.sameMembers(ids, ["firefox-default", "firefox-private", "cs-1", "cs-2", "cs-4", "ci-1", "ci-2", "ci-4"]);
            }, done));
        });
    });

    describe("getCookieStoreIncognito", () => {
        beforeEach(() => {
            browserMock.cookies.cookieStores = [
                { id: "my-default", tabIds: [browserMock.tabs.create("something", "my-default", false)], incognito: false },
                { id: "my-pryvate", tabIds: [browserMock.tabs.create("something", "my-pryvate", true)], incognito: true }
            ];
        });

        [
            { storeId: "private", result: true },
            { storeId: "anything-private-anything", result: true },
            { storeId: "firefox", result: false },
            { storeId: "anything-firefox-anything", result: false },
            { storeId: "my-default", result: false },
            { storeId: "my-pryvate", result: true }
        ].forEach(({ storeId, result }) => {
            // tslint:disable-next-line:only-arrow-functions
            it(`Should return ${result} for storeId ${storeId}`, function (done) {
                getCookieStoreIncognito(storeId).then(doneHandler((incognito: boolean) => {
                    assert.strictEqual(incognito, result);
                }, done));
            });
        });
    });

    describe("removeCookie", () => {
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
        beforeEach((done) => {
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

    describe("cleanLocalStorage", () => {
        it("should call browser.browsingData.remove", () => {
            const hostnames = [
                "google.com",
                "amazon.de"
            ];
            cleanLocalStorage(hostnames, "firefox-default");
            browserMock.browsingData.remove.assertCalls([[{
                originTypes: { unprotectedWeb: true },
                hostnames
            }, { localStorage: true }]]);
        });
        it("should remove hostnames from domainsToClean", () => {
            settings.set("domainsToClean", {
                "google.com": true,
                "www.google.com": true,
                "amazon.de": true,
                "wikipedia.org": true
            });
            settings.save();
            cleanLocalStorage([
                "google.com",
                "amazon.de"
            ], "firefox-default");
            assert.deepEqual(settings.get("domainsToClean"), { "wikipedia.org": true, "www.google.com": true });
        });
    });
});
