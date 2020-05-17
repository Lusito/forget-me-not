import { container, singleton } from "tsyringe";
import { mockAssimilate, whitelistPropertyAccess } from "mockzilla";

import { mocks } from "../../testUtils/mocks";
import { CleanupType } from "../../shared/types";
import { AbstractStorageCleaner } from "./abstractStorageCleaner";
import { Settings } from "../../shared/settings";
import { RuleManager } from "../../shared/ruleManager";
import { StoreUtils } from "../../shared/storeUtils";
import { TabWatcher } from "../tabWatcher";
import { IncognitoWatcher } from "../incognitoWatcher";
import { SettingsKey } from "../../shared/defaultSettings";
import { quickTab } from "../../testUtils/quickHelpers";

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

    describe("init", () => {
        it("should do nothing with supportsCleanupByHostname=false", () => {
            (abstractStorageCleaner as any).supportsCleanupByHostname = false;
            whitelistPropertyAccess(abstractStorageCleaner, "init", "supportsCleanupByHostname");
            abstractStorageCleaner.init([quickTab("http://domain.com", COOKIE_STORE_ID, false)]);
        });
        describe("with supportsCleanupByHostname=true", () => {
            beforeEach(() => {
                (abstractStorageCleaner as any).supportsCleanupByHostname = true;
                mocks.storeUtils.defaultCookieStoreId.mock("default-mock");
            });
            it("should call onDomainEnter for all tabs that have a url, an id and are not incognito", () => {
                const tabs = [
                    quickTab("http://domain1.com", COOKIE_STORE_ID, false),
                    quickTab("http://domain2.com", "", false),
                    // id 0
                    { ...quickTab("", COOKIE_STORE_ID, true), id: 0 },
                    { ...quickTab("", COOKIE_STORE_ID, false), id: 0 },
                    { ...quickTab("http://domain.com", COOKIE_STORE_ID, true), id: 0 },
                    { ...quickTab("http://domain.com", COOKIE_STORE_ID, false), id: 0 },
                    // url empty
                    quickTab("", COOKIE_STORE_ID, true),
                    quickTab("", COOKIE_STORE_ID, false),
                    // incognito
                    quickTab("http://domain.com", COOKIE_STORE_ID, true),
                ];
                const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                    mock: ["onDomainEnter"],
                });
                mock.onDomainEnter.expect(COOKIE_STORE_ID, "domain1.com");
                mock.onDomainEnter.expect("default-mock", "domain2.com");
                mocks.tabWatcher.domainEnterListeners.add.expect(expect.anything());

                abstractStorageCleaner.init(tabs);
            });
            it("should register domainEnterListener correctly", () => {
                mocks.tabWatcher.domainEnterListeners.add.expect(abstractStorageCleaner["onDomainEnter"]);

                abstractStorageCleaner.init([]);
            });
        });
    });

    describe("onDomainEnter", () => {
        it("should do nothing for incognito stores", () => {
            mocks.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(true);
            abstractStorageCleaner["onDomainEnter"](COOKIE_STORE_ID, "some-domain.com");
        });
        it("should add the domain to domainsToClean for non-incognito stores", () => {
            const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                mock: ["updateDomainsToClean"],
            });
            mocks.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(false);
            mocks.settings.get.expect("domainsToClean.mockStorage" as SettingsKey).andReturn({ a: true, d: true });
            mock.updateDomainsToClean.expect({ a: true, d: true, f: true });
            abstractStorageCleaner["onDomainEnter"](COOKIE_STORE_ID, "f");
        });
    });

    describe("clean", () => {
        describe.each([
            [false, false],
            [true, false],
            [false, true],
        ])("with supportsCleanupByHostname=%j and mockStorage=%j", (supportsCleanupByHostname, mockStorage) => {
            it.each.boolean("should do nothing with %s", async (startup) => {
                whitelistPropertyAccess(abstractStorageCleaner, "clean", "keys", "supportsCleanupByHostname");
                (abstractStorageCleaner as any).supportsCleanupByHostname = supportsCleanupByHostname;
                await abstractStorageCleaner.clean({ mockStorage } as any, startup);
            });
        });
        describe("with supportsCleanupByHostname=true and mockStorage=true", () => {
            describe.each([
                [true, "startup.mockStorage.applyRules"],
                [false, "cleanAll.mockStorage.applyRules"],
            ])("with startup=%j", (startup, settingsKey) => {
                it(`should clear updateDomainsToClean if ${settingsKey}=false`, async () => {
                    const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                        mock: ["updateDomainsToClean"],
                        whitelist: ["clean", "keys", "settings", "supportsCleanupByHostname"],
                    });
                    mock.updateDomainsToClean.expect({}).andResolve();
                    (abstractStorageCleaner as any).supportsCleanupByHostname = true;
                    mocks.settings.get.expect(settingsKey as SettingsKey).andReturn(false);
                    
                    const typeSet = { mockStorage: true };

                    await abstractStorageCleaner.clean(typeSet as any, startup);
                    expect(typeSet).toEqual({ mockStorage: true });
                });
                it(`should delegate to cleanWithRules if ${settingsKey}=true`, async () => {
                    const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                        mock: ["cleanWithRules"],
                        whitelist: ["clean", "keys", "settings", "supportsCleanupByHostname"],
                    });
                    mock.cleanWithRules.expect(startup).andResolve();
                    (abstractStorageCleaner as any).supportsCleanupByHostname = true;
                    mocks.settings.get.expect(settingsKey as SettingsKey).andReturn(true);
                    const typeSet = { mockStorage: true };

                    await abstractStorageCleaner.clean(typeSet as any, startup);
                    expect(typeSet).toEqual({ mockStorage: false });
                });
            });
        });
    });

    describe("cleanWithRules", () => {
        describe.each.boolean("with %s", (startup) => {
            it("should do nothing if no domains to clean", async () => {
                const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                    mock: ["getDomainsToClean"],
                    whitelist: ["cleanWithRules"]
                });
                mock.getDomainsToClean.expect(startup).andReturn([]);
                await abstractStorageCleaner["cleanWithRules"](startup);
            });
            describe("with multiple domains to clean", () => {
                const hostnames = ["a", "b", "c", "d"];
                it("should call removeFromDomainsToClean and cleanDomains for every cookie store", async () => {
                    const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                        mock: ["getDomainsToClean", "removeFromDomainsToClean", "cleanDomains"],
                        whitelist: ["cleanWithRules", "storeUtils"]
                    });
                    mock.getDomainsToClean.expect(startup).andReturn(hostnames);
                    mock.removeFromDomainsToClean.expect(hostnames).andResolve();
                    mocks.storeUtils.getAllCookieStoreIds.expect().andResolve(["id1", "id2"]);
                    mock.cleanDomains.expect("id1", hostnames).andResolve();
                    mock.cleanDomains.expect("id2", hostnames).andResolve();
                    await abstractStorageCleaner["cleanWithRules"](startup);
                });
            });
        });
    });

    describe("updateDomainsToClean", () => {
        it("should set domainsToClean and save settings", async () => {
            const domains = { a: true, d: true };
            mocks.settings.set.expect("domainsToClean.mockStorage" as SettingsKey, domains);
            mocks.settings.save.expect().andResolve();
            await abstractStorageCleaner["updateDomainsToClean"](domains);
        });
    });

    describe("isDomainProtected", () => {
        describe.each.boolean("with %s", (ignoreStartupType) => {
            it("should return true if protectOpenDomains=true and tabWatcher.containsDomain=true", () => {
                mocks.tabWatcher.containsDomain.expect("some-domain.com").andReturn(true);
                const result = abstractStorageCleaner["isDomainProtected"]("some-domain.com", ignoreStartupType, true);
                expect(result).toBe(true);
            });
            it.each([
                [false, false],
                [false, true],
                [true, false],
            ])(
                "should delegate to ruleManager.isDomainProtected if protectOpenDomains=%j and tabWatcher.containsDomain=%j",
                (protectOpenDomains, containsDomain) => {
                    if (protectOpenDomains)
                        mocks.tabWatcher.containsDomain.expect("some-domain.com").andReturn(containsDomain);
                    const isProtected = {} as any;
                    mocks.ruleManager.isDomainProtected
                        .expect("some-domain.com", false, ignoreStartupType)
                        .andReturn(isProtected);
                    const result = abstractStorageCleaner["isDomainProtected"](
                        "some-domain.com",
                        ignoreStartupType,
                        protectOpenDomains
                    );
                    expect(result).toBe(isProtected);
                }
            );
        });
    });

    describe("getDomainsToClean", () => {
        describe.each.boolean("with %s", (startup, protectOpenDomains) => {
            it("should return domains from domainsToClean, which return false for isDomainProtected", () => {
                if (!startup) mocks.settings.get.expect("cleanAll.protectOpenDomains").andReturn(protectOpenDomains);
                mocks.settings.get
                    .expect("domainsToClean.mockStorage" as SettingsKey)
                    .andReturn({ a: true, b: true, c: true, d: true });
                const mock = mockAssimilate(abstractStorageCleaner, "abstractStorageCleaner", {
                    mock: ["isDomainProtected"],
                });
                const adjustedProtectOpenDomains = startup || protectOpenDomains;
                mock.isDomainProtected.expect("a", startup, adjustedProtectOpenDomains).andReturn(true);
                mock.isDomainProtected.expect("b", startup, adjustedProtectOpenDomains).andReturn(false);
                mock.isDomainProtected.expect("c", startup, adjustedProtectOpenDomains).andReturn(true);
                mock.isDomainProtected.expect("d", startup, adjustedProtectOpenDomains).andReturn(false);

                const result = abstractStorageCleaner["getDomainsToClean"](startup);
                expect(result).toHaveSameMembers(["b", "d"]);
            });
        });
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
