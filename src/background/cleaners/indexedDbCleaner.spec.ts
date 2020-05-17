import { container } from "tsyringe";

import { mocks } from "../../testUtils/mocks";
import { IndexedDbCleaner } from "./indexedDbCleaner";

describe("IndexedDbCleaner", () => {
    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.ruleManager.mockAllow();
    });

    it.each.boolean("should be constructable with %s", (supportsCleanupByHostname) => {
        mocks.supports.removeIndexedDbByHostname.mock(supportsCleanupByHostname);
        const cleaner = container.resolve(IndexedDbCleaner);
        expect(cleaner["supportsCleanupByHostname"]).toBe(supportsCleanupByHostname);
    });
});
