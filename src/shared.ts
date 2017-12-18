/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export interface CookieDomainInfo {
    domain: string,
    badge: string
}

export const allowedProtocols = /^https?:$/;

export function getValidHostname(url: string) {
    try {
        const parsedUrl = new URL(url);
        return allowedProtocols.test(parsedUrl.protocol) ? parsedUrl.hostname : '';
    } catch(e) {
        return '';
    }
}
