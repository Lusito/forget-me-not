/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { singleton } from "tsyringe";
import { getDomain } from "tldjs"; // fixme: export via utils?

const allowedProtocols = /^https?:$/;

@singleton()
export class DomainUtils {
    public removeLeadingDot(value: string) {
        return value.startsWith(".") ? value.substr(1) : value;
    }

    public getFirstPartyCookieDomain(domain: string) {
        const rawDomain = this.removeLeadingDot(domain);
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
