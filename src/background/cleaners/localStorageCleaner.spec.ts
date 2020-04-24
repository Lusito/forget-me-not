/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { LocalStorageCleaner } from "./localStorageCleaner";
import { mockContext, testContext } from "../../testUtils/mockContext";
import { CleanupType } from "../../lib/shared";

const COOKIE_STORE_ID = "mock";

describe("LocalStorageCleaner", () => {
    let localStorageCleaner: LocalStorageCleaner | null = null;

    beforeEach(() => {
        localStorageCleaner = new LocalStorageCleaner(testContext);
    });

    afterEach(() => {
        localStorageCleaner = null;
    });

    describe("cleanDomainOnLeave", () => {
        it("does nothing if domainLeave.enabled = false", async () => {
            mockContext.settings.get.expect("domainLeave.enabled").andReturn(false);
            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("does nothing if domainLeave.localStorage = false", async () => {
            mockContext.settings.get.expect("domainLeave.enabled").andReturn(true);
            mockContext.settings.get.expect("domainLeave.localStorage").andReturn(false);
            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
        });
        it("does nothing if protected", async () => {
            mockContext.settings.get.expect("domainLeave.enabled").andReturn(true);
            mockContext.settings.get.expect("domainLeave.localStorage").andReturn(true);
            const isLocalStorageProtected = jest.fn(() => true);
            localStorageCleaner!["isLocalStorageProtected"] = isLocalStorageProtected;
            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
            expect(isLocalStorageProtected.mock.calls).toEqual([[COOKIE_STORE_ID, "some-domain"]]);
        });
        it("calls cleanDomain if not protected", async () => {
            mockContext.settings.get.expect("domainLeave.enabled").andReturn(true);
            mockContext.settings.get.expect("domainLeave.localStorage").andReturn(true);
            const cleanDomain = jest.fn(() => Promise.resolve());
            localStorageCleaner!["cleanDomain"] = cleanDomain;
            const isLocalStorageProtected = jest.fn(() => false);
            localStorageCleaner!["isLocalStorageProtected"] = isLocalStorageProtected;
            await localStorageCleaner!.cleanDomainOnLeave(COOKIE_STORE_ID, "some-domain");
            expect(isLocalStorageProtected.mock.calls).toEqual([[COOKIE_STORE_ID, "some-domain"]]);
            expect(cleanDomain.mock.calls).toEqual([[COOKIE_STORE_ID, "some-domain"]]);
        });
    });

    describe("isLocalStorageProtected", () => {
        it("should return true for an open domains", () => {
            mockContext.tabWatcher.cookieStoreContainsDomain
                .expect(COOKIE_STORE_ID, "some-domain", true)
                .andReturn(true);
            expect(localStorageCleaner!["isLocalStorageProtected"](COOKIE_STORE_ID, "some-domain")).toBe(true);
        });
        it.each([[CleanupType.NEVER], [CleanupType.STARTUP]])(
            "should return true if cleanup type is %i",
            (cleanupType) => {
                mockContext.tabWatcher.cookieStoreContainsDomain
                    .expect(COOKIE_STORE_ID, "some-domain", true)
                    .andReturn(false);
                mockContext.settings.getCleanupTypeForDomain.expect("some-domain").andReturn(cleanupType);
                expect(localStorageCleaner!["isLocalStorageProtected"](COOKIE_STORE_ID, "some-domain")).toBe(true);
            }
        );
        it.each([[CleanupType.LEAVE], [CleanupType.INSTANTLY]])(
            "should return false if cleanup type is %i",
            (cleanupType) => {
                mockContext.tabWatcher.cookieStoreContainsDomain
                    .expect(COOKIE_STORE_ID, "some-domain", true)
                    .andReturn(false);
                mockContext.settings.getCleanupTypeForDomain.expect("some-domain").andReturn(cleanupType);
                expect(localStorageCleaner!["isLocalStorageProtected"](COOKIE_STORE_ID, "some-domain")).toBe(false);
            }
        );
    });

    describe("cleanDomain", () => {
        it("should call cleanDomains and removeFromDomainsToClean", async () => {
            const cleanDomains = jest.fn();
            const removeFromDomainsToClean = jest.fn();
            localStorageCleaner!["cleanDomains"] = cleanDomains;
            localStorageCleaner!["removeFromDomainsToClean"] = removeFromDomainsToClean;
            await localStorageCleaner!.cleanDomain(COOKIE_STORE_ID, "some-domain");
            expect(cleanDomains.mock.calls).toEqual([[COOKIE_STORE_ID, ["some-domain"]]]);
            expect(removeFromDomainsToClean.mock.calls).toEqual([[["some-domain"]]]);
        });
    });

    describe("cleanDomains", () => {
        // eslint-disable-next-line jest/expect-expect
        it("should do nothing if not supported", async () => {
            const hostnames = ["google.com", "amazon.de"];
            mockContext.supports.removeLocalStorageByHostname.mock(false);
            await localStorageCleaner!["cleanDomains"](COOKIE_STORE_ID, hostnames);
        });
        it("should call browser.browsingData.remove if supported", async () => {
            const hostnames = ["google.com", "amazon.de"];
            mockContext.supports.removeLocalStorageByHostname.mock(true);
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
            mockContext.settings.get.expect("domainsToClean").andReturn({ a: true, b: true, c: true, d: true });
            mockContext.tabWatcher.containsDomain.expect("a").andReturn(true);
            mockContext.tabWatcher.containsDomain.expect("b").andReturn(false);
            mockContext.tabWatcher.containsDomain.expect("c").andReturn(false);
            mockContext.settings.set.expect("domainsToClean", { a: true, d: true });
            mockContext.settings.save.expect().andResolve();
            await localStorageCleaner!["removeFromDomainsToClean"](["a", "b", "c"]);
        });
    });
});
