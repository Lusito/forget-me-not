/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import {
    getFirstPartyCookieDomain,
    parseSetCookieHeader,
    badges,
    getBadgeForCleanupType,
    getAllCookieStoreIds,
    BadgeInfo,
} from "./backgroundHelpers";
import { CleanupType } from "../lib/settingsSignature";
import { contextWithResult } from "../testUtils/testHelpers";

describe("Misc functionality", () => {
    describe("getFirstPartyCookieDomain", () => {
        it("should return first party domains for valid cookie domains", () => {
            expect(getFirstPartyCookieDomain("www.google.com")).toBe("google.com");
            expect(getFirstPartyCookieDomain(".google.com")).toBe("google.com");
            expect(getFirstPartyCookieDomain("google.com")).toBe("google.com");
            expect(getFirstPartyCookieDomain(".michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
            expect(getFirstPartyCookieDomain("michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
            expect(getFirstPartyCookieDomain("hello.michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
        });
    });

    describe("parseSetCookieHeader", () => {
        const fallbackDomain = "fallback.de";
        it("should parse set-cookie headers correctly", () => {
            expect(parseSetCookieHeader("hello=world;domain=www.google.de", fallbackDomain)).toEqual({
                name: "hello",
                value: "world",
                domain: "www.google.de",
            });
            expect(parseSetCookieHeader("foo = bar; domain=www.google.com", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: "www.google.com",
            });
            expect(parseSetCookieHeader("foo=bar; domain=.google.com", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: ".google.com",
            });
            expect(parseSetCookieHeader("foo=bar; shit=.google.com", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: fallbackDomain,
            });
            expect(parseSetCookieHeader("foo=bar", fallbackDomain)).toEqual({
                name: "foo",
                value: "bar",
                domain: fallbackDomain,
            });
            expect(
                parseSetCookieHeader("foo=bar;some-domain=www.google.de;domain=mail.google.com", fallbackDomain)
            ).toEqual({
                name: "foo",
                value: "bar",
                domain: "mail.google.com",
            });
            expect(parseSetCookieHeader("foo=bar;domain=mail.google.com;domain=www.google.de", fallbackDomain)).toEqual(
                {
                    name: "foo",
                    value: "bar",
                    domain: "mail.google.com",
                }
            );
        });
        it("should return null if set-cookie headers is invalid", () => {
            expect(parseSetCookieHeader("hello; domain=www.google.de", fallbackDomain)).toBeNull();
            expect(parseSetCookieHeader("", fallbackDomain)).toBeNull();
        });
    });

    describe("getBadgeForCleanupType", () => {
        contextWithResult<CleanupType, BadgeInfo>(
            "type",
            [
                { context: CleanupType.NEVER, result: badges.never },
                { context: CleanupType.STARTUP, result: badges.startup },
                { context: CleanupType.LEAVE, result: badges.leave },
                { context: CleanupType.INSTANTLY, result: badges.instantly },
                { context: ("unknown" as any) as CleanupType, result: badges.leave },
            ],
            (type, badge) => {
                it("should return the correct badge", () => {
                    expect(getBadgeForCleanupType(type)).toBe(badge);
                });
            }
        );
    });

    describe("getAllCookieStoreIds", () => {
        beforeEach(() => {
            browserMock.cookies.cookieStores = [
                { id: "cs-1", tabIds: [], incognito: false },
                { id: "cs-2", tabIds: [], incognito: false },
                { id: "cs-4", tabIds: [], incognito: false },
            ];
            browserMock.contextualIdentities.contextualIdentities = [
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-1" },
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-2" },
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-4" },
            ];
        });
        it("should return the correct cookie store ids", async () => {
            const ids = await getAllCookieStoreIds();
            expect(ids).toHaveSameMembers(["cs-1", "cs-2", "cs-4", "ci-1", "ci-2", "ci-4"]);
        });
    });
});
