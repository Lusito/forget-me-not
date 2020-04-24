/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { StoreUtils } from "./storeUtils";

describe("Misc functionality", () => {
    describe("getAllCookieStoreIds", () => {
        beforeEach(() => {
            mockBrowser.cookies.getAllCookieStores
                .expect()
                .andResolve(["cs-1", "cs-2", "cs-4"].map((id) => ({ id } as any)));
            mockBrowser.contextualIdentities.query
                .expect({})
                .andResolve(["ci-1", "ci-2", "ci-4"].map((cookieStoreId) => ({ cookieStoreId } as any)));
        });
        describe("with firefox = false", () => {
            const utils = new StoreUtils(false);
            it("should only return cookie stores and contextual identities", async () => {
                const ids = await utils.getAllCookieStoreIds();
                expect(ids).toHaveSameMembers(["cs-1", "cs-2", "cs-4", "ci-1", "ci-2", "ci-4"]);
            });
        });
        describe("with firefox = true", () => {
            const utils = new StoreUtils(true);
            it("should additionally include the default store ids", async () => {
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
});
