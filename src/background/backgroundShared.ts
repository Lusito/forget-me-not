/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { isFirefox, browserInfo, isNodeTest } from "../lib/browserInfo";
import { browser, Cookies } from "webextension-polyfill-ts";
import { messageUtil } from "../lib/messageUtil";

export const removeLocalStorageByHostname = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 58;

const supportsFirstPartyIsolation = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 59;

function getCookieRemovalInfo(cookie: Cookies.Cookie) {
    if (cookie.domain.length === 0) {
        return {
            url: `file://${cookie.path}`,
            removedFrom: cookie.path
        };
    }
    const allowSubDomains = cookie.domain.startsWith(".");
    const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
    return {
        url: (cookie.secure ? "https://" : "http://") + rawDomain + cookie.path,
        removedFrom: rawDomain
    };
}

export function removeCookie(cookie: Cookies.Cookie) {
    const removalInfo = getCookieRemovalInfo(cookie);
    const details: Cookies.RemoveDetailsType = {
        name: cookie.name,
        url: removalInfo.url,
        storeId: cookie.storeId
    };
    if (supportsFirstPartyIsolation)
        details.firstPartyDomain = cookie.firstPartyDomain;

    const promise = browser.cookies.remove(details);
    messageUtil.sendSelf("cookieRemoved", removalInfo.removedFrom);
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

export function someItemsMatch<T>(changedKeys: T[], acceptedKeys: T[]) {
    return acceptedKeys.some((s) => changedKeys.indexOf(s) !== -1);
}
