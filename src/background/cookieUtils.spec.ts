/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// import { browser } from "webextension-polyfill-ts";

import { CookieUtils } from "./cookieUtils";
import { ReceiverHandle, messageUtil } from "../lib/messageUtil";
import { quickCookie } from "../testUtils/quickHelpers";
import { mockEvent } from "../testUtils/mockBrowser";

const MOCK_STORE_ID = "mock-store";

describe("Cookie Utils", () => {
    describe("removeCookie", () => {
        const receivers: ReceiverHandle[] = [];

        beforeEach(() => {
            mockEvent(mockBrowser.runtime.onMessage);
        });

        describe("with supports.firstPartyIsolation = true", () => {
            const utils = new CookieUtils({ supports: { firstPartyIsolation: true } } as any);
            it("should reject if cookie does not exist", async () => {
                const spy = jest.fn();
                receivers.push(messageUtil.receive("cookieRemoved", spy));
                const error = new Error("Cookie did not exist");
                mockBrowser.cookies.remove.expect.andReject(error);
                await expect(
                    utils.removeCookie(quickCookie("google.de", "fox", "", MOCK_STORE_ID, ""))
                ).rejects.toEqual(error);

                expect(spy).not.toHaveBeenCalled();
            });

            it("should emit cookieRemoved event", async () => {
                const spy = jest.fn();
                receivers.push(messageUtil.receive("cookieRemoved", spy));

                const result = "result";
                mockBrowser.cookies.remove
                    .expect({
                        name: "fox",
                        url: "http://google.de",
                        storeId: MOCK_STORE_ID,
                        firstPartyDomain: "fpd",
                    })
                    .andResolve(result as any);
                await expect(
                    utils.removeCookie(quickCookie("google.de", "fox", "", MOCK_STORE_ID, "fpd"))
                ).resolves.toEqual(result);
                expect(spy.mock.calls).toEqual([["google.de", {}]]);
            });

            it("should build correct https url", async () => {
                const result = "result";
                mockBrowser.cookies.remove
                    .expect({
                        name: "fox",
                        url: "https://google.de/some-path",
                        storeId: MOCK_STORE_ID,
                        firstPartyDomain: "fpd",
                    })
                    .andResolve(result as any);
                await expect(
                    utils.removeCookie(quickCookie("google.de", "fox", "/some-path", MOCK_STORE_ID, "fpd", true))
                ).resolves.toEqual(result);
            });

            it("should build correct file url", async () => {
                const result = "result";
                mockBrowser.cookies.remove
                    .expect({
                        name: "fox",
                        url: "file:///C:/path/to/somewhere/",
                        storeId: MOCK_STORE_ID,
                        firstPartyDomain: "fpd",
                    })
                    .andResolve(result as any);
                await expect(
                    utils.removeCookie(quickCookie("", "fox", "/C:/path/to/somewhere/", MOCK_STORE_ID, "fpd", true))
                ).resolves.toEqual(result);
            });
        });

        describe("with supports.firstPartyIsolation = false", () => {
            const utils = new CookieUtils({ supports: { firstPartyIsolation: false } } as any);

            it("should not add firstPartyDomain", async () => {
                const result = "result";
                mockBrowser.cookies.remove
                    .expect({
                        name: "fox",
                        url: "http://google.de",
                        storeId: MOCK_STORE_ID,
                    })
                    .andResolve(result as any);
                await expect(
                    utils.removeCookie(quickCookie("google.de", "fox", "", MOCK_STORE_ID, "fpd"))
                ).resolves.toEqual(result);
            });
        });
    });
    describe("parseSetCookieHeader", () => {
        const utils = new CookieUtils({ supports: { firstPartyIsolation: true } } as any);
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
