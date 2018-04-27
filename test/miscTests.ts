/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { getValidHostname } from "../src/shared";
import { getFirstPartyCookieDomain, parseSetCookieHeader } from "../src/background/backgroundHelpers";

describe("Misc functionality", () => {
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
});
