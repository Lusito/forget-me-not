/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { badges, removeCookie, cleanLocalStorage, getBadgeForDomain } from './backgroundShared';
import { TabWatcher } from './tabWatcher';
import { browser } from "../browser/browser";
import { Cookies } from "../browser/cookies";
import { isFirefox, browserInfo } from "../lib/browserInfo";

export class CleanStore {
    private readonly tabWatcher: TabWatcher;
    private readonly id: string;

    public constructor(id: string, tabWatcher: TabWatcher) {
        this.id = id;
        this.tabWatcher = tabWatcher;
    }

    private cleanCookiesByDomain(domain: string, ignoreRules?: boolean) {
        this.removeCookies((cookie) =>  {
            let allowSubDomains = cookie.domain.startsWith('.');
            let match = allowSubDomains ? domain.endsWith(cookie.domain) : (domain === cookie.domain);
            return match && (ignoreRules || !this.isCookieAllowed(cookie, false));
        });
    }

    public cleanCookiesWithRulesNow(ignoreGrayList: boolean) {
        this.removeCookies((cookie) => !this.isCookieAllowed(cookie, ignoreGrayList));
    }

    private removeCookies(test: (cookie: Cookies.Cookie) => boolean) {
        const details: Cookies.GetAllDetails = { storeId: this.id };
        if (isFirefox && browserInfo.versionAsNumber >= 59)
            details.firstPartyDomain = null;
        browser.cookies.getAll(details).then((cookies) => {
            for (const cookie of cookies) {
                if (test(cookie))
                    removeCookie(cookie);
            }
        });
    }

    private cleanByDomainWithRulesNow(domain: string) {
        if (!settings.get('domainLeave.enabled') || this.isDomainProtected(domain, false))
            return;

        if (settings.get('domainLeave.cookies'))
            this.cleanCookiesByDomain(domain);

        if (settings.get('domainLeave.localStorage'))
            cleanLocalStorage([domain], this.id);
    }

    private isDomainProtected(domain: string, ignoreGrayList: boolean): boolean {
        if (this.tabWatcher.cookieStoreContainsDomain(this.id, domain))
            return true;
        let badge = getBadgeForDomain(domain);
        if (ignoreGrayList)
            return badge === badges.white;
        return badge !== badges.none && badge !== badges.forget;
    }

    public isCookieAllowed(cookie: Cookies.Cookie, ignoreGrayList: boolean) {
        let allowSubDomains = cookie.domain.startsWith('.');
        let rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        if (this.isDomainProtected(rawDomain, ignoreGrayList))
            return true;
        return this.tabWatcher.cookieStoreContainsSubDomain(this.id, cookie.domain);
    }

    public cleanUrlNow(hostname: string) {
        cleanLocalStorage([hostname], this.id);
        this.cleanCookiesByDomain(hostname, true);
    }

    public onDomainLeave(removedDomain: string) {
        let timeout = settings.get('domainLeave.delay') * 60 * 1000;
        if (timeout <= 0) {
            this.cleanByDomainWithRulesNow(removedDomain);
        } else {
            setTimeout(() => {
                this.cleanByDomainWithRulesNow(removedDomain);
            }, timeout);
        }
    }
}
