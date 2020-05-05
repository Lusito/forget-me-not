import { container } from "tsyringe";

import { StoreUtils } from "./storeUtils";
import { mocks } from "../testUtils/mocks";

describe("StoreUtils", () => {
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
            it("should only return cookie stores and contextual identities", async () => {
                mocks.browserInfo.isFirefox.expect().andReturn(false);
                const utils = container.resolve(StoreUtils);

                const ids = await utils.getAllCookieStoreIds();
                expect(ids).toHaveSameMembers(["cs-1", "cs-2", "cs-4", "ci-1", "ci-2", "ci-4"]);
            });
        });
        describe("with firefox = true", () => {
            it("should additionally include the default store ids", async () => {
                mocks.browserInfo.isFirefox.expect().andReturn(true);
                const utils = container.resolve(StoreUtils);

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
