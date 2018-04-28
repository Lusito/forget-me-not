/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { isFirefox, browserInfo, isNodeTest } from "../lib/browserInfo";
import { browser, Cookies } from "webextension-polyfill-ts";
import { messageUtil } from "../lib/messageUtil";

// fixme: make this file unit-testable and add tests
export const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

const supportsFirstPartyIsolation = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 59;

export function removeCookie(cookie: Cookies.Cookie) {
    const allowSubDomains = cookie.domain.startsWith(".");
    const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
    const details: Cookies.RemoveDetailsType = {
        name: cookie.name,
        url: (cookie.secure ? "https://" : "http://") + rawDomain + cookie.path,
        storeId: cookie.storeId
    };
    if (supportsFirstPartyIsolation)
        details.firstPartyDomain = cookie.firstPartyDomain;

    const promise = browser.cookies.remove(details);
    messageUtil.sendSelf("cookieRemoved", rawDomain);
    return promise;
}

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
