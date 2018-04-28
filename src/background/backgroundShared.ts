/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { browserInfo, isFirefox } from "../lib/browserInfo";
import { browser } from "webextension-polyfill-ts";

// fixme: make this file unit-testable and add tests
export const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

export function cleanLocalStorage(hostnames: string[], cookieStoreId: string) {
    // Fixme: use cookieStoreId when it's supported by firefox
    if (removeLocalStorageByHostname) {
        const domainsToClean = { ...settings.get("domainsToClean") };
        for (const hostname of hostnames)
            delete domainsToClean[hostname];
        settings.set("domainsToClean", domainsToClean);
        settings.save();
        browser.browsingData.remove({
            originTypes: { unprotectedWeb: true },
            hostnames
        }, { localStorage: true });
        return true;
    }
    return false;
}
