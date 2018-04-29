/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { getValidHostname, destroyAllAndEmpty } from "../src/shared";
import { getFirstPartyCookieDomain, parseSetCookieHeader } from "../src/background/backgroundHelpers";
import { browser, Cookies } from "webextension-polyfill-ts";
import { removeCookie, cleanLocalStorage } from "../src/background/backgroundShared";
import { messageUtil, ReceiverHandle } from "../src/lib/messageUtil";
import { createSpy, browserMock, doneHandler } from "./browserMock";
import { settings } from "../src/lib/settings";

describe("Misc functionality", () => {
    const receivers: ReceiverHandle[] = [];
    beforeEach(() => browserMock.reset());
    afterEach(() => {
        destroyAllAndEmpty(receivers);
    });

    describe("getValidHostname", () => {
        it("should return hostnames for valid urls", () => {
            assert.equal(getValidHostname("http://www.google.com"), "www.google.com");
            assert.equal(getValidHostname("https://www.google.com"), "www.google.com");
        });
        it("should return emptystring for invalid urls", () => {
            assert.equal(getValidHostname("hhttp://www.google.com"), "");
            assert.equal(getValidHostname("httpss://www.google.com"), "");
            assert.equal(getValidHostname("file://www.google.com"), "");
            assert.equal(getValidHostname("chrome://www.google.com"), "");
            assert.equal(getValidHostname("about:preferences"), "");
            assert.equal(getValidHostname("Bu][$<|-|!7"), "");
            assert.equal(getValidHostname(null as any), "");
        });
    });

    describe("getFirstPartyCookieDomain", () => {
        it("should return first party domains for valid cookie domains", () => {
            assert.equal(getFirstPartyCookieDomain("www.google.com"), "google.com");
            assert.equal(getFirstPartyCookieDomain(".google.com"), "google.com");
            assert.equal(getFirstPartyCookieDomain("google.com"), "google.com");
            assert.equal(getFirstPartyCookieDomain(".michelgagne.blogspot.de"), "michelgagne.blogspot.de");
            assert.equal(getFirstPartyCookieDomain("michelgagne.blogspot.de"), "michelgagne.blogspot.de");
            assert.equal(getFirstPartyCookieDomain("hello.michelgagne.blogspot.de"), "michelgagne.blogspot.de");
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
            assert.equal(parseSetCookieHeader("hello; domain=www.google.de", fallbackDomain), null);
            assert.equal(parseSetCookieHeader("", fallbackDomain), null);
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
        function simpleCookieRemove(domain: string, name: string, path: string, storeId: string, firstPartyDomain: string) {
            return removeCookie({
                name,
                domain,
                path,
                storeId,
                firstPartyDomain,
                value: "",
                hostOnly: false,
                secure: false,
                httpOnly: false,
                session: false
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

            let doneCount = 0;
            browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
                assert.equal(cookies.length, 5);
            }, done, () => (++doneCount === 2)));
            browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
                assert.equal(cookies.length, 2);
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
            spy.assertCalls([
                ["google.com", {}],
                ["google.com", {}],
                ["google.de", {}],
                ["google.de", {}],
                ["google.com", {}],
                ["google.com", {}]
            ]);
        });
        it("should remove cookies from the specified store", (done) => {
            simpleCookieRemove("google.com", "hello", "", "firefox-default", "");
            simpleCookieRemove("google.com", "foo", "", "firefox-default", "");
            simpleCookieRemove("google.com", "foo", "", "firefox-default-2", "");
            let doneCount = 0;
            browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
                assert.equal(cookies.length, 3);
                assert.isUndefined(cookies.find((c) => c.name === "hello" && c.domain === "google.com"));
                assert.isUndefined(cookies.find((c) => c.name === "foo" && c.domain === "google.com"));
                assert.notEqual(cookies.findIndex((c) => c.name === "oh_long" && c.domain === "google.com"), -1);
            }, done, () => (++doneCount === 2)));
            browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" }).then(doneHandler((cookies: Cookies.Cookie[]) => {
                assert.equal(cookies.length, 1);
                assert.notEqual(cookies.findIndex((c) => c.name === "hello" && c.domain === "google.com"), -1);
                assert.isUndefined(cookies.find((c) => c.name === "foo" && c.domain === "google.com"));
            }, done, () => (++doneCount === 2)));
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
