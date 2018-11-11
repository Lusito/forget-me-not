/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { settings } from "../../src/lib/settings";
import { ensureNotNull } from "../testHelpers";
import { browserMock } from "../browserMock";
import { TabWatcher } from "../../src/background/tabWatcher";
import { RecentlyAccessedDomains } from "../../src/background/recentlyAccessedDomains";
import { LocalStorageCleaner } from "../../src/background/cleaners/localStorageCleaner";
import { destroyAndNull } from "../../src/shared";
import { CleanupType } from "../../src/lib/settingsSignature";

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
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let cleaner: LocalStorageCleaner | null = null;

    afterEach(() => {
        recentlyAccessedDomains = destroyAndNull(recentlyAccessedDomains);
        tabWatcher = destroyAndNull(tabWatcher);
        cleaner = null;
        settings.restoreDefaults();
    });

    beforeEach(() => {
        browserMock.reset();
        recentlyAccessedDomains = new RecentlyAccessedDomains();
        tabWatcher = new TabWatcher(tabWatcherListener, recentlyAccessedDomains);
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
        settings.save();
    });

    describe("cleanDomainOnLeave", () => {
        [[true, false], [false, false], [false, true]].forEach(([domainLeaveEnabled, localStorageEnabled]) => {
            context(`domainLeave.enabled = ${domainLeaveEnabled}, domainLeave.localStorage=${localStorageEnabled}`, () => {
                beforeEach(() => {
                    settings.set("domainLeave.enabled", domainLeaveEnabled);
                    settings.set("domainLeave.localStorage", localStorageEnabled);
                    settings.save();
                });
                it("should not do anything", () => {
                    cleaner = ensureNotNull(cleaner);

                    cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);
                    browserMock.browsingData.remove.assertNoCall();

                    cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);
                    browserMock.browsingData.remove.assertNoCall();
                });
            });
        });
        context("domainLeave.enabled = true, domainLeave.localStorage=true", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.localStorage", true);
                settings.save();
            });
            it("should clean localstorage", () => {
                cleaner = ensureNotNull(cleaner);
                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, UNKNOWN_DOMAIN);

                browserMock.browsingData.remove.assertCalls([[{
                    originTypes: { unprotectedWeb: true },
                    hostnames: [UNKNOWN_DOMAIN]
                }, { localStorage: true }]]);
            });
            it("should not clean localstorage if the domain is protected", () => {
                cleaner = ensureNotNull(cleaner);

                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, OPEN_DOMAIN);
                browserMock.browsingData.remove.assertNoCall();

                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, WHITELISTED_DOMAIN);
                browserMock.browsingData.remove.assertNoCall();

                cleaner.cleanDomainOnLeave(COOKIE_STORE_ID, GRAYLISTED_DOMAIN);
                browserMock.browsingData.remove.assertNoCall();
            });
        });
    });

    describe("isLocalStorageProtected", () => {
        it("should return true for an open domain and for protected domains, false otherwise", () => {
            cleaner = ensureNotNull(cleaner);
            assert.isTrue(cleaner.isLocalStorageProtected(COOKIE_STORE_ID, OPEN_DOMAIN));
            assert.isTrue(cleaner.isLocalStorageProtected(COOKIE_STORE_ID, GRAYLISTED_DOMAIN));
            assert.isTrue(cleaner.isLocalStorageProtected(COOKIE_STORE_ID, WHITELISTED_DOMAIN));
            assert.isFalse(cleaner.isLocalStorageProtected(COOKIE_STORE_ID, UNKNOWN_DOMAIN));
        });
    });

    describe("cleanDomain", () => {
        beforeEach(() => {
            settings.set("domainLeave.enabled", false);
            settings.set("domainLeave.localStorage", false);
            settings.save();
        });
        it("should clean regardless of rules and settings", () => {
            cleaner = ensureNotNull(cleaner);
            cleaner.cleanDomain(COOKIE_STORE_ID, WHITELISTED_DOMAIN);
            browserMock.browsingData.remove.assertCalls([[{
                originTypes: { unprotectedWeb: true },
                hostnames: [WHITELISTED_DOMAIN]
            }, { localStorage: true }]]);
        });
    });
});
