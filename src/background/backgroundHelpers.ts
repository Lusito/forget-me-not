/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getDomain } from "tldjs";

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
        //fixme: get first party domain?
        return {
            name: kv[0].trim(),
            value: kv[1].trim(),
            domain: domain || fallbackDomain
        };
    } catch (e) {
        return null;
    }
}
