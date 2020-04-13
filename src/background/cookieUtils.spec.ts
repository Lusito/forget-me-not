/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser } from "webextension-polyfill-ts";

import { CookieUtils } from "./cookieUtils";
import { ReceiverHandle, messageUtil } from "../lib/messageUtil";
import { quickSetCookie, quickRemoveCookie } from "../testUtils/quickHelpers";

describe("Cookie Utils", () => {
    // fixme: firstPartyIsolation: false?
    const utils = new CookieUtils({ supports: { firstPartyIsolation: true } } as any);

    describe("removeCookie", () => {
        const receivers: ReceiverHandle[] = [];

        beforeEach(async () => {
            quickSetCookie("google.com", "hello", "world", "", "firefox-default", "");
            quickSetCookie("google.com", "foo", "bar", "", "firefox-default", "");
            quickSetCookie("google.com", "oh_long", "johnson", "", "firefox-default", "");
            quickSetCookie("google.de", "hello", "world", "", "firefox-default", "");
            quickSetCookie("google.de", "foo", "bar", "", "firefox-default", "");
            quickSetCookie("google.de", "foo", "bar", "", "firefox-default", "", true);
            quickSetCookie("google.com", "hello", "world", "", "firefox-default-2", "");
            quickSetCookie("google.com", "foo", "bar", "", "firefox-default-2", "");
            quickSetCookie("", "foo", "bar", "/C:/path/to/somewhere/", "firefox-default", "");

            const cookies = await browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" });
            // eslint-disable-next-line jest/no-standalone-expect
            expect(cookies).toHaveLength(7);
            const cookies2 = await browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" });
            // eslint-disable-next-line jest/no-standalone-expect
            expect(cookies2).toHaveLength(2);
        });

        it("should reject if cookie does not exist", async () => {
            const spy = jest.fn();
            receivers.push(messageUtil.receive("cookieRemoved", spy));
            let error = "Did not reject";
            await utils.removeCookie(quickRemoveCookie("google.de", "fox", "", "firefox-default", "")).catch((e) => {
                error = e;
            });
            expect(error).toBe("Was not able to find mocked cookie 'fox'");

            expect(spy).not.toHaveBeenCalled();
        });

        it("should emit cookieRemoved event", async () => {
            const spy = jest.fn();
            receivers.push(messageUtil.receive("cookieRemoved", spy));
            await utils.removeCookie(quickRemoveCookie("google.com", "hello", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.com", "foo", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.de", "hello", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.de", "foo", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.com", "hello", "", "firefox-default-2", ""));
            await utils.removeCookie(quickRemoveCookie("google.com", "foo", "", "firefox-default-2", ""));
            await utils.removeCookie(quickRemoveCookie("", "foo", "/C:/path/to/somewhere/", "firefox-default", ""));
            expect(spy.mock.calls).toEqual([
                ["google.com", {}],
                ["google.com", {}],
                ["google.de", {}],
                ["google.de", {}],
                ["google.com", {}],
                ["google.com", {}],
                ["/C:/path/to/somewhere/", {}],
            ]);
        });
        it("should remove cookies from the specified store", async () => {
            await utils.removeCookie(quickRemoveCookie("google.com", "hello", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.com", "foo", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.com", "foo", "", "firefox-default-2", ""));
            const cookies = await browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" });
            expect(cookies).toHaveLength(5);
            expect(cookies.find((c) => c.name === "hello" && c.domain === "google.com")).toBeUndefined();
            expect(cookies.find((c) => c.name === "foo" && c.domain === "google.com")).toBeUndefined();
            expect(cookies.findIndex((c) => c.name === "oh_long" && c.domain === "google.com")).not.toBe(-1);

            const cookies2 = await browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" });
            expect(cookies2).toHaveLength(1);
            expect(cookies2.findIndex((c) => c.name === "hello" && c.domain === "google.com")).not.toBe(-1);
            expect(cookies2.find((c) => c.name === "foo" && c.domain === "google.com")).toBeUndefined();
        });

        it("should call browser.cookies.remove with the correct parameters", async () => {
            await utils.removeCookie(quickRemoveCookie("google.com", "hello", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.com", "foo", "", "firefox-default", ""));
            await utils.removeCookie(quickRemoveCookie("google.com", "foo", "", "firefox-default-2", ""));
            await utils.removeCookie(quickRemoveCookie("google.de", "foo", "", "firefox-default", "", true));
            await utils.removeCookie(quickRemoveCookie("", "foo", "/C:/path/to/somewhere/", "firefox-default", ""));

            expect(browserMock.cookies.remove.mock.calls).toEqual([
                [{ name: "hello", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
                [{ name: "foo", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
                [{ name: "foo", url: "http://google.com", storeId: "firefox-default-2", firstPartyDomain: "" }],
                [{ name: "foo", url: "https://google.de", storeId: "firefox-default", firstPartyDomain: "" }],
                [
                    {
                        name: "foo",
                        url: "file:///C:/path/to/somewhere/",
                        storeId: "firefox-default",
                        firstPartyDomain: "",
                    },
                ],
            ]);
        });
    });

    describe("parseSetCookieHeader", () => {
        const fallbackDomain = "fallback.de";
        it("should parse set-cookie headers correctly", () => {
            expect(utils.parseSetCookieHeader("hello=world;domain=www.google.de", fallbackDomain)).toEqual({
                name: "hello",
                value: "world",
                domain: "www.google.de",
            });
            expect(utils.parseSetCookieHeader("foo = bar; domain=www.google.com", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: "www.google.com",
            });
            expect(utils.parseSetCookieHeader("foo=bar; domain=.google.com", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: ".google.com",
            });
            expect(utils.parseSetCookieHeader("foo=bar; shit=.google.com", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: fallbackDomain,
            });
            expect(utils.parseSetCookieHeader("foo=bar", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: fallbackDomain,
            });
            expect(
                utils.parseSetCookieHeader("foo=bar;some-domain=www.google.de;domain=mail.google.com", fallbackDomain)
            ).toEqual({
                name: "foo",
                value: "bar",
                domain: "mail.google.com",
            });
            expect(
                utils.parseSetCookieHeader("foo=bar;domain=mail.google.com;domain=www.google.de", fallbackDomain)
            ).toEqual({
                name: "foo",
                value: "bar",
                domain: "mail.google.com",
            });
        });
        it("should return null if set-cookie headers is invalid", () => {
            expect(utils.parseSetCookieHeader("hello; domain=www.google.de", fallbackDomain)).toBeNull();
            expect(utils.parseSetCookieHeader("", fallbackDomain)).toBeNull();
        });
    });
});
