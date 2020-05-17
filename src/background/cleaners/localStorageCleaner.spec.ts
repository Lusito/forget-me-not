import { container } from "tsyringe";

import { mocks } from "../../testUtils/mocks";
import { LocalStorageCleaner } from "./localStorageCleaner";

describe("LocalStorageCleaner", () => {
    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.ruleManager.mockAllow();
    });

    it.each.boolean("should be constructable with %s", (supportsCleanupByHostname) => {
        mocks.supports.removeLocalStorageByHostname.mock(supportsCleanupByHostname);
        const cleaner = container.resolve(LocalStorageCleaner);
        expect(cleaner["supportsCleanupByHostname"]).toBe(supportsCleanupByHostname);
    });
});
