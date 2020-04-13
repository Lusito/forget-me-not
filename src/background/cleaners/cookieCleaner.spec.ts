/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { ReceiverHandle, messageUtil } from "../../lib/messageUtil";
import { browser, BrowsingData } from "webextension-polyfill-ts";
import { booleanContext } from "../../testUtils/testHelpers";
import { quickSetCookie, quickRemoveCookie } from "../../testUtils/quickHelpers";
import { TabWatcher } from "../tabWatcher";
import { IncognitoWatcher } from "../incognitoWatcher";
import { CookieCleaner } from "./cookieCleaner";
import { settings } from "../../lib/settings";
import { CleanupType } from "../../lib/settingsSignature";
import { advanceTime } from "../../testUtils/time";

export{};

const COOKIE_STORE_ID = "mock";
const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const BLACKLISTED_DOMAIN = "instantly.com";
const OPEN_DOMAIN = "open.com";
const OPEN_DOMAIN2 = "open2.com";
const FRAME_DOMAIN = "frame.com";
const FRAME_DOMAIN2 = "frame2.com";
const UNKNOWN_DOMAIN = "unknown.com";
const UNKNOWN_DOMAIN2 = "unknown2.com";
const UNKNOWN_SUBDOMAIN = "sub.unknown.com";
const ALL_COOKIE_DOMAINS = [WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN, BLACKLISTED_DOMAIN, OPEN_DOMAIN, OPEN_DOMAIN2, FRAME_DOMAIN, FRAME_DOMAIN2, UNKNOWN_DOMAIN, UNKNOWN_DOMAIN2];

async function getRemainingCookieDomains() {
    const cookies = await browser.cookies.getAll({
        firstPartyDomain: null,
        storeId: COOKIE_STORE_ID
    });
    return cookies.map((c) => c.domain);
}

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
        expect(cookies).toHaveLength(7);
        const cookies2 = await browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" });
        expect(cookies2).toHaveLength(2);
    });

    it("should reject if cookie does not exist", async () => {
        const spy = jest.fn();
        receivers.push(messageUtil.receive("cookieRemoved", spy));
        let error: string = "Did not reject";
        await quickRemoveCookie("google.de", "fox", "", "firefox-default", "").catch((e) => error = e);
        expect(error).toBe("Was not able to find mocked cookie 'fox'");

        expect(spy).not.toHaveBeenCalled();
    });

    it("should emit cookieRemoved event", async () => {
        const spy = jest.fn();
        receivers.push(messageUtil.receive("cookieRemoved", spy));
        await quickRemoveCookie("google.com", "hello", "", "firefox-default", "");
        await quickRemoveCookie("google.com", "foo", "", "firefox-default", "");
        await quickRemoveCookie("google.de", "hello", "", "firefox-default", "");
        await quickRemoveCookie("google.de", "foo", "", "firefox-default", "");
        await quickRemoveCookie("google.com", "hello", "", "firefox-default-2", "");
        await quickRemoveCookie("google.com", "foo", "", "firefox-default-2", "");
        await quickRemoveCookie("", "foo", "/C:/path/to/somewhere/", "firefox-default", "");
        expect(spy.mock.calls).toEqual([
            ["google.com", {}],
            ["google.com", {}],
            ["google.de", {}],
            ["google.de", {}],
            ["google.com", {}],
            ["google.com", {}],
            ["/C:/path/to/somewhere/", {}]
        ]);
    });
    it("should remove cookies from the specified store", async () => {
        await quickRemoveCookie("google.com", "hello", "", "firefox-default", "");
        await quickRemoveCookie("google.com", "foo", "", "firefox-default", "");
        await quickRemoveCookie("google.com", "foo", "", "firefox-default-2", "");
        const cookies = await browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default" });
        expect(cookies).toHaveLength(5);
        expect(cookies.find((c) => c.name === "hello" && c.domain === "google.com")).toBeUndefined();
        expect(cookies.find((c) => c.name === "foo" && c.domain === "google.com")).toBeUndefined();
        expect((cookies.findIndex((c) => c.name === "oh_long" && c.domain === "google.com"))).not.toBe(-1);

        const cookies2 = await browser.cookies.getAll({ firstPartyDomain: null, storeId: "firefox-default-2" });
        expect(cookies2).toHaveLength(1);
        expect(cookies2.findIndex((c) => c.name === "hello" && c.domain === "google.com")).not.toBe(-1);
        expect(cookies2.find((c) => c.name === "foo" && c.domain === "google.com")).toBeUndefined();
    });

    it("should call browser.cookies.remove with the correct parameters", async () => {
        await quickRemoveCookie("google.com", "hello", "", "firefox-default", "");
        await quickRemoveCookie("google.com", "foo", "", "firefox-default", "");
        await quickRemoveCookie("google.com", "foo", "", "firefox-default-2", "");
        await quickRemoveCookie("google.de", "foo", "", "firefox-default", "", true);
        await quickRemoveCookie("", "foo", "/C:/path/to/somewhere/", "firefox-default", "");

        expect(browserMock.cookies.remove.mock.calls).toEqual([
            [{ name: "hello", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "http://google.com", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "http://google.com", storeId: "firefox-default-2", firstPartyDomain: "" }],
            [{ name: "foo", url: "https://google.de", storeId: "firefox-default", firstPartyDomain: "" }],
            [{ name: "foo", url: "file:///C:/path/to/somewhere/", storeId: "firefox-default", firstPartyDomain: "" }]
        ]);
    });
});

