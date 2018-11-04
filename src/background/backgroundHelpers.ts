/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getDomain } from "tldjs";
import { CleanupType } from "../lib/settingsSignature";

export function getFirstPartyCookieDomain(domain: string) {
    const rawDomain = domain.startsWith(".") ? domain.substr(1) : domain;
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
        const parts = header.split(";");
        const kv = parts[0].split(keyValueRegexpSplit);
        const domainPart = parts.find((part, i) => i > 0 && cookieDomainRegexp.test(part.trim()));
        const domain = domainPart && domainPart.split("=")[1].trim();
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
    className: string;
    i18nBadge: string;
    i18nButton: string;
    color: string | [number, number, number, number];
}

function createBadge(name: string, color: [number, number, number, number]) {
    const className = `cleanup_type_${name}`;
    return {
        className,
        i18nBadge: `${className}_badge`,
        i18nButton: `${className}_button`,
        color
    };
}

export const badges = {
    never: createBadge("never", [38, 69, 151, 255]),
    startup: createBadge("startup", [116, 116, 116, 255]),
    leave: createBadge("leave", [190, 23, 38, 255]),
    instantly: createBadge("instantly", [0, 0, 0, 255]),
    none: {
        className: "",
        i18nBadge: "",
        i18nButton: "",
        color: [0, 0, 0, 255] as [number, number, number, number]
    }
};

export function getBadgeForCleanupType(type: CleanupType) {
    switch (type) {
        case CleanupType.NEVER:
            return badges.never;
        case CleanupType.STARTUP:
            return badges.startup;
        default:
        case CleanupType.LEAVE:
            return badges.leave;
        case CleanupType.INSTANTLY:
            return badges.instantly;
    }
}
