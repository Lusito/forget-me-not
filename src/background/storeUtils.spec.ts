/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { StoreUtils } from "./storeUtils";

describe("Misc functionality", () => {
    // fixme: isFirefox: false
    const utils = new StoreUtils(true);
    describe("getAllCookieStoreIds", () => {
        beforeEach(() => {
            browserMock.cookies.cookieStores = [
                { id: "cs-1", tabIds: [], incognito: false },
                { id: "cs-2", tabIds: [], incognito: false },
                { id: "cs-4", tabIds: [], incognito: false },
            ];
            browserMock.contextualIdentities.contextualIdentities = [
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-1" },
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-2" },
                { name: "", icon: "", iconUrl: "", color: "", colorCode: "", cookieStoreId: "ci-4" },
            ];
        });
        it("should return the correct cookie store ids", async () => {
            const ids = await utils.getAllCookieStoreIds();
            expect(ids).toHaveSameMembers([
                "firefox-default",
                "firefox-private",
                "cs-1",
                "cs-2",
                "cs-4",
                "ci-1",
                "ci-2",
                "ci-4",
            ]);
        });
    });
});
