/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/leave-me-not
 */

import { WebRequest } from "webextension-polyfill-ts";

import { CleanupType } from "../lib/shared";
import { HeaderFilter } from "./headerFilter";
import { testContext, mockContext } from "../testUtils/mockContext";
import { mockEvent, EventMockOf } from "../testUtils/mockBrowser";
import { messageUtil } from "../lib/messageUtil";

describe("Header Filter", () => {
    let headerFilter: HeaderFilter | null = null;
    let onHeadersReceived: EventMockOf<typeof mockBrowser.webRequest.onHeadersReceived>;

    beforeEach(() => {
        onHeadersReceived = mockEvent(mockBrowser.webRequest.onHeadersReceived);
        mockEvent(mockBrowser.runtime.onMessage);
        mockContext.tabWatcher.mockAllow();
    });

    afterEach(() => {
        headerFilter = null;
    });

    function prepareUpdateSettings(
        beforeCreation: boolean,
        instantlyEnabled: boolean | null,
        hasBlockingRule: boolean | null
    ) {
        mockContext.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(beforeCreation);
        if (instantlyEnabled !== null) mockContext.settings.get.expect("instantly.enabled").andReturn(instantlyEnabled);
        if (hasBlockingRule !== null) mockContext.settings.hasBlockingRule.expect().andReturn(hasBlockingRule);
    }

    function createFilter(
        requestFilterIncognito: boolean,
        beforeCreation: boolean,
        instantlyEnabled: boolean | null,
        hasBlockingRule: boolean | null
    ) {
        mockContext.supports.requestFilterIncognito.mock(requestFilterIncognito);
        prepareUpdateSettings(beforeCreation, instantlyEnabled, hasBlockingRule);
        headerFilter = new HeaderFilter(testContext);
    }

    describe("isEnabled", () => {
        it("should return false with default settings", () => {
            createFilter(true, false, false, null);
            expect(headerFilter!.isEnabled()).toBe(false);
        });
        it("should return true if beforeCreation=true", () => {
            createFilter(true, true, null, null);
            expect(headerFilter!.isEnabled()).toBe(true);
        });
        it("should return true if instantly.enabled=true and hasBlockingRule=true", () => {
            createFilter(true, false, true, true);
            expect(headerFilter!.isEnabled()).toBe(true);
        });
        it("should return false if instantly.enabled=true and hasBlockingRule=false", () => {
            createFilter(true, false, true, false);
            expect(headerFilter!.isEnabled()).toBe(false);
        });
        it("should return false if instantly.enabled=false", () => {
            createFilter(true, false, false, null);
            expect(headerFilter!.isEnabled()).toBe(false);
        });
        it("should return true if listener has been added", () => {
            createFilter(true, false, false, null);
            onHeadersReceived.addListener(headerFilter!["onHeadersReceived"]);
            expect(headerFilter!.isEnabled()).toBe(true);
        });
    });

    describe("updateSettings", () => {
        it("should enable if beforeCreation=true", () => {
            createFilter(true, false, false, null);
            prepareUpdateSettings(true, null, null);
            headerFilter!["updateSettings"]();
            expect(headerFilter!.isEnabled()).toBe(true);
        });
        it("should enable if instantly.enabled=true and hasBlockingRule=true", () => {
            createFilter(true, false, false, null);
            prepareUpdateSettings(false, true, true);
            headerFilter!["updateSettings"]();
            expect(headerFilter!.isEnabled()).toBe(true);
        });
        it("should stay disabled if instantly.enabled=true and hasBlockingRule=false", () => {
            createFilter(true, false, false, null);
            prepareUpdateSettings(false, true, false);
            headerFilter!["updateSettings"]();
            expect(headerFilter!.isEnabled()).toBe(false);
        });
        it("should stay disabled if instantly.enabled=false", () => {
            createFilter(true, false, false, null);
            prepareUpdateSettings(false, false, null);
            headerFilter!["updateSettings"]();
            expect(headerFilter!.isEnabled()).toBe(false);
        });
    });

    describe("setSnoozing", () => {
        it("should set snoozing and then call updateSettings", () => {
            createFilter(true, false, false, null);
            expect(headerFilter!["snoozing"]).toBe(false);

            const updateSettings = jest.fn(() => Promise.resolve());
            headerFilter!["updateSettings"] = updateSettings;
            headerFilter!.setSnoozing(true);
            expect(updateSettings.mock.calls).toEqual([[]]);
            expect(headerFilter!["snoozing"]).toBe(true);
            updateSettings.mockClear();

            headerFilter!.setSnoozing(false);
            expect(updateSettings.mock.calls).toEqual([[]]);
            expect(headerFilter!["snoozing"]).toBe(false);
        });
    });

    describe("shouldCookieBeBlocked", () => {
        it.each([[CleanupType.NEVER], [CleanupType.STARTUP]])(
            "should return false if getCleanupTypeForCookie returns %i",
            (cleanupType) => {
                createFilter(true, false, false, null);
                mockContext.settings.getCleanupTypeForCookie
                    .expect("some-domain.com", "cookie-name")
                    .andReturn(cleanupType);
                expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(false);
            }
        );
        it("should return true if getCleanupTypeForCookie returns INSTANTLY", () => {
            createFilter(true, false, false, null);
            mockContext.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.INSTANTLY);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(true);
        });
        it("should return true if getCleanupTypeForCookie returns LEAVE, beforeCreation=true and is third party cookie", () => {
            createFilter(true, true, null, null);
            mockContext.tabWatcher.isThirdPartyCookieOnTab.expect(42, "some-domain.com").andReturn(true);
            mockContext.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.LEAVE);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(true);
        });
        it("should return false if getCleanupTypeForCookie returns LEAVE, beforeCreation=true and is not third party cookie", () => {
            createFilter(true, true, null, null);
            mockContext.tabWatcher.isThirdPartyCookieOnTab.expect(42, "some-domain.com").andReturn(false);
            mockContext.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.LEAVE);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(false);
        });
        it("should return false if getCleanupTypeForCookie returns LEAVE and beforeCreation=false", () => {
            createFilter(true, false, false, null);
            mockContext.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.LEAVE);
            expect(headerFilter!["shouldCookieBeBlocked"](42, "some-domain.com", "cookie-name")).toBe(false);
        });
        it("should strip leading dots from domains", () => {
            createFilter(true, false, false, null);
            mockContext.settings.getCleanupTypeForCookie
                .expect("some-domain.com", "cookie-name")
                .andReturn(CleanupType.NEVER);
            expect(headerFilter!["shouldCookieBeBlocked"](42, ".some-domain.com", "cookie-name")).toBe(false);
        });
    });

    describe("filterResponseHeaders", () => {
        it("should only filter set-cookie headers with a value", () => {
            createFilter(true, false, false, null);
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

            const cookieRemoved = jest.fn();
            messageUtil.receive("cookieRemoved", cookieRemoved);

            const shouldCookieBeBlocked = jest.fn((tabId: number, domain: string, name: string) => name !== "free");
            headerFilter!["shouldCookieBeBlocked"] = shouldCookieBeBlocked;
            mockContext.cookieUtils.parseSetCookieHeader
                .expect("free=b", "fallback-domain.com")
                .andReturn({ domain: "c.com", name: "free", value: "" });
            mockContext.cookieUtils.parseSetCookieHeader
                .expect("a=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "a", value: "" });
            mockContext.cookieUtils.parseSetCookieHeader
                .expect("a=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "a", value: "" });
            mockContext.cookieUtils.parseSetCookieHeader
                .expect("free=b", "fallback-domain.com")
                .andReturn({ domain: "c.com", name: "free", value: "" });
            mockContext.cookieUtils.parseSetCookieHeader
                .expect("a=b", "fallback-domain.com")
                .andReturn({ domain: ".c.com", name: "a", value: "" });
            expect(headerFilter!["filterResponseHeaders"](headers, "fallback-domain.com", 42)).toEqual(
                remainingHeaders
            );
            expect(shouldCookieBeBlocked.mock.calls).toEqual([
                [42, "c.com", "free"],
                [42, "c.com", "a"],
                [42, "c.com", "a"],
                [42, "c.com", "free"],
                [42, "c.com", "a"],
            ]);

            expect(cookieRemoved.mock.calls).toEqual([
                ["c.com", {}],
                ["c.com", {}],
                ["c.com", {}],
            ]);
        });
    });

    // fixme: onHeadersReceived
});
