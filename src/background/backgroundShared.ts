/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { settings, RuleType } from "../lib/settings";
import { browserInfo, isFirefox } from '../lib/browserInfo';

export const removeLocalStorageByHostname = isFirefox && parseFloat(browserInfo.version) >= 58;

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
    none: {
        color: [0, 0, 0, 255]
    } as BadgeInfo
}

export function removeCookie(cookie: browser.cookies.Cookie) {
    let allowSubDomains = cookie.domain.startsWith('.');
    let rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
    browser.cookies.remove({
        name: cookie.name,
        url: (cookie.secure ? 'https://' : 'http://') + rawDomain + cookie.path,
        storeId: cookie.storeId
    });
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
    if (matchingRules.length === 0)
        return badges.forget;
    for (const rule of matchingRules) {
        if (rule.type === RuleType.WHITE)
            return badges.white;
    }
    return badges.gray;
}
