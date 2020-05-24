import { container } from "tsyringe";

import { mocks } from "../../testUtils/mocks";
import { PluginDataCleaner } from "./pluginDataCleaner";

describe("PluginDataCleaner", () => {
    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.ruleManager.mockAllow();
    });

    it.each.boolean("should be constructable with %s", (supportsCleanupByHostname) => {
        mocks.supports.removePluginDataByHostname.mock(supportsCleanupByHostname);
        const cleaner = container.resolve(PluginDataCleaner);
        expect(cleaner["supportsCleanupByHostname"]).toBe(supportsCleanupByHostname);
    });
});
