/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { browserInfo, isFirefox } from "../lib/browserInfo";
import { browser, Cookies } from "webextension-polyfill-ts";
import DelayedExecution from "../lib/delayedExecution";

// fixme: make this file unit-testable and add tests
export const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

const COOKIE_CLEANUP_NOTIFICATION_ID = "CookieCleanupNotification";
let cookieRemovalCounts: { [s: string]: number } = {};
const cookieRemoveNotificationStatus = {
    starting: false,
    updateOnStart: false
};
const delayCookieRemoveNotification = new DelayedExecution(() => {
    if (cookieRemoveNotificationStatus.starting) {
        cookieRemoveNotificationStatus.updateOnStart = true;
        return;
    }
    const lines = [];
    let totalCount = 0;
    for (const domain in cookieRemovalCounts) {
        const count = cookieRemovalCounts[domain];
        lines.push(browser.i18n.getMessage("cookie_cleanup_notification_line", [domain, count]));
        totalCount += count;
    }
    cookieRemoveNotificationStatus.starting = true;
    cookieRemoveNotificationStatus.updateOnStart = false;
    browser.notifications.create(COOKIE_CLEANUP_NOTIFICATION_ID, {
        priority: -2,
        type: "basic",
        iconUrl: browser.extension.getURL("icons/icon96.png"),
        title: browser.i18n.getMessage("cookie_cleanup_notification_title", totalCount),
        message: lines.join("\n")
    }).then((s) => {
        cookieRemoveNotificationStatus.starting = false;
        if (cookieRemoveNotificationStatus.updateOnStart)
            delayCookieRemoveNotification.restart(100);
    });
    delayClearCookieRemoveNotification.restart(3000);
});

const delayClearCookieRemoveNotification = new DelayedExecution(() => {
    browser.notifications.clear(COOKIE_CLEANUP_NOTIFICATION_ID);
    cookieRemoveNotificationStatus.starting = false;
    cookieRemovalCounts = {};
});

browser.notifications.onClosed.addListener((id) => {
    cookieRemoveNotificationStatus.starting = false;
    cookieRemovalCounts = {};
    delayClearCookieRemoveNotification.cancel();
});

export function removeCookie(cookie: Cookies.Cookie) {
    const allowSubDomains = cookie.domain.startsWith(".");
    const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
    const details: Cookies.RemoveDetailsType = {
        name: cookie.name,
        url: (cookie.secure ? "https://" : "http://") + rawDomain + cookie.path,
        storeId: cookie.storeId
    };
    if (isFirefox && browserInfo.versionAsNumber >= 59)
        details.firstPartyDomain = cookie.firstPartyDomain;

    browser.cookies.remove(details);
    if (settings.get("showCookieRemovalNotification")) {
        cookieRemovalCounts[rawDomain] = (cookieRemovalCounts[rawDomain] || 0) + 1;
        delayCookieRemoveNotification.restart(500);
    }
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