describe("CookieCleaner", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let tabWatcher: TabWatcher | null = null;
    let incognitoWatcher: IncognitoWatcher | null = null;
    let cleaner: CookieCleaner | null = null;

    afterEach(async () => {
        tabWatcher = null;
        incognitoWatcher = null;
        cleaner = null;
        await settings.restoreDefaults();
    });

    beforeEach(async () => {
        tabWatcher = new TabWatcher(tabWatcherListener);
        incognitoWatcher = new IncognitoWatcher();

        const tabIds = [
            browserMock.tabs.create(`http://${OPEN_DOMAIN}`, COOKIE_STORE_ID),
            browserMock.tabs.create(`http://${OPEN_DOMAIN2}`, COOKIE_STORE_ID)
        ];
        tabWatcher.commitNavigation(tabIds[0], 1, FRAME_DOMAIN);
        tabWatcher.commitNavigation(tabIds[1], 1, FRAME_DOMAIN2);
        browserMock.cookies.cookieStores = [
            { id: COOKIE_STORE_ID, tabIds, incognito: false }
        ];
        quickSetCookie(OPEN_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(OPEN_DOMAIN2, "foo", "bar", "", COOKIE_STORE_ID, OPEN_DOMAIN2);
        quickSetCookie(FRAME_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(FRAME_DOMAIN2, "foo", "bar", "", COOKIE_STORE_ID, OPEN_DOMAIN);
        quickSetCookie(UNKNOWN_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(UNKNOWN_DOMAIN2, "foo", "bar", "", COOKIE_STORE_ID, UNKNOWN_DOMAIN2);
        quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(GRAYLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        quickSetCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
        settings.set("rules", [
            { rule: WHITELISTED_DOMAIN, type: CleanupType.NEVER },
            { rule: GRAYLISTED_DOMAIN, type: CleanupType.STARTUP },
            { rule: BLACKLISTED_DOMAIN, type: CleanupType.INSTANTLY }
        ]);
        await settings.save();
        cleaner = new CookieCleaner(tabWatcher, incognitoWatcher);
    });

    describe("clean", () => {
        const typeSet: BrowsingData.DataTypeSet = {
            cookies: true
        };
        beforeEach(() => {
            typeSet.cookies = true;
        });

        booleanContext((cookies, startup, startupApplyRules, cleanAllApplyRules) => {
            beforeEach(async () => {
                typeSet.cookies = cookies;
                settings.set("startup.cookies.applyRules", startupApplyRules);
                settings.set("cleanAll.cookies.applyRules", cleanAllApplyRules);
                await settings.save();
            });
            if (cookies && (startup && startupApplyRules || !startup && cleanAllApplyRules)) {
                it("should clean up", async () => {
                    await cleaner!.clean(typeSet, startup);
                    expect(browserMock.cookies.getAllCookieStores.mock.calls).toEqual([[]]);
                    expect(typeSet.cookies).toBe(false);
                });
            } else {
                it("should not do anything", async () => {
                    await cleaner!.clean(typeSet, startup);
                    expect(browserMock.cookies.getAllCookieStores).not.toHaveBeenCalled();
                    expect(typeSet.cookies).toBe(cookies);
                });
            }
        });

        booleanContext((protectOpenDomains) => {
            beforeEach(async () => {
                settings.set("cleanAll.protectOpenDomains", protectOpenDomains);
                await settings.save();
            });
            it("should protect whitelisted cookies and open domains (+iframes)", async () => {
                await cleaner!.clean(typeSet, true);
                expect(await getRemainingCookieDomains()).toHaveSameMembers([WHITELISTED_DOMAIN, OPEN_DOMAIN, OPEN_DOMAIN2, FRAME_DOMAIN, FRAME_DOMAIN2]);
                expect(typeSet.cookies).toBe(false);
            });
        });
        describe("startup = false, protectOpenDomains = true", () => {
            beforeEach(async () => {
                settings.set("cleanAll.protectOpenDomains", true);
                await settings.save();
            });
            it("should protect whitelisted and graylisted cookies, as well as open domains (+iframes)", async () => {
                await cleaner!.clean(typeSet, false);
                expect(await getRemainingCookieDomains()).toHaveSameMembers([WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN, OPEN_DOMAIN, OPEN_DOMAIN2, FRAME_DOMAIN, FRAME_DOMAIN2]);
                expect(typeSet.cookies).toBe(false);
            });
        });
        describe("startup = false, protectOpenDomains = false", () => {
            beforeEach(async () => {
                settings.set("cleanAll.protectOpenDomains", false);
                await settings.save();
            });
            it("should protect whitelisted and graylisted cookies", async () => {
                await cleaner!.clean(typeSet, false);
                
                expect(await getRemainingCookieDomains()).toHaveSameMembers([WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN]);
                expect(typeSet.cookies).toBe(false);
            });
        });
    });

    describe("cleanDomainOnLeave", () => {
        describe("domainLeave.enabled = false", () => {
            beforeEach(() => {
                expect(settings.get("domainLeave.enabled")).toBe(false);
            });
            it("should not do anything", async () => {
                await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);

                expect(browserMock.cookies.remove).not.toHaveBeenCalled();
                expect(browserMock.cookies.getAll).not.toHaveBeenCalled();
            });
        });
        describe("domainLeave.enabled = true, domainLeave.cookies=false", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", false);
                await settings.save();
            });
            it("should not do anything", async () => {
                await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);

                expect(browserMock.cookies.remove).not.toHaveBeenCalled();
                expect(browserMock.cookies.getAll).not.toHaveBeenCalled();
            });
        });
        describe("domainLeave.enabled = true, domainLeave.cookies=true", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.cookies", true);
                await settings.save();

                // should clean subdomain cookies as well
                quickSetCookie(UNKNOWN_SUBDOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
            });
            it("should clean cookies", async () => {
                await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                expect(await getRemainingCookieDomains()).toHaveSameMembers([OPEN_DOMAIN, OPEN_DOMAIN2, FRAME_DOMAIN, FRAME_DOMAIN2, UNKNOWN_DOMAIN2, WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN, BLACKLISTED_DOMAIN]);
            });
            it("should not clean anything if the domain is protected", async () => {
                await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);
                await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, WHITELISTED_DOMAIN);
                await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, GRAYLISTED_DOMAIN);
                expect(browserMock.cookies.remove).not.toHaveBeenCalled();
            });
        });
    });

    describe("isCookieAllowed", () => {
        async function testCookieAllowed(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean, protectSubFrames: boolean, expected: boolean) {
            const cookies = await browser.cookies.getAll({
                firstPartyDomain: null,
                storeId: COOKIE_STORE_ID
            });
            const cookie = cookies.find((c) => c.domain === domain);
            expect(cookie).toBeDefined();
            expect(cleaner!.isCookieAllowed(cookie!, ignoreStartupType, protectOpenDomains, protectSubFrames)).toBe(expected);
        }
        it("should return true if the matching rule is never", async () => {
            await testCookieAllowed(WHITELISTED_DOMAIN, true, true, false, true);
            await testCookieAllowed(WHITELISTED_DOMAIN, false, true, false, true);
            await testCookieAllowed(WHITELISTED_DOMAIN, false, false, false, true);
            await testCookieAllowed(WHITELISTED_DOMAIN, true, false, false, true);
            await testCookieAllowed(WHITELISTED_DOMAIN, true, true, true, true);
            await testCookieAllowed(WHITELISTED_DOMAIN, false, true, true, true);
            await testCookieAllowed(WHITELISTED_DOMAIN, false, false, true, true);
            await testCookieAllowed(WHITELISTED_DOMAIN, true, false, true, true);
        });
        it("should return true if the matching rule is startup and ignoreStartupType=false", async () => {
            await testCookieAllowed(GRAYLISTED_DOMAIN, false, false, false, true);
            await testCookieAllowed(GRAYLISTED_DOMAIN, false, true, false, true);
            await testCookieAllowed(GRAYLISTED_DOMAIN, false, false, true, true);
            await testCookieAllowed(GRAYLISTED_DOMAIN, false, true, true, true);
        });
        it("should return false if the matching rule is startup and ignoreStartupType=true", async () => {
            await testCookieAllowed(GRAYLISTED_DOMAIN, true, false, false, false);
            await testCookieAllowed(GRAYLISTED_DOMAIN, true, true, false, false);
            await testCookieAllowed(GRAYLISTED_DOMAIN, true, false, true, false);
            await testCookieAllowed(GRAYLISTED_DOMAIN, true, true, true, false);
        });
        it("should return false if the matching rule is instantly", async () => {
            await testCookieAllowed(BLACKLISTED_DOMAIN, true, true, false, false);
            await testCookieAllowed(BLACKLISTED_DOMAIN, false, true, false, false);
            await testCookieAllowed(BLACKLISTED_DOMAIN, false, false, false, false);
            await testCookieAllowed(BLACKLISTED_DOMAIN, true, false, false, false);
            await testCookieAllowed(BLACKLISTED_DOMAIN, true, true, true, false);
            await testCookieAllowed(BLACKLISTED_DOMAIN, false, true, true, false);
            await testCookieAllowed(BLACKLISTED_DOMAIN, false, false, true, false);
            await testCookieAllowed(BLACKLISTED_DOMAIN, true, false, true, false);
        });
        it("should return false if the matching rule is leave", async () => {
            await testCookieAllowed(UNKNOWN_DOMAIN, false, false, false, false);
            await testCookieAllowed(UNKNOWN_DOMAIN, true, false, false, false);
            await testCookieAllowed(UNKNOWN_DOMAIN, false, false, true, false);
            await testCookieAllowed(UNKNOWN_DOMAIN, true, false, true, false);
            await testCookieAllowed(UNKNOWN_DOMAIN, false, true, false, false);
            await testCookieAllowed(UNKNOWN_DOMAIN, true, true, false, false);
            await testCookieAllowed(UNKNOWN_DOMAIN, false, true, true, false);
            await testCookieAllowed(UNKNOWN_DOMAIN, true, true, true, false);
        });
        it("should return true if protectOpenDomains = true and cookie has firstpartydomain, which is on watcher", async () => {
            await testCookieAllowed(OPEN_DOMAIN2, true, true, false, true);
            await testCookieAllowed(OPEN_DOMAIN2, false, true, false, true);
            await testCookieAllowed(OPEN_DOMAIN2, true, true, true, true);
            await testCookieAllowed(OPEN_DOMAIN2, false, true, true, true);
        });
        it("should return false if protectOpenDomains = true and cookie has firstpartydomain, which is not on watcher", async () => {
            await testCookieAllowed(UNKNOWN_DOMAIN2, true, true, false, false);
            await testCookieAllowed(UNKNOWN_DOMAIN2, false, true, false, false);
            await testCookieAllowed(UNKNOWN_DOMAIN2, true, true, true, false);
            await testCookieAllowed(UNKNOWN_DOMAIN2, false, true, true, false);
        });
        it("should return true if protectOpenDomains = true and first party domain of cookie is on watcher", async () => {
            await testCookieAllowed(OPEN_DOMAIN, true, true, false, true);
            await testCookieAllowed(OPEN_DOMAIN, false, true, false, true);
            await testCookieAllowed(OPEN_DOMAIN, true, true, true, true);
            await testCookieAllowed(OPEN_DOMAIN, false, true, true, true);
        });
        it("should return true if protectOpenDomains = true, protectSubFrames = true and first party domain of cookie is on watcher", async () => {
            await testCookieAllowed(FRAME_DOMAIN, true, true, true, true);
            await testCookieAllowed(FRAME_DOMAIN, false, true, true, true);
        });
        it("should return false if protectOpenDomains = false or protectSubFrames = false and first party domain of cookie is on watcher", async () => {
            await testCookieAllowed(FRAME_DOMAIN, true, false, true, false);
            await testCookieAllowed(FRAME_DOMAIN, false, false, true, false);
            await testCookieAllowed(FRAME_DOMAIN, true, true, false, false);
            await testCookieAllowed(FRAME_DOMAIN, false, true, false, false);
        });
    });

    describe("cleanDomain", () => {
        describe("Non-first-party-domain cookies", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", false);
                settings.set("domainLeave.cookies", false);
                await settings.save();
            });
            const NON_FP_COOKIE_DOMAINS = ALL_COOKIE_DOMAINS.filter((value) => value !== FRAME_DOMAIN2 && value !== UNKNOWN_DOMAIN2);
            for (const domain of NON_FP_COOKIE_DOMAINS) {
                it(`should clean ${domain} regardless of rules and settings`, async () => {
                    await cleaner!.cleanDomain(COOKIE_STORE_ID, domain);
                    const remainder = ALL_COOKIE_DOMAINS.slice();
                    remainder.splice(ALL_COOKIE_DOMAINS.indexOf(domain), 1);
                    if (domain === OPEN_DOMAIN)
                        remainder.splice(remainder.indexOf(FRAME_DOMAIN2), 1);
                        
                    expect(await getRemainingCookieDomains()).toHaveSameMembers(remainder);
                });
            }
        });
        describe("First-party-domain cookies", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", false);
                settings.set("domainLeave.cookies", false);
                await settings.save();
                browserMock.cookies.resetCookies();
                quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                quickSetCookie(GRAYLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, BLACKLISTED_DOMAIN);
            });
            it("should not remove cookies which have a first party domain if that first party domain is not the one to be cleaned", async () => {
                await cleaner!.cleanDomain(COOKIE_STORE_ID, WHITELISTED_DOMAIN);

                expect(await getRemainingCookieDomains()).toHaveSameMembers([WHITELISTED_DOMAIN, GRAYLISTED_DOMAIN]);
            });
            it("should remove cookies which have a first party domain if that first party domain is the one to be cleaned", async () => {
                await cleaner!.cleanDomain(COOKIE_STORE_ID, UNKNOWN_DOMAIN);

                expect(await getRemainingCookieDomains()).toHaveSameMembers([GRAYLISTED_DOMAIN]);
            });
        });
    });

    describe("onCookieChanged", () => {
        beforeEach(() => {
            browserMock.cookies.resetCookies();
        });

        booleanContext((incognito, instantlyEnabled, instantlyCookies, snoozing) => {
            beforeEach(async () => {
                browserMock.tabs.create("", COOKIE_STORE_ID, incognito);
                settings.set("instantly.enabled", instantlyEnabled);
                settings.set("instantly.cookies", instantlyCookies);
                await settings.save();
                await cleaner!.setSnoozing(snoozing);
            });
            if (!incognito && instantlyEnabled && instantlyCookies && !snoozing) {
                it("Should remove blacklisted cookies", async () => {
                    quickSetCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    expect(await getRemainingCookieDomains()).toHaveSameMembers([]);
                });
                it("Should not remove whitelisted cookies", async () => {
                    quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    expect(await getRemainingCookieDomains()).toHaveSameMembers([WHITELISTED_DOMAIN]);
                });
            } else {
                it("Should not remove blacklisted cookies", async () => {
                    quickSetCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    expect(await getRemainingCookieDomains()).toHaveSameMembers([BLACKLISTED_DOMAIN]);
                });
                if (!incognito && instantlyEnabled && instantlyCookies && snoozing) {
                    it("Should remove blacklisted cookies when snoozing gets disabled", async () => {
                        quickSetCookie(BLACKLISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                        await cleaner!.setSnoozing(false);
                        expect(await getRemainingCookieDomains()).toHaveSameMembers([]);
                    });
                }
                it("Should not remove whitelisted cookies", async () => {
                    quickSetCookie(WHITELISTED_DOMAIN, "foo", "bar", "", COOKIE_STORE_ID, "");
                    expect(await getRemainingCookieDomains()).toHaveSameMembers([WHITELISTED_DOMAIN]);
                });
            }
        });

        booleanContext((incognito, thirdPartyEnabled, snoozing, delayed, whitelisted) => {
            const delay = delayed ? 0.1 : 0; // in seconds
            const localDomain = whitelisted ? WHITELISTED_DOMAIN : UNKNOWN_DOMAIN;
            beforeEach(async () => {
                browserMock.tabs.create("", COOKIE_STORE_ID, incognito);
                settings.set("cleanThirdPartyCookies.enabled", thirdPartyEnabled);
                settings.set("cleanThirdPartyCookies.delay", delay);
                await settings.save();
                await cleaner!.setSnoozing(snoozing);
            });
            if (!incognito && thirdPartyEnabled && !snoozing && !whitelisted) {
                it(`Should remove cookie${delayed ? " delayed" : ""}`, async () => {
                    quickSetCookie(localDomain, "foo", "bar", "", COOKIE_STORE_ID, "");
                    if (delayed) {
                        advanceTime(99);
                        expect(await getRemainingCookieDomains()).toHaveSameMembers([localDomain]);
                        advanceTime(1);
                    }
                    expect(await getRemainingCookieDomains()).toHaveSameMembers([])
                });
            } else {
                it(`Should not remove cookie${delayed ? " delayed" : ""}`, async () => {
                    quickSetCookie(localDomain, "foo", "bar", "", COOKIE_STORE_ID, "");
                    if (delayed) {
                        advanceTime(99);
                        expect(await getRemainingCookieDomains()).toHaveSameMembers([localDomain]);
                        advanceTime(1);
                    }
                    expect(await getRemainingCookieDomains()).toHaveSameMembers([localDomain])
                });
            }
        });
    });
});
