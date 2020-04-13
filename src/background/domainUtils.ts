/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getDomain } from "tldjs"; // fixme: export via utils?

const allowedProtocols = /^https?:$/;

export class DomainUtils {
    public getFirstPartyCookieDomain(domain: string) {
        const rawDomain = domain.startsWith(".") ? domain.substr(1) : domain;
        return getDomain(rawDomain) || rawDomain;
    }

    public getValidHostname(url: string) {
        try {
            const parsedUrl = new URL(url);
            return allowedProtocols.test(parsedUrl.protocol) ? parsedUrl.hostname : "";
        } catch (e) {
            return "";
        }
    }
}
