import { isFirefox } from "./browserInfo";

/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export interface CookieDomainInfo {
    domain: string;
    className: string;
    i18nBadge: string;
    i18nButton: string;
}

export const allowedProtocols = /^https?:$/;

export function getValidHostname(url: string) {
    try {
        const parsedUrl = new URL(url);
        return allowedProtocols.test(parsedUrl.protocol) ? parsedUrl.hostname : "";
    } catch (e) {
        return "";
    }
}

export const DEFAULT_COOKIE_STORE_ID = isFirefox ? "firefox-default" : "0";
