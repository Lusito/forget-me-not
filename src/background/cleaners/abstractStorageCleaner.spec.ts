import { container, singleton } from "tsyringe";
import { mockAssimilate } from "mockzilla";

import { mocks } from "../../testUtils/mocks";
import { CleanupType } from "../../shared/types";
import { AbstractStorageCleaner } from "./abstractStorageCleaner";
import { Settings } from "../../shared/settings";
import { RuleManager } from "../../shared/ruleManager";
import { StoreUtils } from "../../shared/storeUtils";
import { TabWatcher } from "../tabWatcher";
import { IncognitoWatcher } from "../incognitoWatcher";
import { SettingsKey } from "../../shared/defaultSettings";

const COOKIE_STORE_ID = "mock";

@singleton()
class StorageCleanerImpl extends AbstractStorageCleaner {
    constructor(
        settings: Settings,
        ruleManager: RuleManager,
        storeUtils: StoreUtils,
        tabWatcher: TabWatcher,
        incognitoWatcher: IncognitoWatcher
    ) {
        super(settings, ruleManager, storeUtils, tabWatcher, incognitoWatcher, false, {
            dataType: "mockStorage",
            domainsToClean: "domainsToClean.mockStorage",
            startupApplyRules: "startup.mockStorage.applyRules",
            cleanAllApplyRules: "cleanAll.mockStorage.applyRules",
            domainLeave: "domainLeave.mockStorage",
        } as any);
    }
}

describe("AbstractStorageCleaner", () => {
    let abstractStorageCleaner: StorageCleanerImpl;

    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.ruleManager.mockAllow();
        abstractStorageCleaner = container.resolve(StorageCleanerImpl);
    });

    describe("cleanDomainOnLeave", () => {
        it("does nothing if domainLeave.enabled = false", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(false);
            await abstractStorageCleaner.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("does nothing if domainLeave.mockStorage = false", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
            mocks.settings.get.expect("domainLeave.mockStorage" as SettingsKey).andReturn(false);
            await abstractStorageCleaner.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("does nothing if protected", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
            mocks.settings.get.expect("domainLeave.mockStorage" as SettingsKey).andReturn(true);
            const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                mock: ["isStorageProtected"],
                whitelist: ["cleanDomainOnLeave", "settings", "keys"],
            });
            mock.isStorageProtected.expect("some-domain").andReturn(true);
            await abstractStorageCleaner.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("calls cleanDomain if not protected", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
            mocks.settings.get.expect("domainLeave.mockStorage" as SettingsKey).andReturn(true);

            const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                mock: ["cleanDomain", "isStorageProtected"],
                whitelist: ["cleanDomainOnLeave", "settings", "keys"],
            });
            mock.isStorageProtected.expect("some-domain").andReturn(false);
            mock.cleanDomain.expect(COOKIE_STORE_ID, "some-domain").andResolve();

            await abstractStorageCleaner.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
    });

    describe("isStorageProtected", () => {
        it("should return true for an open domains", () => {
            mocks.tabWatcher.containsDomain.expect("some-domain").andReturn(true);
            expect(abstractStorageCleaner["isStorageProtected"]("some-domain")).toBe(true);
        });
        it.each([[CleanupType.NEVER], [CleanupType.STARTUP]])(
            "should return true if cleanup type is %i",
            (cleanupType) => {
                mocks.tabWatcher.containsDomain.expect("some-domain").andReturn(false);
                mocks.ruleManager.getCleanupTypeFor.expect("some-domain", false, false).andReturn(cleanupType);
                expect(abstractStorageCleaner["isStorageProtected"]("some-domain")).toBe(true);
            }
        );
        it.each([[CleanupType.LEAVE], [CleanupType.INSTANTLY]])(
            "should return false if cleanup type is %i",
            (cleanupType) => {
                mocks.tabWatcher.containsDomain.expect("some-domain").andReturn(false);
                mocks.ruleManager.getCleanupTypeFor.expect("some-domain", false, false).andReturn(cleanupType);
                expect(abstractStorageCleaner["isStorageProtected"]("some-domain")).toBe(false);
            }
        );
    });

    describe("cleanDomain", () => {
        it("should call cleanDomains and removeFromDomainsToClean", async () => {
            const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                mock: ["cleanDomains", "removeFromDomainsToClean"],
                whitelist: ["cleanDomain", "keys"],
            });
            mock.removeFromDomainsToClean.expect(["some-domain"]).andResolve();
            mock.cleanDomains.expect(COOKIE_STORE_ID, ["some-domain"]).andResolve();

            await abstractStorageCleaner.cleanDomain(COOKIE_STORE_ID, "some-domain");
        });
    });

    describe("cleanDomains", () => {
        // eslint-disable-next-line jest/expect-expect
        it("should do nothing if not supported", async () => {
            const hostnames = ["google.com", "amazon.de"];
            (abstractStorageCleaner as any).supportsCleanupByHostname = false;
            await abstractStorageCleaner["cleanDomains"](COOKIE_STORE_ID, hostnames);
        });
        it("should call browser.browsingData.remove if supported", async () => {
            const hostnames = ["google.com", "amazon.de"];
            (abstractStorageCleaner as any).supportsCleanupByHostname = true;
            mockBrowser.browsingData.remove.expect(
                {
                    originTypes: { unprotectedWeb: true },
                    hostnames,
                },
                { mockStorage: true } as any
            );
            await abstractStorageCleaner["cleanDomains"](COOKIE_STORE_ID, hostnames);
        });
    });

    describe("removeFromDomainsToClean", () => {
        it("removes hostnames from domainsToClean if not open", async () => {
            mocks.settings.get
                .expect("domainsToClean.mockStorage" as SettingsKey)
                .andReturn({ a: true, b: true, c: true, d: true });
            mocks.tabWatcher.containsDomain.expect("a").andReturn(true);
            mocks.tabWatcher.containsDomain.expect("b").andReturn(false);
            mocks.tabWatcher.containsDomain.expect("c").andReturn(false);
            mocks.settings.set.expect("domainsToClean.mockStorage" as SettingsKey, { a: true, d: true });
            mocks.settings.save.expect().andResolve();
            await abstractStorageCleaner["removeFromDomainsToClean"](["a", "b", "c"]);
        });
    });
});
