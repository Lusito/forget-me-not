/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, Cookies } from "webextension-polyfill-ts";

import { booleanVariations } from "../../testUtils/testHelpers";
import { CookieCleaner } from "./cookieCleaner";
import { testContext, mockContext } from "../../testUtils/mockContext";
import { mockEvent } from "../../testUtils/mockBrowser";
import { quickCookie } from "../../testUtils/quickHelpers";
import { CleanupType } from "../../lib/shared";
import { mockAssimilate, whitelistPropertyAccess } from "../../testUtils/deepMockAssimilate";

const COOKIE_STORE_ID = "mock";

describe("CookieCleaner", () => {
    let cookieCleaner: CookieCleaner | null = null;

    afterEach(() => {
        cookieCleaner = null;
    });

    beforeEach(() => {
        mockEvent(mockBrowser.cookies.onChanged);
        mockContext.incognitoWatcher.mockAllow();
        mockContext.tabWatcher.mockAllow();
        mockContext.settings.mockAllow();
        cookieCleaner = new CookieCleaner(testContext);
    });

    describe("clean", () => {
        const typeSet: BrowsingData.DataTypeSet = {
            cookies: true,
        };
        beforeEach(() => {
            typeSet.cookies = true;
        });

        it.each(booleanVariations(1))(
            "should not do anything if cookies flag is false and startup=%j",
            async (startup) => {
                typeSet.cookies = false;
                const cleanCookiesWithRulesNow = jest.fn();
                cookieCleaner!["cleanCookiesWithRulesNow"] = cleanCookiesWithRulesNow;
                await cookieCleaner!.clean(typeSet, startup);
                expect(typeSet.cookies).toBe(false);
                expect(cleanCookiesWithRulesNow).not.toHaveBeenCalled();
            }
        );
        it.each(booleanVariations(1))(
            "should not do anything if cookies flag is true and startup=%j with respective setting of false",
            async (startup) => {
                const cleanCookiesWithRulesNow = jest.fn();
                cookieCleaner!["cleanCookiesWithRulesNow"] = cleanCookiesWithRulesNow;
                mockContext.settings.get
                    .expect(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules")
                    .andReturn(false);
                await cookieCleaner!.clean(typeSet, startup);
                expect(typeSet.cookies).toBe(true);
                expect(cleanCookiesWithRulesNow).not.toHaveBeenCalled();
            }
        );
        it.each(booleanVariations(2))(
            "should call cleanCookiesWithRulesNow if cookies flag is true and startup=%j with respective setting of true",
            async (startup, protectOpenDomains) => {
                const cleanCookiesWithRulesNow = jest.fn();
                cookieCleaner!["cleanCookiesWithRulesNow"] = cleanCookiesWithRulesNow;
                mockContext.settings.get
                    .expect(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules")
                    .andReturn(true);
                if (!startup)
                    mockContext.settings.get.expect("cleanAll.protectOpenDomains").andReturn(protectOpenDomains);
                await cookieCleaner!.clean(typeSet, startup);
                expect(typeSet.cookies).toBe(false);
                expect(cleanCookiesWithRulesNow.mock.calls).toEqual([[startup, startup || protectOpenDomains]]);
            }
        );
    });

    describe("cleanDomainOnLeave", () => {
        it("should not do anything if domainLeave.enabled = false", async () => {
            const cleanDomainInternal = jest.fn();
            cookieCleaner!["cleanDomainInternal"] = cleanDomainInternal;
            mockContext.settings.get.expect("domainLeave.enabled").andReturn(false); // domainLeave.cookies
            await cookieCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain.com");

            expect(cleanDomainInternal).not.toHaveBeenCalled();
        });
        it("should not do anything if domainLeave.enabled = true, but domainLeave.cookies = false", async () => {
            const cleanDomainInternal = jest.fn();
            cookieCleaner!["cleanDomainInternal"] = cleanDomainInternal;
            mockContext.settings.get.expect("domainLeave.enabled").andReturn(true);
            mockContext.settings.get.expect("domainLeave.cookies").andReturn(false);
            await cookieCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain.com");

            expect(cleanDomainInternal).not.toHaveBeenCalled();
        });
        it("should call cleanDomainInternal if domainLeave.enabled = true, but domainLeave.cookies = true", async () => {
            const cleanDomainInternal = jest.fn(() => Promise.resolve());
            cookieCleaner!["cleanDomainInternal"] = cleanDomainInternal;
            mockContext.settings.get.expect("domainLeave.enabled").andReturn(true);
            mockContext.settings.get.expect("domainLeave.cookies").andReturn(true);
            await cookieCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain.com");

            expect(cleanDomainInternal.mock.calls).toEqual([[COOKIE_STORE_ID, "some-domain.com", false]]);
        });
    });

    describe("cleanDomainInternal", () => {
        function prepareCleanDomainInternal(ignoreRules: boolean) {
            const removeCookies = jest.fn();
            cookieCleaner!["removeCookies"] = removeCookies;
            cookieCleaner!["cleanDomainInternal"](COOKIE_STORE_ID, "www.some-domain.com", ignoreRules);
            expect(removeCookies.mock.calls).toEqual([[COOKIE_STORE_ID, expect.anything()]]);
            return removeCookies.mock.calls[0][1] as Parameters<CookieCleaner["removeCookies"]>[1];
        }
        function prepareShouldPurgeExpiredCookie(shouldPurge: boolean) {
            const spy = jest.fn(() => shouldPurge);
            cookieCleaner!["shouldPurgeExpiredCookie"] = spy;
            return spy;
        }
        describe("callback with shouldPurgeExpiredCookie=true", () => {
            it.each(booleanVariations(1))("should return true with ignoreRules=%j", (ignoreRules) => {
                const callback = prepareCleanDomainInternal(ignoreRules);
                const cookie = quickCookie("some-domain.com", "hello", "", COOKIE_STORE_ID, "");
                const shouldPurgeExpiredCookie = prepareShouldPurgeExpiredCookie(true);
                expect(callback(cookie)).toBe(true);
                expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
            });
        });
        describe("callback with shouldPurgeExpiredCookie=false", () => {
            describe.each([
                [true, false, true],
                [false, true, false],
                [false, false, true],
            ])("with ignoreRules=%j and isCookieAllowed=%j", (ignoreRules, isCookieAllowed, result) => {
                function prepareIsCookieAllowed() {
                    const spy = jest.fn(() => isCookieAllowed);
                    cookieCleaner!["isCookieAllowed"] = spy;
                    return spy;
                }
                function validateIsCookieAllowedSpy(spy: jest.Mock<boolean, []>, cookie: Cookies.Cookie) {
                    if (ignoreRules) expect(spy).not.toHaveBeenCalled();
                    else expect(spy.mock.calls).toEqual([[cookie, false, true, true]]);
                }
                it(`should return ${result} with a matching firstPartyDomain`, () => {
                    const callback = prepareCleanDomainInternal(ignoreRules);
                    const cookie = quickCookie("some-domain.com", "hello", "", COOKIE_STORE_ID, "some-domain.com");
                    const shouldPurgeExpiredCookie = prepareShouldPurgeExpiredCookie(false);
                    const isCookieAllowedSpy = prepareIsCookieAllowed();
                    expect(callback(cookie)).toBe(result);
                    expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
                    validateIsCookieAllowedSpy(isCookieAllowedSpy, cookie);
                });
                it("should return false with no matching firstPartyDomain", () => {
                    const callback = prepareCleanDomainInternal(ignoreRules);
                    const cookie = quickCookie(
                        "some-domain.com",
                        "hello",
                        "",
                        COOKIE_STORE_ID,
                        "some-other-domain.com"
                    );
                    const shouldPurgeExpiredCookie = prepareShouldPurgeExpiredCookie(false);
                    const isCookieAllowedSpy = prepareIsCookieAllowed();
                    expect(callback(cookie)).toBe(false);
                    expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
                    expect(isCookieAllowedSpy).not.toHaveBeenCalled();
                });
                it(`should return ${result} with a matching domain->firstPartyDomain`, () => {
                    const callback = prepareCleanDomainInternal(ignoreRules);
                    const cookie = quickCookie("xxx.some-domain.com", "hello", "", COOKIE_STORE_ID, "");
                    mockContext.domainUtils.getFirstPartyCookieDomain
                        .expect("xxx.some-domain.com")
                        .andReturn("some-domain.com");
                    const shouldPurgeExpiredCookie = prepareShouldPurgeExpiredCookie(false);
                    const isCookieAllowedSpy = prepareIsCookieAllowed();
                    expect(callback(cookie)).toBe(result);
                    expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
                    validateIsCookieAllowedSpy(isCookieAllowedSpy, cookie);
                });
                it("should return false with no matching domain->firstPartyDomain", () => {
                    const callback = prepareCleanDomainInternal(ignoreRules);
                    const cookie = quickCookie("xxx.some-other-domain.com", "hello", "", COOKIE_STORE_ID, "");
                    mockContext.domainUtils.getFirstPartyCookieDomain
                        .expect("xxx.some-other-domain.com")
                        .andReturn("some-other-domain.com");
                    const shouldPurgeExpiredCookie = prepareShouldPurgeExpiredCookie(false);
                    const isCookieAllowedSpy = prepareIsCookieAllowed();
                    expect(callback(cookie)).toBe(false);
                    expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
                    expect(isCookieAllowedSpy).not.toHaveBeenCalled();
                });
            });
        });
    });

    describe("setSnoozing", () => {
        describe("with snoozing=true", () => {
            it("does nothing", async () => {
                whitelistPropertyAccess(cookieCleaner!, "setSnoozing", "snoozing");
                await cookieCleaner!.setSnoozing(true);
                expect(cookieCleaner!["snoozing"]).toBe(true);
            });
        });
        describe("with snoozing=false", () => {
            const cookie1 = quickCookie("some-domain.com", "name1", "", COOKIE_STORE_ID, "");
            const cookie2 = quickCookie("some-domain.com", "name2", "", COOKIE_STORE_ID, "");
            const cookie3 = quickCookie("some-domain.com", "name3", "", COOKIE_STORE_ID, "");
            const cookie4 = quickCookie("some-domain.com", "name4", "/unwanted", COOKIE_STORE_ID, "");
            describe.each(booleanVariations(2))(
                "with cleanThirdPartyCookies.enabled=%j and cleanThirdPartyCookies.beforeCreation=%j",
                (enabled, beforeCreation) => {
                    const parts = [];
                    enabled && parts.push("snoozed thirdparty cookies");
                    beforeCreation && parts.push("snoozed instantly cookies");
                    parts.length === 0 && parts.push("nothing, but still empties the arrays");
                    it(`removes ${parts.join(" and ")}`, async () => {
                        cookieCleaner!["snoozedThirdpartyCookies"].push(cookie1, cookie2);
                        cookieCleaner!["snoozedInstantlyCookies"].push(cookie3, cookie4);
                        const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                            cookieCleaner!,
                            {
                                removeCookieIfThirdparty: cookieCleaner!["removeCookieIfThirdparty"],
                                isUnwantedThirdPartyCookie: cookieCleaner!["isUnwantedThirdPartyCookie"],
                            },
                            [
                                "context",
                                "snoozing",
                                "setSnoozing",
                                "snoozedThirdpartyCookies",
                                "snoozedInstantlyCookies",
                            ]
                        );

                        mockContext.settings.get.expect("cleanThirdPartyCookies.enabled").andReturn(enabled);
                        if (enabled) {
                            mockCookieCleaner.removeCookieIfThirdparty.expect(cookie1).andResolve();
                            mockCookieCleaner.removeCookieIfThirdparty.expect(cookie2).andResolve();
                        }
                        mockContext.settings.get
                            .expect("cleanThirdPartyCookies.beforeCreation")
                            .andReturn(beforeCreation);
                        if (beforeCreation) {
                            mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie3).andReturn(false);
                            mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie4).andReturn(true);
                            mockContext.cookieUtils.removeCookie.expect(cookie4).andResolve({} as any);
                        }

                        await cookieCleaner!.setSnoozing(false);

                        expect(cookieCleaner!["snoozedThirdpartyCookies"]).toHaveLength(0);
                        expect(cookieCleaner!["snoozedInstantlyCookies"]).toHaveLength(0);
                        expect(cookieCleaner!["snoozing"]).toBe(false);
                        mockCookieCleanerNode.verifyAndDisable();
                    });
                }
            );
        });
    });

    describe("cleanCookiesWithRulesNow", () => {
        const cookie = quickCookie("some-domain.com", "name1", "", COOKIE_STORE_ID, "");

        it.each(booleanVariations(2))(
            "should remove unwanted cookies with ignoreStartupType=%j, protectOpenDomains=%j",
            async (ignoreStartupType, protectOpenDomains) => {
                mockContext.storeUtils.getAllCookieStoreIds
                    .expect()
                    .andResolve([COOKIE_STORE_ID, "another-mock-store"]);
                const removeCookies = jest.fn();
                cookieCleaner!["removeCookies"] = removeCookies;
                const shouldPurgeExpiredCookie = jest.fn();
                cookieCleaner!["shouldPurgeExpiredCookie"] = shouldPurgeExpiredCookie;
                const isCookieAllowed = jest.fn();
                cookieCleaner!["isCookieAllowed"] = isCookieAllowed;

                await cookieCleaner!["cleanCookiesWithRulesNow"](ignoreStartupType, protectOpenDomains);

                expect(removeCookies.mock.calls).toEqual([
                    [COOKIE_STORE_ID, expect.anything()],
                    ["another-mock-store", expect.anything()],
                ]);
                const callback = removeCookies.mock.calls[0][1] as (cookie: Cookies.Cookie) => boolean;

                shouldPurgeExpiredCookie.mockReturnValueOnce(false);
                isCookieAllowed.mockReturnValueOnce(true);
                expect(callback(cookie)).toBe(false);
                expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
                expect(isCookieAllowed.mock.calls).toEqual([[cookie, ignoreStartupType, protectOpenDomains, true]]);
                shouldPurgeExpiredCookie.mockReset();
                isCookieAllowed.mockReset();

                shouldPurgeExpiredCookie.mockReturnValueOnce(true);
                expect(callback(cookie)).toBe(true);
                expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
                expect(isCookieAllowed).not.toHaveBeenCalled();
                shouldPurgeExpiredCookie.mockReset();

                shouldPurgeExpiredCookie.mockReturnValueOnce(false);
                isCookieAllowed.mockReturnValueOnce(false);
                expect(callback(cookie)).toBe(true);
                expect(shouldPurgeExpiredCookie.mock.calls).toEqual([[cookie]]);
                expect(isCookieAllowed.mock.calls).toEqual([[cookie, ignoreStartupType, protectOpenDomains, true]]);
            }
        );
    });

    describe("isUnwantedThirdPartyCookie", () => {
        const cookie = quickCookie("some-domain.com", "name1", "", COOKIE_STORE_ID, "");

        describe.each(booleanVariations(2))("hasStore=%j, isThirdparty=%j", (hasStore, isThirdparty) => {
            const result = !hasStore && isThirdparty;
            it(`should return ${result}`, () => {
                const isThirdpartyCookie = jest.fn();
                cookieCleaner!["isThirdpartyCookie"] = isThirdpartyCookie;
                mockContext.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(hasStore);
                if (!hasStore) isThirdpartyCookie.mockReturnValueOnce(isThirdparty);

                expect(cookieCleaner!["isUnwantedThirdPartyCookie"](cookie)).toBe(result);

                if (!hasStore) expect(isThirdpartyCookie.mock.calls).toEqual([[cookie]]);
                else expect(isThirdpartyCookie).not.toHaveBeenCalled();
            });
        });
    });

    describe("shouldRemoveCookieInstantly", () => {
        const cookie = quickCookie(".www.some-domain.com", "name1", "", COOKIE_STORE_ID, "");
        describe.each([
            [false, false],
            [true, false],
            [false, true],
        ])("with instantly.enabled=%j and instantly.cookies=%j", (instantlyEnabled, cookiesEnabled) => {
            it("returns false", () => {
                mockContext.settings.get.expect("instantly.enabled").andReturn(instantlyEnabled);
                if (instantlyEnabled) mockContext.settings.get.expect("instantly.cookies").andReturn(cookiesEnabled);
                expect(cookieCleaner!["shouldRemoveCookieInstantly"](cookie)).toBe(false);
            });
        });
        describe("with instantly.enabled=true and instantly.cookies=true", () => {
            it.each([
                [false, CleanupType.LEAVE],
                [false, CleanupType.NEVER],
                [false, CleanupType.STARTUP],
                [true, CleanupType.INSTANTLY],
            ])("returns %j for cleanupType=%i", (result, cleanupType) => {
                mockContext.settings.get.expect("instantly.enabled").andReturn(true);
                mockContext.settings.get.expect("instantly.cookies").andReturn(true);
                mockContext.settings.getCleanupTypeForCookie
                    .expect("www.some-domain.com", "name1")
                    .andReturn(cleanupType);
                expect(cookieCleaner!["shouldRemoveCookieInstantly"](cookie)).toBe(result);
            });
        });
    });

    describe("onCookieChanged", () => {
        const cookie = quickCookie(".www.some-domain.com", "name1", "", COOKIE_STORE_ID, "");
        const changeInfo: Cookies.OnChangedChangeInfoType = {
            removed: false,
            cookie,
            cause: "explicit",
        };
        describe.each([
            [true, true],
            [true, false],
            [false, true],
        ])("with incognito=%j and removed=%j", (incognito, removed) => {
            it("does nothing", async () => {
                changeInfo.removed = removed;
                if (!removed) mockContext.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(incognito);
                await cookieCleaner!["onCookieChanged"](changeInfo);
                // fixme: helper to disallow certain functions on an object
            });
        });
        describe("with incognito=false and removed=false", () => {
            beforeEach(() => {
                changeInfo.removed = false;
                mockContext.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(false);
            });
            it("delegates the call to onCookieAddedSnoozing with snoozing=true", async () => {
                cookieCleaner!["snoozing"] = true;
                const onCookieAddedSnoozing = jest.fn();
                cookieCleaner!["onCookieAddedSnoozing"] = onCookieAddedSnoozing;
                await cookieCleaner!["onCookieChanged"](changeInfo);
                expect(onCookieAddedSnoozing.mock.calls).toEqual([[cookie]]);
            });
            it("delegates the call to onCookieAddedAwake with snoozing=false", async () => {
                cookieCleaner!["snoozing"] = false;
                const onCookieAddedAwake = jest.fn();
                cookieCleaner!["onCookieAddedAwake"] = onCookieAddedAwake;
                await cookieCleaner!["onCookieChanged"](changeInfo);
                expect(onCookieAddedAwake.mock.calls).toEqual([[cookie]]);
            });
        });
    });

    describe("onCookieAddedSnoozing", () => {
        const cookie = quickCookie("www.some-domain.com", "name1", "", COOKIE_STORE_ID, "");
        describe("with isUnwantedThirdPartyCookie=false", () => {
            it("does nothing", async () => {
                const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                    cookieCleaner!,
                    {
                        isUnwantedThirdPartyCookie: cookieCleaner!["isUnwantedThirdPartyCookie"],
                    },
                    ["onCookieAddedSnoozing"]
                );
                mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie).andReturn(false);

                await cookieCleaner!["onCookieAddedSnoozing"](cookie);
                mockCookieCleanerNode.verifyAndDisable();
            });
        });

        describe("with isUnwantedThirdPartyCookie=true", () => {
            it("does nothing with cleanThirdPartyCookies.beforeCreation=false and cleanThirdPartyCookies.enabled=false", async () => {
                const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                    cookieCleaner!,
                    {
                        isUnwantedThirdPartyCookie: cookieCleaner!["isUnwantedThirdPartyCookie"],
                    },
                    ["onCookieAddedSnoozing", "context"]
                );
                mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie).andReturn(true);
                mockContext.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(false);
                mockContext.settings.get.expect("cleanThirdPartyCookies.enabled").andReturn(false);

                await cookieCleaner!["onCookieAddedSnoozing"](cookie);
                mockCookieCleanerNode.verifyAndDisable();
            });
            it("adds the cookie to snoozedInstantlyCookies with cleanThirdPartyCookies.beforeCreation=true", async () => {
                const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                    cookieCleaner!,
                    {
                        isUnwantedThirdPartyCookie: cookieCleaner!["isUnwantedThirdPartyCookie"],
                    },
                    ["onCookieAddedSnoozing", "context", "snoozedInstantlyCookies"]
                );
                mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie).andReturn(true);
                mockContext.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(true);

                await cookieCleaner!["onCookieAddedSnoozing"](cookie);
                expect(cookieCleaner!["snoozedInstantlyCookies"]).toEqual([cookie]);
                mockCookieCleanerNode.verifyAndDisable();
            });
            it("schedules the cookie to be removed with cleanThirdPartyCookies.beforeCreation=false and cleanThirdPartyCookies.enabled=true", async () => {
                const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                    cookieCleaner!,
                    {
                        isUnwantedThirdPartyCookie: cookieCleaner!["isUnwantedThirdPartyCookie"],
                        removeCookieIfThirdparty: cookieCleaner!["removeCookieIfThirdparty"],
                    },
                    ["onCookieAddedSnoozing", "context"]
                );
                mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie).andReturn(true);
                mockCookieCleaner.removeCookieIfThirdparty.expect(cookie).andResolve();

                mockContext.settings.get.expect("cleanThirdPartyCookies.beforeCreation").andReturn(false);
                mockContext.settings.get.expect("cleanThirdPartyCookies.enabled").andReturn(true);

                await cookieCleaner!["onCookieAddedSnoozing"](cookie);
                mockCookieCleanerNode.verifyAndDisable();
            });
        });
    });

    describe("onCookieAddedAwake", () => {
        const cookie = quickCookie("www.some-domain.com", "name1", "", COOKIE_STORE_ID, "");
        it("does nothing with shouldRemoveCookieInstantly=false and cleanThirdPartyCookies.enabled=false", async () => {
            const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                cookieCleaner!,
                {
                    shouldRemoveCookieInstantly: cookieCleaner!["shouldRemoveCookieInstantly"],
                },
                ["onCookieAddedAwake", "context"]
            );
            mockCookieCleaner.shouldRemoveCookieInstantly.expect(cookie).andReturn(false);
            mockContext.settings.get.expect("cleanThirdPartyCookies.enabled").andReturn(false);

            await cookieCleaner!["onCookieAddedAwake"](cookie);
            mockCookieCleanerNode.verifyAndDisable();
        });
        it("removes the cookie with shouldRemoveCookieInstantly=true", async () => {
            const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                cookieCleaner!,
                {
                    shouldRemoveCookieInstantly: cookieCleaner!["shouldRemoveCookieInstantly"],
                },
                ["onCookieAddedAwake", "context"]
            );
            mockCookieCleaner.shouldRemoveCookieInstantly.expect(cookie).andReturn(true);
            mockContext.cookieUtils.removeCookie.expect(cookie).andResolve({} as any);

            await cookieCleaner!["onCookieAddedAwake"](cookie);
            mockCookieCleanerNode.verifyAndDisable();
        });
        it("delegates to removeCookieIfThirdparty with shouldRemoveCookieInstantly=false and cleanThirdPartyCookies.enabled=true", async () => {
            const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                cookieCleaner!,
                {
                    shouldRemoveCookieInstantly: cookieCleaner!["shouldRemoveCookieInstantly"],
                    removeCookieIfThirdparty: cookieCleaner!["removeCookieIfThirdparty"],
                },
                ["onCookieAddedAwake", "context"]
            );
            mockCookieCleaner.shouldRemoveCookieInstantly.expect(cookie).andReturn(false);
            mockCookieCleaner.removeCookieIfThirdparty.expect(cookie).andResolve();

            mockContext.settings.get.expect("cleanThirdPartyCookies.enabled").andReturn(true);

            await cookieCleaner!["onCookieAddedAwake"](cookie);
            mockCookieCleanerNode.verifyAndDisable();
        });
    });

    describe("removeCookieIfThirdparty", () => {
        const cookie = quickCookie("www.some-domain.com", "name1", "", COOKIE_STORE_ID, "");
        it("does nothing with isUnwantedThirdPartyCookie=false", async () => {
            const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                cookieCleaner!,
                {
                    isUnwantedThirdPartyCookie: cookieCleaner!["isUnwantedThirdPartyCookie"],
                },
                ["removeCookieIfThirdparty"]
            );
            mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie).andReturn(false);

            await cookieCleaner!["removeCookieIfThirdparty"](cookie);
            mockCookieCleanerNode.verifyAndDisable();
        });
        it("delegates to scheduleThirdpartyCookieRemove with isUnwantedThirdPartyCookie=true", async () => {
            const [mockCookieCleaner, mockCookieCleanerNode] = mockAssimilate(
                cookieCleaner!,
                {
                    isUnwantedThirdPartyCookie: cookieCleaner!["isUnwantedThirdPartyCookie"],
                    scheduleThirdpartyCookieRemove: cookieCleaner!["scheduleThirdpartyCookieRemove"],
                },
                ["removeCookieIfThirdparty"]
            );
            mockCookieCleaner.isUnwantedThirdPartyCookie.expect(cookie).andReturn(true);
            mockCookieCleaner.scheduleThirdpartyCookieRemove.expect(cookie).andResolve();

            await cookieCleaner!["removeCookieIfThirdparty"](cookie);
            mockCookieCleanerNode.verifyAndDisable();
        });
    });

    // fixme: scheduleThirdpartyCookieRemove, delayedScheduleThirdpartyCookieRemove

    describe("isThirdpartyCookie", () => {
        describe("with firstPartyDomain on cookie", () => {
            const cookie = quickCookie("www.some-domain.com", "name1", "", COOKIE_STORE_ID, "some-domain.com");
            it("returns false if firstPartyDomain matches", () => {
                whitelistPropertyAccess(cookieCleaner!, "context", "isThirdpartyCookie");
                mockContext.domainUtils.getFirstPartyCookieDomain.expect(cookie.domain).andReturn("some-domain.com");

                expect(cookieCleaner!["isThirdpartyCookie"](cookie)).toBe(false);
            });
            it("returns true if firstPartyDomain does not match", () => {
                whitelistPropertyAccess(cookieCleaner!, "context", "isThirdpartyCookie");
                mockContext.domainUtils.getFirstPartyCookieDomain
                    .expect(cookie.domain)
                    .andReturn("some-other-domain.com");

                expect(cookieCleaner!["isThirdpartyCookie"](cookie)).toBe(true);
            });
        });
        describe("without firstPartyDomain on cookie", () => {
            const cookie = quickCookie("www.some-domain.com", "name1", "", COOKIE_STORE_ID, "");
            it("returns true if cookieStoreContainsDomainFP returns false", () => {
                whitelistPropertyAccess(cookieCleaner!, "context", "isThirdpartyCookie");
                mockContext.domainUtils.getFirstPartyCookieDomain.expect(cookie.domain).andReturn("some-domain.com");
                mockContext.tabWatcher.cookieStoreContainsDomainFP
                    .expect(cookie.storeId, "some-domain.com", false)
                    .andReturn(false);

                expect(cookieCleaner!["isThirdpartyCookie"](cookie)).toBe(true);
            });
            it("returns false if cookieStoreContainsDomainFP returns true", () => {
                whitelistPropertyAccess(cookieCleaner!, "context", "isThirdpartyCookie");
                mockContext.domainUtils.getFirstPartyCookieDomain.expect(cookie.domain).andReturn("some-domain.com");
                mockContext.tabWatcher.cookieStoreContainsDomainFP
                    .expect(cookie.storeId, "some-domain.com", false)
                    .andReturn(true);

                expect(cookieCleaner!["isThirdpartyCookie"](cookie)).toBe(false);
            });
        });
    });

    describe("removeCookies", () => {
        const storeId = COOKIE_STORE_ID;
        const cookie1 = quickCookie("www.some-domain.com", "name1", "", COOKIE_STORE_ID, "some-domain.com");
        const cookie2 = quickCookie("www.some-domain.com", "name2", "", COOKIE_STORE_ID, "some-domain.com");
        const cookie3 = quickCookie("www.some-domain.com", "name3", "", COOKIE_STORE_ID, "some-domain.com");
        const cookie4 = quickCookie("www.some-domain.com", "name4", "", COOKIE_STORE_ID, "some-domain.com");
        const allCookies = [cookie1, cookie2, cookie3, cookie4];
        const testCookies = [cookie1, cookie3];
        it.each([
            [false, { storeId }],
            [true, { storeId, firstPartyDomain: null }],
        ])(
            "removes cookies where test returns true firstPartyIsolation=%j",
            async (firstPartyIsolation, expectedDetails) => {
                mockContext.supports.firstPartyIsolation.mock(firstPartyIsolation);
                mockBrowser.cookies.getAll.expect(expectedDetails).andResolve(allCookies);
                testCookies.forEach((cookie) =>
                    mockContext.cookieUtils.removeCookie.expect(cookie).andResolve({} as any)
                );
                await cookieCleaner!["removeCookies"](storeId, (cookie) => testCookies.includes(cookie));
            }
        );
    });

    describe("shouldPurgeExpiredCookie", () => {
        const expired = Date.now() / 1000;
        const notExpired = (Date.now() + 24 * 60 * 60 * 1000) / 1000;
        it.each([
            [false, false, "an expired cookie", expired],
            [true, true, "an expired cookie", expired],
            [false, true, "an unexpired cookie", notExpired],
        ])(
            "should return %j with purgeExpiredCookies=%j and with %s",
            (result, purgeExpiredCookies, _, expirationDate) => {
                const cookie = quickCookie("domain.com", "name", "path", COOKIE_STORE_ID, "");
                cookie.expirationDate = expirationDate;
                mockContext.settings.get.expect("purgeExpiredCookies").andReturn(purgeExpiredCookies);
                expect(cookieCleaner!["shouldPurgeExpiredCookie"](cookie)).toBe(result);
            }
        );
    });

    describe("isCookieAllowed", () => {
        const cookie = quickCookie(".www.some-domain.com", "name1", "", COOKIE_STORE_ID, "some-domain.com");

        describe.each([
            [CleanupType.NEVER, true],
            [CleanupType.INSTANTLY, false],
        ])("with cleanupType=%i", (cleanupType, expectedReturnType) => {
            it.each(booleanVariations(3))(
                `should return ${expectedReturnType} for ignoreStartupType=%j, protectOpenDomains=%j, protectSubFrames=%j`,
                (ignoreStartupType: boolean, protectOpenDomains: boolean, protectSubFrames: boolean) => {
                    mockContext.settings.getCleanupTypeForCookie
                        .expect("www.some-domain.com", cookie.name)
                        .andReturn(cleanupType);
                    whitelistPropertyAccess(cookieCleaner!, "context", "isCookieAllowed");

                    expect(
                        cookieCleaner!["isCookieAllowed"](
                            cookie,
                            ignoreStartupType,
                            protectOpenDomains,
                            protectSubFrames
                        )
                    ).toBe(expectedReturnType);
                }
            );
        });

        describe("with CleanupType.STARTUP and ignoreStartupType=false", () => {
            it.each(booleanVariations(2))(
                "should return true for protectOpenDomains=%j, protectSubFrames=%j",
                (protectOpenDomains: boolean, protectSubFrames: boolean) => {
                    mockContext.settings.getCleanupTypeForCookie
                        .expect("www.some-domain.com", cookie.name)
                        .andReturn(CleanupType.STARTUP);
                    whitelistPropertyAccess(cookieCleaner!, "context", "isCookieAllowed");

                    expect(cookieCleaner!["isCookieAllowed"](cookie, false, protectOpenDomains, protectSubFrames)).toBe(
                        true
                    );
                }
            );
        });

        describe.each([
            [CleanupType.STARTUP, true],
            [CleanupType.LEAVE, true],
            [CleanupType.LEAVE, false],
        ])("with cleanupType=%i and ignoreStartupType=%j", (cleanupType, ignoreStartupType) => {
            describe.each(booleanVariations(1))(
                "with protectOpenDomains=false, protectSubFrames=%j",
                (protectSubFrames: boolean) => {
                    it("should return false", () => {
                        mockContext.settings.getCleanupTypeForCookie
                            .expect("www.some-domain.com", cookie.name)
                            .andReturn(cleanupType);
                        whitelistPropertyAccess(cookieCleaner!, "context", "isCookieAllowed");

                        expect(
                            cookieCleaner!["isCookieAllowed"](cookie, ignoreStartupType, false, protectSubFrames)
                        ).toBe(false);
                    });
                }
            );
            describe.each(booleanVariations(2))(
                "with protectOpenDomains=true, protectSubFrames=%j",
                (protectSubFrames: boolean) => {
                    describe.each([[""], ["some-other-domain.com"]])(
                        "with cookie.firstPartyDomain=%j",
                        (firstPartyDomain) => {
                            const cookie2 = quickCookie(
                                ".www.some-domain.com",
                                "name1",
                                "",
                                COOKIE_STORE_ID,
                                firstPartyDomain
                            );
                            it.each([[true], [false]])(
                                "should return %j if cookieStoreContainsDomainFP does",
                                (expectedReturn) => {
                                    mockContext.settings.getCleanupTypeForCookie
                                        .expect("www.some-domain.com", cookie2.name)
                                        .andReturn(cleanupType);
                                    whitelistPropertyAccess(cookieCleaner!, "context", "isCookieAllowed");
                                    const expectedFirstPartyDomain = firstPartyDomain || "some-domain.com";
                                    mockContext.tabWatcher.cookieStoreContainsDomainFP
                                        .expect(COOKIE_STORE_ID, expectedFirstPartyDomain, protectSubFrames)
                                        .andReturn(expectedReturn);

                                    expect(
                                        cookieCleaner!["isCookieAllowed"](
                                            cookie2,
                                            ignoreStartupType,
                                            true,
                                            protectSubFrames
                                        )
                                    ).toBe(expectedReturn);
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});
