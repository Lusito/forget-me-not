import { container } from "tsyringe";

import { mocks } from "../../testUtils/mocks";
import { ServiceWorkerCleaner } from "./serviceWorkerCleaner";

describe("ServiceWorkerCleaner", () => {
    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.storeUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.ruleManager.mockAllow();
    });

    it.each.boolean("should be constructable with %s", (supportsCleanupByHostname) => {
        mocks.supports.removeServiceWorkersByHostname.mock(supportsCleanupByHostname);
        const cleaner = container.resolve(ServiceWorkerCleaner);
        expect(cleaner["supportsCleanupByHostname"]).toBe(supportsCleanupByHostname);
    });
});
