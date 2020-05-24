import { singleton } from "tsyringe";
import { Cookies, browser } from "webextension-polyfill-ts";

import { SupportsInfo } from "../shared/supportsInfo";
import { MessageUtil } from "../shared/messageUtil";
import { removeLeadingDot } from "../shared/domainUtils";

const cookieDomainRegexp = /^domain=/i;
const keyValueRegexpSplit = /=(.+)/;

interface SetCookieHeader {
    name: string;
    value: string;
    domain: string;
}

@singleton()
export class CookieUtils {
    private supportsFirstPartyIsolation: boolean;

    public constructor(private readonly messageUtil: MessageUtil, supports: SupportsInfo) {
        this.supportsFirstPartyIsolation = supports.firstPartyIsolation;
    }

    private getCookieRemovalInfo(cookie: Cookies.Cookie) {
        if (cookie.domain.length === 0) {
            return {
                url: `file://${cookie.path}`,
                removedFrom: cookie.path,
            };
        }

        const rawDomain = removeLeadingDot(cookie.domain);
        return {
            url: (cookie.secure ? "https://" : "http://") + rawDomain + cookie.path,
            removedFrom: rawDomain,
        };
    }

    public async removeCookie(cookie: Cookies.Cookie) {
        const removalInfo = this.getCookieRemovalInfo(cookie);
        const details: Cookies.RemoveDetailsType = {
            name: cookie.name,
            url: removalInfo.url,
            storeId: cookie.storeId,
        };
        if (this.supportsFirstPartyIsolation) details.firstPartyDomain = cookie.firstPartyDomain;

        const result = await browser.cookies.remove(details);
        this.messageUtil.cookieRemoved.sendSelf(removalInfo.removedFrom);
        return result;
    }

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
