import { container } from "tsyringe";

import { mocks } from "../../testUtils/mocks";
import { CacheCleaner } from "./cacheCleaner";

describe("CacheCleaner", () => {
    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.ruleManager.mockAllow();
    });

    it.each.boolean("should be constructable with %s", (supportsCleanupByHostname) => {
        mocks.supports.removeCacheByHostname.mock(supportsCleanupByHostname);
        const cleaner = container.resolve(CacheCleaner);
        expect(cleaner["supportsCleanupByHostname"]).toBe(supportsCleanupByHostname);
    });
});
