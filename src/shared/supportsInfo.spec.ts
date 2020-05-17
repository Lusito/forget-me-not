import { BrowserType, BrowserInfo } from "./browserInfo";
import { getSupports } from "./supportsInfo";

const HIGHEST_VERSION = 999999;

describe("getSupports", () => {
    describe.each([
        ["firefox", BrowserType.FIREFOX],
        ["firefox", BrowserType.FENNEC],
    ])("with browser=%s", (_, type) => {
        const isFirefox = type === BrowserType.FIREFOX;
        describe.each([
            [
                57,
                {
                    removeLocalStorageByHostname: false,
                    firstPartyIsolation: false,
                    requestFilterIncognito: false,
                    removeIndexedDbByHostname: false,
                    removeServiceWorkersByHostname: false,
                },
            ],
            [
                58,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: false,
                    requestFilterIncognito: false,
                    removeIndexedDbByHostname: false,
                    removeServiceWorkersByHostname: false,
                },
            ],
            [
                59,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: false,
                    removeIndexedDbByHostname: false,
                    removeServiceWorkersByHostname: false,
                },
            ],
            [
                67,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: false,
                    removeIndexedDbByHostname: false,
                    removeServiceWorkersByHostname: false,
                },
            ],
            [
                68,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                    removeIndexedDbByHostname: false,
                    removeServiceWorkersByHostname: false,
                },
            ],
            [
                76,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                    removeIndexedDbByHostname: false,
                    removeServiceWorkersByHostname: false,
                },
            ],
            [
                77,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                    removeIndexedDbByHostname: isFirefox,
                    removeServiceWorkersByHostname: isFirefox,
                },
            ],
            [
                HIGHEST_VERSION,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                    removeIndexedDbByHostname: isFirefox,
                    removeServiceWorkersByHostname: isFirefox,
                },
            ],
        ])("with browserVersion=%i", (versionAsNumber, supportsInfo) => {
            it("should return the correct supports info", () => {
                expect(
                    getSupports({
                        type,
                        versionAsNumber,
                    } as any)
                ).toEqual(supportsInfo);
            });
        });
    });

    describe.each([
        ["opera", BrowserType.OPERA],
        ["internet explorer", BrowserType.IE],
        ["unknown", BrowserType.UNKNOWN],
    ])("with browser=%s", (_, type) => {
        // eslint-disable-next-line jest/no-identical-title
        it("should return the correct supports info", () => {
            expect(
                getSupports(({
                    type,
                    versionAsNumber: HIGHEST_VERSION,
                } as Partial<BrowserInfo>) as any)
            ).toEqual({
                removeLocalStorageByHostname: false,
                firstPartyIsolation: false,
                requestFilterIncognito: false,
                removeIndexedDbByHostname: false,
                removeServiceWorkersByHostname: false,
            });
        });
    });
});
