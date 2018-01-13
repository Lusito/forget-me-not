/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings, RuleType } from "../lib/settings";
import { browserInfo, isFirefox } from '../lib/browserInfo';
import { Cookies } from "../browser/cookies";
import { browser } from "../browser/browser";
import DelayedExecution from "../lib/delayedExecution";

export const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

export interface BadgeInfo {
    i18nKey?: string;
    color: string | [number, number, number, number];
}

export const badges = {
    white: {
        i18nKey: "badge_white",
        color: [38, 69, 151, 255]
    } as BadgeInfo,
    gray: {
        i18nKey: "badge_gray",
        color: [116, 116, 116, 255]
    } as BadgeInfo,
    forget: {
        i18nKey: "badge_forget",
        color: [190, 23, 38, 255]
    } as BadgeInfo,
    block: {
        i18nKey: "badge_block",
        color: [0, 0, 0, 255]
    } as BadgeInfo,
    none: {
        color: [0, 0, 0, 255]
    } as BadgeInfo
}

const COOKIE_CLEANUP_NOTIFICATION_ID: string = "CookieCleanupNotification";
let cookieRemovalCounts: { [s: string]: number } = {};
let cookieRemoveNotificationStatus = {
    starting: false,
    updateOnStart: false
};
const delayCookieRemoveNotification = new DelayedExecution(() => {
    if(cookieRemoveNotificationStatus.starting) {
        cookieRemoveNotificationStatus.updateOnStart = true;
        return;
    }
    const lines = [];
    let totalCount = 0;
    for (let domain in cookieRemovalCounts) {
        const count = cookieRemovalCounts[domain];
        lines.push(browser.i18n.getMessage('cookie_cleanup_notification_line', [domain, count]));
        totalCount += count;
    }
    cookieRemoveNotificationStatus.starting = true;
    cookieRemoveNotificationStatus.updateOnStart = false;
    browser.notifications.create(COOKIE_CLEANUP_NOTIFICATION_ID, {
        priority: -2,
        type: "basic",
        iconUrl: browser.extension.getURL("icons/icon96.png"),
        title: browser.i18n.getMessage('cookie_cleanup_notification_title', totalCount),
        message: lines.join('\n')
    }).then((s)=> {
        cookieRemoveNotificationStatus.starting = false;
        if(cookieRemoveNotificationStatus.updateOnStart)
            delayCookieRemoveNotification.restart(100);
    });
    delayClearCookieRemoveNotification.restart(3000);
});

const delayClearCookieRemoveNotification = new DelayedExecution(() => {
    browser.notifications.clear(COOKIE_CLEANUP_NOTIFICATION_ID);
    cookieRemoveNotificationStatus.starting = false;
    cookieRemovalCounts = {};
});

browser.notifications.onClosed.addListener((id)=> {
    cookieRemoveNotificationStatus.starting = false;
    cookieRemovalCounts = {};
    delayClearCookieRemoveNotification.cancel();
});

export function removeCookie(cookie: Cookies.Cookie) {
    let allowSubDomains = cookie.domain.startsWith('.');
    let rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
    const details: Cookies.Details = {
        name: cookie.name,
        url: (cookie.secure ? 'https://' : 'http://') + rawDomain + cookie.path,
        storeId: cookie.storeId
    };
    if(isFirefox && browserInfo.versionAsNumber >= 59)
        details.firstPartyDomain = cookie.firstPartyDomain;

    browser.cookies.remove(details);
    if(settings.get('showCookieRemovalNotification')) {
        cookieRemovalCounts[rawDomain] = (cookieRemovalCounts[rawDomain] || 0) + 1;
        delayCookieRemoveNotification.restart(500);
    }
}

export function cleanLocalStorage(hostnames: string[], cookieStoreId: string) {
    //Fixme: use cookieStoreId when it's supported by firefox
    if (removeLocalStorageByHostname) {
        let domainsToClean = { ...settings.get('domainsToClean') };
        for (const hostname of hostnames)
            delete domainsToClean[hostname];
        settings.set('domainsToClean', domainsToClean);
        settings.save();
        browser.browsingData.remove({
            originTypes: { unprotectedWeb: true },
            hostnames: hostnames
        }, { localStorage: true });
        return true;
    }
    return false;
}

export function getBadgeForDomain(domain: string) {
    if (settings.get('whitelistNoTLD') && domain.indexOf('.') === -1)
        return badges.white;
    let matchingRules = settings.getMatchingRules(domain);
    if (matchingRules.find((r) => r.type === RuleType.BLOCK))
        return badges.block;
    if (matchingRules.length === 0 || matchingRules.find((r) => r.type === RuleType.FORGET))
        return badges.forget;
    if (matchingRules.find((r) => r.type === RuleType.WHITE))
        return badges.white;
    return badges.gray;
}
