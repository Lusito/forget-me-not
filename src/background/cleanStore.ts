/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { cleanLocalStorage, removeCookie } from "./backgroundShared";
import { TabWatcher } from "./tabWatcher";
import { browser, Cookies } from "webextension-polyfill-ts";
import { isFirefox, browserInfo, isNodeTest } from "../lib/browserInfo";
import { getFirstPartyCookieDomain } from "./backgroundHelpers";
import { RuleType } from "../lib/settingsSignature";
import { getDomain } from "tldjs";

const supportsFirstPartyIsolation = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 59;

export class CleanStore {
    private readonly tabWatcher: TabWatcher;
    private readonly id: string;

    public constructor(id: string, tabWatcher: TabWatcher) {
        this.id = id;
        this.tabWatcher = tabWatcher;
    }

    private cleanCookiesByDomain(domain: string, ignoreRules: boolean) {
        this.removeCookies((cookie) => {
            if (this.shouldPurgeExpiredCookie(cookie))
                return true;
            const domainFP = getDomain(domain) || domain;
            const match = cookie.firstPartyDomain ? cookie.firstPartyDomain === domainFP : getFirstPartyCookieDomain(cookie.domain) === domainFP;
            return match && (ignoreRules || !this.isCookieAllowed(cookie, false, true));
        });
    }

    public cleanCookiesWithRules(ignoreGrayList: boolean, protectOpenDomains: boolean) {
        this.removeCookies((cookie) => this.shouldPurgeExpiredCookie(cookie) || !this.isCookieAllowed(cookie, ignoreGrayList, protectOpenDomains));
    }

    private removeCookies(test: (cookie: Cookies.Cookie) => boolean) {
        const details: Cookies.GetAllDetailsType = { storeId: this.id };
        if (supportsFirstPartyIsolation)
            details.firstPartyDomain = null;

        browser.cookies.getAll(details).then((cookies) => {
            for (const cookie of cookies) {
                if (test(cookie))
                    removeCookie(cookie);
            }
        });
    }

    public cleanByDomainWithRules(domain: string) {
        if (settings.get("domainLeave.enabled")) {
            if (settings.get("domainLeave.cookies"))
                this.cleanCookiesByDomain(domain, false);

            if (settings.get("domainLeave.localStorage") && !this.isLocalStorageProtected(domain))
                cleanLocalStorage([domain], this.id);
        }
    }

    public isLocalStorageProtected(domain: string): boolean {
        if (this.tabWatcher.cookieStoreContainsDomain(this.id, domain))
            return true;
        const type = settings.getRuleTypeForDomain(domain);
        return type === RuleType.WHITE || type === RuleType.GRAY;
    }

    private shouldPurgeExpiredCookie(cookie: Cookies.Cookie) {
        return settings.get("purgeExpiredCookies") && cookie.expirationDate && cookie.expirationDate < Date.now() / 1000;
    }

    public isCookieAllowed(cookie: Cookies.Cookie, ignoreGrayList: boolean, protectOpenDomains: boolean) {
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        const type = settings.getRuleTypeForCookie(rawDomain, cookie.name);
        if (type === RuleType.WHITE || (type === RuleType.GRAY && !ignoreGrayList))
            return true;
        if (type === RuleType.BLOCK || !protectOpenDomains)
            return false;
        if (cookie.firstPartyDomain)
            return this.tabWatcher.isFirstPartyDomainOnCookieStore(this.id, cookie.firstPartyDomain);
        const firstPartyDomain = getFirstPartyCookieDomain(cookie.domain);
        return this.tabWatcher.isFirstPartyDomainOnCookieStore(this.id, firstPartyDomain);
    }

    public cleanDomainNow(hostname: string) {
        cleanLocalStorage([hostname], this.id);
        this.cleanCookiesByDomain(hostname, true);
    }
}
