/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { TabWatcher } from "../tabWatcher";
import { LocalStorageCleaner } from "./localStorageCleaner";
import { settings } from "../../lib/settings";
import { CleanupType } from "../../lib/settingsSignature";
import { booleanContext } from "../../testUtils/testHelpers";

export{};

const COOKIE_STORE_ID = "mock";
const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const BLACKLISTED_DOMAIN = "instantly.com";
const OPEN_DOMAIN = "open.com";
const OPEN_DOMAIN2 = "open2.com";
const UNKNOWN_DOMAIN = "unknown.com";

describe("LocalStorageCleaner", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let tabWatcher: TabWatcher | null = null;
    let cleaner: LocalStorageCleaner | null = null;

    afterEach(async () => {
        tabWatcher = null;
        cleaner = null;
        await settings.restoreDefaults();
    });

    beforeEach(async () => {
        tabWatcher = new TabWatcher(tabWatcherListener);
        cleaner = new LocalStorageCleaner(tabWatcher);

        const tabIds = [
            browserMock.tabs.create(`http://${OPEN_DOMAIN}`, COOKIE_STORE_ID),
            browserMock.tabs.create(`http://${OPEN_DOMAIN2}`, COOKIE_STORE_ID)
        ];
        browserMock.cookies.cookieStores = [
            { id: COOKIE_STORE_ID, tabIds, incognito: false }
        ];
        settings.set("rules", [
            { rule: WHITELISTED_DOMAIN, type: CleanupType.NEVER },
            { rule: GRAYLISTED_DOMAIN, type: CleanupType.STARTUP },
            { rule: BLACKLISTED_DOMAIN, type: CleanupType.INSTANTLY }
        ]);
        await settings.save();
    });

    describe("cleanDomainOnLeave", () => {
        booleanContext((domainLeaveEnabled, localStorageEnabled) => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", domainLeaveEnabled);
                settings.set("domainLeave.localStorage", localStorageEnabled);
                await settings.save();
            });
            if (domainLeaveEnabled && localStorageEnabled) {
                it("should clean localstorage", async () => {
                    await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);

                    expect(browserMock.browsingData.remove.mock.calls).toEqual([[{
                        originTypes: { unprotectedWeb: true },
                        hostnames: [UNKNOWN_DOMAIN]
                    }, { localStorage: true }]]);
                });
                it("should not clean localstorage if the domain is protected", async () => {
                    await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);
                    expect(browserMock.browsingData.remove).not.toHaveBeenCalled();

                    await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, WHITELISTED_DOMAIN);
                    expect(browserMock.browsingData.remove).not.toHaveBeenCalled();

                    await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, GRAYLISTED_DOMAIN);
                    expect(browserMock.browsingData.remove).not.toHaveBeenCalled();
                });
            } else {
                it("should not do anything", async () => {
                    await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);
                    expect(browserMock.browsingData.remove).not.toHaveBeenCalled();

                    await cleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                    expect(browserMock.browsingData.remove).not.toHaveBeenCalled();
                });
            }
        });
    });

    describe("isLocalStorageProtected", () => {
        it("should return true for an open domain and for protected domains, false otherwise", () => {
            expect(cleaner!.isLocalStorageProtected(COOKIE_STORE_ID, OPEN_DOMAIN)).toBe(true);
            expect(cleaner!.isLocalStorageProtected(COOKIE_STORE_ID, GRAYLISTED_DOMAIN)).toBe(true);
            expect(cleaner!.isLocalStorageProtected(COOKIE_STORE_ID, WHITELISTED_DOMAIN)).toBe(true);
            expect(cleaner!.isLocalStorageProtected(COOKIE_STORE_ID, UNKNOWN_DOMAIN)).toBe(false);
        });
    });

    describe("cleanDomain", () => {
        beforeEach(async () => {
            settings.set("domainLeave.enabled", false);
            settings.set("domainLeave.localStorage", false);
            await settings.save();
        });
        it("should clean regardless of rules and settings", async () => {
            await cleaner!.cleanDomain(COOKIE_STORE_ID, WHITELISTED_DOMAIN);
            expect(browserMock.browsingData.remove.mock.calls).toEqual([[{
                originTypes: { unprotectedWeb: true },
                hostnames: [WHITELISTED_DOMAIN]
            }, { localStorage: true }]]);
        });
        it("should remove hostnames from domainsToClean if they don't exist on the TabWatcher", async () => {
            settings.set("domainsToClean", {
                "google.com": true,
                "www.google.com": true,
                "wikipedia.org": true
            });
            await settings.save();
            await cleaner!.cleanDomain("firefox-default", "google.com");
            expect(settings.get("domainsToClean")).toEqual({ "wikipedia.org": true, "www.google.com": true });
        });
        it("should not remove hostnames from domainsToClean if they exist on the TabWatcher", async () => {
            settings.set("domainsToClean", {
                "www.google.com": true,
                [OPEN_DOMAIN]: true,
                "wikipedia.org": true
            });
            await settings.save();
            await cleaner!.cleanDomain("firefox-default", OPEN_DOMAIN);
            expect(settings.get("domainsToClean")).toEqual({ [OPEN_DOMAIN]: true, "wikipedia.org": true, "www.google.com": true });
        });
    });

    describe("cleanDomains", () => {
        it("should call browser.browsingData.remove", async () => {
            const hostnames = [
                "google.com",
                "amazon.de"
            ];
            await cleaner!.cleanDomains("firefox-default", hostnames);
            expect(browserMock.browsingData.remove.mock.calls).toEqual([[{
                originTypes: { unprotectedWeb: true },
                hostnames
            }, { localStorage: true }]]);
        });
    });
});
