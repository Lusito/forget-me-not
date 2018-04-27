/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getDomain } from "tldjs";
import { RuleType } from "../lib/settingsSignature";

export function getFirstPartyCookieDomain(domain: string) {
    const rawDomain = domain.startsWith('.') ? domain.substr(1) : domain;
    return getDomain(rawDomain) || rawDomain;
}

export interface SetCookieHeader {
    name: string;
    value: string;
    domain: string;
}

const cookieDomainRegexp = /^domain=/i;
const keyValueRegexpSplit = /=(.+)/;

export function parseSetCookieHeader(header: string, fallbackDomain: string): SetCookieHeader | null {
    try {
        const parts = header.split(';');
        const kv = parts[0].split(keyValueRegexpSplit);
        const domainPart = parts.find((part, i) => i > 0 && cookieDomainRegexp.test(part.trim()));
        const domain = domainPart && domainPart.split('=')[1].trim();
        // fixme: get first party domain?
        return {
            name: kv[0].trim(),
            value: kv[1].trim(),
            domain: domain || fallbackDomain
        };
    } catch (e) {
        return null;
    }
}

export interface BadgeInfo {
    i18nKey?: string;
    color: string | [number, number, number, number];
}

export const badges: { [s: string]: BadgeInfo } = {
    white: {
        i18nKey: "badge_white",
        color: [38, 69, 151, 255]
    },
    gray: {
        i18nKey: "badge_gray",
        color: [116, 116, 116, 255]
    },
    forget: {
        i18nKey: "badge_forget",
        color: [190, 23, 38, 255]
    },
    block: {
        i18nKey: "badge_block",
        color: [0, 0, 0, 255]
    },
    none: {
        color: [0, 0, 0, 255]
    }
};

export function getBadgeForRuleType(type: RuleType) {
    switch (type) {
        case RuleType.WHITE:
            return badges.white;
        case RuleType.GRAY:
            return badges.gray;
        default:
        case RuleType.FORGET:
            return badges.forget;
        case RuleType.BLOCK:
            return badges.block;
    }
}
