import { getDomain } from "tldjs";

const allowedProtocols = /^https?:$/;

export function removeLeadingDot(value: string) {
    return value.startsWith(".") ? value.substr(1) : value;
}

export function getFirstPartyDomain(domain: string) {
    return getDomain(domain) || domain;
}

export function getFirstPartyCookieDomain(domain: string) {
    const rawDomain = removeLeadingDot(domain);
    return getDomain(rawDomain) || rawDomain;
}

export function getValidHostname(url: string) {
    try {
        const parsedUrl = new URL(url);
        return allowedProtocols.test(parsedUrl.protocol) ? parsedUrl.hostname : "";
    } catch (e) {
        return "";
    }
}
