import { BrowserType, BrowserInfo } from "./browserInfo";
import { getSupports, SupportsInfoProps } from "./supportsInfo";

const HIGHEST_VERSION = 999999;
const supportsNone: SupportsInfoProps = {
    removeLocalStorageByHostname: false,
    firstPartyIsolation: false,
    requestFilterIncognito: false,
    removeIndexedDbByHostname: false,
    removeServiceWorkersByHostname: false,
    removeCacheByHostname: false,
    removePluginDataByHostname: false,
};

describe("getSupports", () => {
    describe.each([
        ["firefox", BrowserType.FIREFOX],
        ["firefox", BrowserType.FENNEC],
    ])("with browser=%s", (_, type) => {
        const isFirefox = type === BrowserType.FIREFOX;
        describe.each([
            [
                57,
                supportsNone,
            ],
            [
                58,
                {
                    ...supportsNone,
                    removeLocalStorageByHostname: isFirefox,
                },
            ],
            [
                59,
                {
                    ...supportsNone,
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                },
            ],
            [
                67,
                {
                    ...supportsNone,
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                },
            ],
            [
                68,
                {
                    ...supportsNone,
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                },
            ],
            [
                76,
                {
                    ...supportsNone,
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                },
            ],
            [
                77,
                {
                    ...supportsNone,
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                    removeIndexedDbByHostname: isFirefox,
                    removeServiceWorkersByHostname: isFirefox,
                },
            ],
            [
                78,
                {
                    removeLocalStorageByHostname: isFirefox,
                    firstPartyIsolation: true,
                    requestFilterIncognito: isFirefox,
                    removeIndexedDbByHostname: isFirefox,
                    removeServiceWorkersByHostname: isFirefox,
                    removeCacheByHostname: isFirefox,
                    removePluginDataByHostname: isFirefox,
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
                    removeCacheByHostname: isFirefox,
                    removePluginDataByHostname: isFirefox,
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
            ).toEqual(supportsNone);
        });
    });
});
