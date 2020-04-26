/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/leave-me-not
 */

import { WebRequest } from "webextension-polyfill-ts";
import { container } from "tsyringe";

import { CleanupType } from "../shared/types";
import { HeaderFilter } from "./headerFilter";
import { mocks } from "../testUtils/mocks";
import { mockAssimilate, whitelistPropertyAccess } from "../testUtils/deepMockAssimilate";

describe("Header Filter", () => {
    let headerFilter: HeaderFilter | null = null;

    beforeEach(() => {
        mocks.incognitoWatcher.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.domainUtils.mockAllow();
        mocks.cookieUtils.mockAllow();
        mocks.messageUtil.mockAllow();
        mocks.settings.mockAllow();
        mocks.supports.mockAllow();
        mocks.snoozeManager.mockAllow();

        headerFilter = container.resolve(HeaderFilter);
    });

    afterEach(() => {
        headerFilter = null;
    });

    describe("init()", () => {
        describe("with supports.requestFilterIncognito=true", () => {
            it("should update settings, register listeners and set filter.incognito=false", () => {
                const mock = mockAssimilate(
                    headerFilter!,
                    ["updateSettings"],
                    ["init", "supports", "filter", "messageUtil", "snoozeManager"]
                );

                mock.updateSettings.expect();
                mocks.supports.requestFilterIncognito.mock(true);
                mocks.messageUtil.receive.expect("settingsChanged", expect.anything());
                mocks.snoozeManager.listeners.add.expect(expect.anything());
                headerFilter!["init"]();
            });
        });
        describe("with supports.requestFilterIncognito=false", () => {
            it("should update settings, register listeners and leave filter untouched", () => {
                const mock = mockAssimilate(
                    headerFilter!,
                    ["updateSettings"],
                    ["init", "supports", "messageUtil", "snoozeManager"]
                );
                mock.updateSettings.expect();
                mocks.supports.requestFilterIncognito.mock(false);
                mocks.messageUtil.receive.expect("settingsChanged", expect.anything());
                mocks.snoozeManager.listeners.add.expect(expect.anything());
                headerFilter!["init"]();
            });
        });
    });

    describe("onHeadersReceived", () => {
        const inResponseHeaders: WebRequest.HttpHeaders = [];
        describe.each([
            [null, undefined, "uncalled"],
            [null, false, "uncalled"],
            [null, true, "uncalled"],
            [inResponseHeaders, undefined, true],
            [inResponseHeaders, true, true],
        ])(
            "with responseHeaders=%j, incognito=%j, incognitoWatcher.hasTab=%j",
            (responseHeaders, incognito, hasTab) => {
                const details: WebRequest.OnHeadersReceivedDetailsType = {
                    responseHeaders,
                    incognito,
                    url: "http://some-domain.com",
                    tabId: 42,
                } as any;

                it("should not do anything", () => {
                    whitelistPropertyAccess(headerFilter, "incognitoWatcher", "onHeadersReceived");
                    if (hasTab === true) mocks.incognitoWatcher.hasTab.expect(42).andReturn(hasTab);
                    expect(headerFilter!["onHeadersReceived"](details)).toEqual({});
                });
            }
        );
        describe.each([
            [inResponseHeaders, undefined, false],
            [inResponseHeaders, false, "uncalled"],
        ])(
            "with responseHeaders=%j, incognito=%j, incognitoWatcher.hasTab=%j",
            (responseHeaders, incognito, hasTab) => {
                const details: WebRequest.OnHeadersReceivedDetailsType = {
                    responseHeaders,
                    incognito,
                    url: "http://some-domain.com",
                    tabId: 42,
                } as any;
                const filteredResponseHeaders: WebRequest.HttpHeaders = [{ name: "filtered-headers" }];
                const fallbackDomain = "some-fallback.com";

                it("should call filterResponseHeaders()", () => {
                    const mock = mockAssimilate(
                        headerFilter!,
                        ["filterResponseHeaders"],
                        ["incognitoWatcher", "domainUtils", "onHeadersReceived"]
                    );
                    if (hasTab === false) mocks.incognitoWatcher.hasTab.expect(42).andReturn(hasTab);

                    mocks.domainUtils.getValidHostname.expect(details.url).andReturn(fallbackDomain);
                    mock.filterResponseHeaders
                        .expect(responseHeaders, fallbackDomain, 42)
                        .andReturn(filteredResponseHeaders);

                    expect(headerFilter!["onHeadersReceived"](details)).toEqual({
                        responseHeaders: filteredResponseHeaders,
                    });
                });
            }
        );
    });

    describe("isEnabled", () => {
        it("should return false if no listener has been added", () => {
            mockBrowser.webRequest.onHeadersReceived.hasListener
                .expect(headerFilter!["onHeadersReceived"])
                .andReturn(false);
            expect(headerFilter!["isEnabled"]()).toBe(false);
        });
        it("should return true if listener has been added", () => {
            mockBrowser.webRequest.onHeadersReceived.hasListener
                .expect(headerFilter!["onHeadersReceived"])
                .andReturn(true);
            expect(headerFilter!["isEnabled"]()).toBe(true);
        });
    });

    describe("setEnabled", () => {
        describe.each([
            [true, true],
            [false, false],
        ])("with enabled=%j and isEnabled=%j", (enabled, isEnabled) => {
            it("should do nothing", () => {
                const mock = mockAssimilate(headerFilter!, ["isEnabled"], ["setEnabled"]);
                mock.isEnabled.expect().andReturn(isEnabled);
                headerFilter!["setEnabled"](enabled);
            });
        });
        describe("with enabled=true and isEnabled=false", () => {
            it("should add an onHeadersReceived listener", () => {
                const mock = mockAssimilate(
                    headerFilter!,
                    ["isEnabled"],
                    ["setEnabled", "onHeadersReceived", "filter"]
                );
                mockBrowser.webRequest.onHeadersReceived.addListener.expect(
                    headerFilter!["onHeadersReceived"],
                    headerFilter!["filter"],
                    ["responseHeaders", "blocking"]
                );
                mock.isEnabled.expect().andReturn(false);
                headerFilter!["setEnabled"](true);
            });
        });
        describe("with enabled=false and isEnabled=true", () => {
            it("should add an onHeadersReceived listener", () => {
                const mock = mockAssimilate(headerFilter!, ["isEnabled"], ["setEnabled", "onHeadersReceived"]);
                mockBrowser.webRequest.onHeadersReceived.removeListener.expect(headerFilter!["onHeadersReceived"]);
                mock.isEnabled.expect().andReturn(true);
                headerFilter!["setEnabled"](false);
            });
        });
    });

    describe("updateSettings", () => {
        describe("with snoozing=true", () => {
            it("should only call setEnabled(false)", () => {
                const mock = mockAssimilate(headerFilter!, ["setEnabled"], ["updateSettings", "snoozeManager"]);
                mocks.snoozeManager.isSnoozing.expect().andReturn(true);
                mock.setEnabled.expect(false);
                headerFilter!["updateSettings"]();
            });
        });
        describe("with snoozing=false", () => {
            beforeEach(() => {
                mocks.snoozeManager.isSnoozing.expect().andReturn(false);
            });
            it("should call setEnabled(true) if beforeCreation=true", () => {
                const mock = mockAssimilate(
                    headerFilter!,
                    ["setEnabled"],
                    ["updateSettings", "settings", "blockThirdpartyCookies", "snoozeManager"]
                );
                mock.setEnabled.expect(true);
                mocks.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(true);
                headerFilter!["updateSettings"]();
                expect(headerFilter!["blockThirdpartyCookies"]).toBe(true);
            });
            it("should call setEnabled(true) if instantly.enabled=true and hasBlockingRule=true", () => {
                const mock = mockAssimilate(
                    headerFilter!,
                    ["setEnabled"],
                    ["updateSettings", "settings", "blockThirdpartyCookies", "snoozeManager"]
                );
                mock.setEnabled.expect(true);
                mocks.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(false);
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.hasBlockingRule.expect().andReturn(true);
                headerFilter!["updateSettings"]();
                expect(headerFilter!["blockThirdpartyCookies"]).toBe(false);
            });
            it("should call setEnabled(false) if instantly.enabled=true and hasBlockingRule=false", () => {
                const mock = mockAssimilate(
                    headerFilter!,
                    ["setEnabled"],
                    ["updateSettings", "settings", "blockThirdpartyCookies", "snoozeManager"]
                );
                mock.setEnabled.expect(false);
                mocks.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(false);
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.hasBlockingRule.expect().andReturn(false);
                headerFilter!["updateSettings"]();
                expect(headerFilter!["blockThirdpartyCookies"]).toBe(false);
            });
            it("should call setEnabled(false) if instantly.enabled=false", () => {
                const mock = mockAssimilate(
                    headerFilter!,
                    ["setEnabled"],
                    ["updateSettings", "settings", "blockThirdpartyCookies", "snoozeManager"]
                );
                mock.setEnabled.expect(false);
                mocks.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(false);
                mocks.settings.get.expect("instantly.enabled").andReturn(false);
                headerFilter!["updateSettings"]();
                expect(headerFilter!["blockThirdpartyCookies"]).toBe(false);
            });
        });
    });

    describe("shouldCookieBeBlocked", () => {
        it.each([[CleanupType.NEVER], [CleanupType.STARTUP]])(
            "should return false if getCleanupTypeForCookie returns %i",
            (cleanupType) => {
                mocks.settings.getCleanupTypeForCookie.expect("some-domain.com", "cookie-name").andReturn(cleanupType);
                expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(false);
            }
        );
        it("should return true if getCleanupTypeForCookie returns INSTANTLY", () => {
            mocks.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.INSTANTLY);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(true);
        });
        it("should return true if getCleanupTypeForCookie returns LEAVE, blockThirdpartyCookies=true and is third party cookie", () => {
            headerFilter!["blockThirdpartyCookies"] = true;
            mocks.tabWatcher.isThirdPartyCookieOnTab.expect(42, "some-domain.com").andReturn(true);
            mocks.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.LEAVE);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(true);
        });
        it("should return false if getCleanupTypeForCookie returns LEAVE, blockThirdpartyCookies=true and is not third party cookie", () => {
            headerFilter!["blockThirdpartyCookies"] = true;
            mocks.tabWatcher.isThirdPartyCookieOnTab.expect(42, "some-domain.com").andReturn(false);
            mocks.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.LEAVE);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(false);
        });
        it("should return false if getCleanupTypeForCookie returns LEAVE and blockThirdpartyCookies=false", () => {
            headerFilter!["blockThirdpartyCookies"] = false;
            mocks.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.LEAVE);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(false);
        });
    });

    describe("filterResponseHeaders", () => {
        it("should only filter set-cookie headers with a value", () => {
            const headers: WebRequest.HttpHeaders = [
                {
                    name: "something",
                    value: "woot",
                },
                {
                    name: "something-else",
                    value: "",
                },
                {
                    name: "set-cookie",
                    value: "",
                },
                {
                    name: "set-cookie",
                    value: "free=b",
                },
                {
                    name: "set-cookie",
                    value: "a=b",
                },
                {
                    name: "set-cookie",
                    value: "a=b\nfree=b\na=b",
                },
            ];
            const remainingHeaders = [
                headers[0],
                headers[1],
                headers[2],
                headers[3],
                {
                    name: "set-cookie",
                    value: "free=b",
                },
            ];

            mocks.messageUtil.sendSelf.expect("cookieRemoved", "c.com").times(3);

            const mock = mockAssimilate(
                headerFilter!,
                ["shouldCookieBeBlocked"],
                ["filterResponseHeaders", "cookieUtils", "messageUtil", "domainUtils"]
            );
            mocks.domainUtils.removeLeadingDot.expect(".c.com").andReturn("c.com").times(5);
            mock.shouldCookieBeBlocked.expect(42, "c.com", "free").andReturn(false);
            mock.shouldCookieBeBlocked.expect(42, "c.com", "a").andReturn(true);
            mock.shouldCookieBeBlocked.expect(42, "c.com", "a").andReturn(true);
            mock.shouldCookieBeBlocked.expect(42, "c.com", "free").andReturn(false);
            mock.shouldCookieBeBlocked.expect(42, "c.com", "a").andReturn(true);
            mocks.cookieUtils.parseSetCookieHeader
                .expect("free=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "free", value: "" });
            mocks.cookieUtils.parseSetCookieHeader
                .expect("a=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "a", value: "" });
            mocks.cookieUtils.parseSetCookieHeader
                .expect("a=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "a", value: "" });
            mocks.cookieUtils.parseSetCookieHeader
                .expect("free=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "free", value: "" });
            mocks.cookieUtils.parseSetCookieHeader
                .expect("a=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "a", value: "" });
            expect(headerFilter!["filterResponseHeaders"](headers, "fallback-domain.com", 42)).toEqual(
                remainingHeaders
            );
        });
    });
});
