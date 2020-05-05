import { container } from "tsyringe";

import { CookieUtils } from "./cookieUtils";
import { quickCookie } from "../testUtils/quickHelpers";
import { mocks } from "../testUtils/mocks";

const MOCK_STORE_ID = "mock-store";

describe("CookieUtils", () => {
    let utils: CookieUtils;

    beforeEach(() => {
        mocks.messageUtil.mockAllow();
        mocks.domainUtils.mockAllow();
        mocks.supports.mockAllow();
    });

    // fixme: getCookieRemovalInfo

    describe("removeCookie", () => {
        const domain = ".www.some-domain.com";
        const domainNoLeadingDot = "www.some-domain.com";
        describe("with supports.firstPartyIsolation = true", () => {
            beforeEach(() => {
                mocks.supports.firstPartyIsolation.mock(true);
                utils = container.resolve(CookieUtils);
            });
            it("should reject if cookie does not exist", async () => {
                const error = new Error("Cookie did not exist");
                mockBrowser.cookies.remove.expect.andReject(error);
                mocks.domainUtils.removeLeadingDot.expect(domain).andReturn(domainNoLeadingDot);
                await expect(utils.removeCookie(quickCookie(domain, "fox", "", MOCK_STORE_ID, ""))).rejects.toEqual(
                    error
                );
            });

            it("should emit cookieRemoved event", async () => {
                mocks.messageUtil.sendSelf.expect("cookieRemoved", domainNoLeadingDot);
                const result = "result";
                mockBrowser.cookies.remove
                    .expect({
                        name: "fox",
                        url: "http://www.some-domain.com",
                        storeId: MOCK_STORE_ID,
                        firstPartyDomain: "fpd",
                    })
                    .andResolve(result as any);
                mocks.domainUtils.removeLeadingDot.expect(domain).andReturn(domainNoLeadingDot);
                await expect(utils.removeCookie(quickCookie(domain, "fox", "", MOCK_STORE_ID, "fpd"))).resolves.toEqual(
                    result
                );
            });

            it("should build correct https url", async () => {
                mocks.messageUtil.sendSelf.expect("cookieRemoved", domainNoLeadingDot);
                const result = "result";
                mockBrowser.cookies.remove
                    .expect({
                        name: "fox",
                        url: "https://www.some-domain.com/some-path",
                        storeId: MOCK_STORE_ID,
                        firstPartyDomain: "fpd",
                    })
                    .andResolve(result as any);
                mocks.domainUtils.removeLeadingDot.expect(domain).andReturn(domainNoLeadingDot);
                await expect(
                    utils.removeCookie(quickCookie(domain, "fox", "/some-path", MOCK_STORE_ID, "fpd", true))
                ).resolves.toEqual(result);
            });

            it("should build correct file url", async () => {
                mocks.messageUtil.sendSelf.expect("cookieRemoved", "/C:/path/to/somewhere/");
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
            beforeEach(() => {
                mocks.supports.firstPartyIsolation.mock(false);
                utils = container.resolve(CookieUtils);
            });

            it("should not add firstPartyDomain", async () => {
                mocks.messageUtil.sendSelf.expect("cookieRemoved", domainNoLeadingDot);
                const result = "result";
                mockBrowser.cookies.remove
                    .expect({
                        name: "fox",
                        url: "http://www.some-domain.com",
                        storeId: MOCK_STORE_ID,
                    })
                    .andResolve(result as any);
                mocks.domainUtils.removeLeadingDot.expect(domain).andReturn(domainNoLeadingDot);
                await expect(utils.removeCookie(quickCookie(domain, "fox", "", MOCK_STORE_ID, "fpd"))).resolves.toEqual(
                    result
                );
            });
        });
    });
    describe("parseSetCookieHeader", () => {
        beforeEach(() => {
            mocks.supports.firstPartyIsolation.mock(true);
            utils = container.resolve(CookieUtils);
        });
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
