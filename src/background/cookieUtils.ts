/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { Cookies, browser } from "webextension-polyfill-ts";

import { messageUtil } from "../lib/messageUtil";
import { ExtensionContext } from "../lib/bootstrap";

const cookieDomainRegexp = /^domain=/i;
const keyValueRegexpSplit = /=(.+)/;

interface SetCookieHeader {
    name: string;
    value: string;
    domain: string;
}

export class CookieUtils {
    private supportsFirstPartyIsolation: boolean;

    public constructor(context: ExtensionContext) {
        this.supportsFirstPartyIsolation = context.supports.firstPartyIsolation;
    }

    private getCookieRemovalInfo(cookie: Cookies.Cookie) {
        if (cookie.domain.length === 0) {
            return {
                url: `file://${cookie.path}`,
                removedFrom: cookie.path,
            };
        }
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        return {
            url: (cookie.secure ? "https://" : "http://") + rawDomain + cookie.path,
            removedFrom: rawDomain,
        };
    }

    public removeCookie = async (cookie: Cookies.Cookie) => {
        const removalInfo = this.getCookieRemovalInfo(cookie);
        const details: Cookies.RemoveDetailsType = {
            name: cookie.name,
            url: removalInfo.url,
            storeId: cookie.storeId,
        };
        if (this.supportsFirstPartyIsolation) details.firstPartyDomain = cookie.firstPartyDomain;

        const result = await browser.cookies.remove(details);
        messageUtil.sendSelf("cookieRemoved", removalInfo.removedFrom);
        return result;
    };

    public parseSetCookieHeader(header: string, fallbackDomain: string): SetCookieHeader | null {
        try {
            const parts = header.split(";");
            const kv = parts[0].split(keyValueRegexpSplit);
            const domainPart = parts.find((part, i) => i > 0 && cookieDomainRegexp.test(part.trim()));
            const domain = domainPart?.split("=")[1].trim();
            // fixme: get first party domain?
            return {
                name: kv[0].trim(),
                value: kv[1].trim(),
                domain: domain || fallbackDomain,
            };
        } catch (e) {
            return null;
        }
    }
}
