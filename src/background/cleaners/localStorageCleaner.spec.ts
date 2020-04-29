import { container } from "tsyringe";
import { mockAssimilate } from "mockzilla";

import { LocalStorageCleaner } from "./localStorageCleaner";
import { mocks } from "../../testUtils/mocks";
import { CleanupType } from "../../shared/types";

const COOKIE_STORE_ID = "mock";

describe("LocalStorageCleaner", () => {
    let localStorageCleaner: LocalStorageCleaner | null = null;

    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.domainUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.supports.mockAllow();
        localStorageCleaner = container.resolve(LocalStorageCleaner);
    });

    afterEach(() => {
        localStorageCleaner = null;
    });

    describe("cleanDomainOnLeave", () => {
        it("does nothing if domainLeave.enabled = false", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(false);
            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("does nothing if domainLeave.localStorage = false", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
            mocks.settings.get.expect("domainLeave.localStorage").andReturn(false);
            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("does nothing if protected", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
            mocks.settings.get.expect("domainLeave.localStorage").andReturn(true);
            const mock = mockAssimilate(localStorageCleaner!, "localStorageCleaner", {
                mock: ["isLocalStorageProtected"],
                whitelist: ["cleanDomainOnLeave", "settings"],
            });
            mock.isLocalStorageProtected.expect(COOKIE_STORE_ID, "some-domain").andReturn(true);
            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("calls cleanDomain if not protected", async () => {
            mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
            mocks.settings.get.expect("domainLeave.localStorage").andReturn(true);

            const mock = mockAssimilate(localStorageCleaner!, "localStorageCleaner", {
                mock: ["cleanDomain", "isLocalStorageProtected"],
                whitelist: ["cleanDomainOnLeave", "settings"],
            });
            mock.isLocalStorageProtected.expect(COOKIE_STORE_ID, "some-domain").andReturn(false);
            mock.cleanDomain.expect(COOKIE_STORE_ID, "some-domain").andResolve();

            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
    });

    describe("isLocalStorageProtected", () => {
        it("should return true for an open domains", () => {
            mocks.tabWatcher.cookieStoreContainsDomain.expect(COOKIE_STORE_ID, "some-domain", true).andReturn(true);
            expect(localStorageCleaner!["isLocalStorageProtected"](COOKIE_STORE_ID, "some-domain")).toBe(true);
        });
        it.each([[CleanupType.NEVER], [CleanupType.STARTUP]])(
            "should return true if cleanup type is %i",
            (cleanupType) => {
                mocks.tabWatcher.cookieStoreContainsDomain
                    .expect(COOKIE_STORE_ID, "some-domain", true)
                    .andReturn(false);
                mocks.settings.getCleanupTypeForDomain.expect("some-domain").andReturn(cleanupType);
                expect(localStorageCleaner!["isLocalStorageProtected"](COOKIE_STORE_ID, "some-domain")).toBe(true);
            }
        );
        it.each([[CleanupType.LEAVE], [CleanupType.INSTANTLY]])(
            "should return false if cleanup type is %i",
            (cleanupType) => {
                mocks.tabWatcher.cookieStoreContainsDomain
                    .expect(COOKIE_STORE_ID, "some-domain", true)
                    .andReturn(false);
                mocks.settings.getCleanupTypeForDomain.expect("some-domain").andReturn(cleanupType);
                expect(localStorageCleaner!["isLocalStorageProtected"](COOKIE_STORE_ID, "some-domain")).toBe(false);
            }
        );
    });

    describe("cleanDomain", () => {
        it("should call cleanDomains and removeFromDomainsToClean", async () => {
            const mock = mockAssimilate(localStorageCleaner!, "localStorageCleaner", {
                mock: ["cleanDomains", "removeFromDomainsToClean"],
                whitelist: ["cleanDomain"],
            });
            mock.removeFromDomainsToClean.expect(["some-domain"]).andResolve();
            mock.cleanDomains.expect(COOKIE_STORE_ID, ["some-domain"]).andResolve();

            await localStorageCleaner!.cleanDomain(COOKIE_STORE_ID, "some-domain");
        });
    });

    describe("cleanDomains", () => {
        // eslint-disable-next-line jest/expect-expect
        it("should do nothing if not supported", async () => {
            const hostnames = ["google.com", "amazon.de"];
            mocks.supports.removeLocalStorageByHostname.mock(false);
            await localStorageCleaner!["cleanDomains"](COOKIE_STORE_ID, hostnames);
        });
        it("should call browser.browsingData.remove if supported", async () => {
            const hostnames = ["google.com", "amazon.de"];
            mocks.supports.removeLocalStorageByHostname.mock(true);
            mockBrowser.browsingData.remove.expect(
                {
                    originTypes: { unprotectedWeb: true },
                    hostnames,
                },
                { localStorage: true }
            );
            await localStorageCleaner!["cleanDomains"](COOKIE_STORE_ID, hostnames);
        });
    });

    describe("removeFromDomainsToClean", () => {
        it("removes hostnames from domainsToClean if not open", async () => {
            mocks.settings.get.expect("domainsToClean").andReturn({ a: true, b: true, c: true, d: true });
            mocks.tabWatcher.containsDomain.expect("a").andReturn(true);
            mocks.tabWatcher.containsDomain.expect("b").andReturn(false);
            mocks.tabWatcher.containsDomain.expect("c").andReturn(false);
            mocks.settings.set.expect("domainsToClean", { a: true, d: true });
            mocks.settings.save.expect().andResolve();
            await localStorageCleaner!["removeFromDomainsToClean"](["a", "b", "c"]);
        });
    });
});
