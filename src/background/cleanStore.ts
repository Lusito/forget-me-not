/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { badges, removeCookie, cleanLocalStorage, getBadgeForDomain, getBadgeForCookie } from './backgroundShared';
import { TabWatcher } from './tabWatcher';
import { browser, Cookies } from "webextension-polyfill-ts";
import { isFirefox, browserInfo } from "../lib/browserInfo";

export class CleanStore {
    private readonly tabWatcher: TabWatcher;
    private readonly id: string;
    private domainRemoveTimeouts: { [s: string]: number } = {};
    private snoozing: boolean;
    private readonly snoozedDomainLeaves: { [s: string]: boolean } = {};

    public constructor(id: string, tabWatcher: TabWatcher, snoozing: boolean) {
        this.id = id;
        this.tabWatcher = tabWatcher;
        this.snoozing = snoozing;
    }

    private cleanCookiesByDomain(domain: string, ignoreRules: boolean) {
        this.removeCookies((cookie) => {
            let allowSubDomains = cookie.domain.startsWith('.');
            let match = allowSubDomains ? (domain.endsWith(cookie.domain) || cookie.domain.substr(1) === domain) : (cookie.domain === domain);
            return match && (ignoreRules || !this.isCookieAllowed(cookie, false, true));
        });
    }

    public cleanCookiesWithRulesNow(ignoreGrayList: boolean, protectOpenDomains: boolean) {
        this.removeCookies((cookie) => !this.isCookieAllowed(cookie, ignoreGrayList, protectOpenDomains));
    }

    private removeCookies(test: (cookie: Cookies.Cookie) => boolean) {
        const details: Cookies.GetAllDetailsType = { storeId: this.id };
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
        if (settings.get('domainLeave.enabled')) {
            if (settings.get('domainLeave.cookies'))
                this.cleanCookiesByDomain(domain, false);

            if (settings.get('domainLeave.localStorage') && !this.isLocalStorageProtected(domain))
                cleanLocalStorage([domain], this.id);
        }
    }

    private isLocalStorageProtected(domain: string): boolean {
        if (this.tabWatcher.cookieStoreContainsDomain(this.id, domain))
            return true;
        let badge = getBadgeForDomain(domain);
        return badge === badges.white || (badge === badges.gray);
    }

    private isCookieProtected(domain: string, name: string, ignoreGrayList: boolean, protectOpenDomains: boolean): boolean {
        if (protectOpenDomains && this.tabWatcher.cookieStoreContainsDomain(this.id, domain))
            return true;
        let badge = getBadgeForCookie(domain, name);
        return badge === badges.white || (badge === badges.gray && !ignoreGrayList);
    }

    public isCookieAllowed(cookie: Cookies.Cookie, ignoreGrayList: boolean, protectOpenDomains: boolean) {
        let allowSubDomains = cookie.domain.startsWith('.');
        let rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        if (this.isCookieProtected(rawDomain, cookie.name, ignoreGrayList, protectOpenDomains))
            return true;
        return protectOpenDomains && this.tabWatcher.cookieStoreContainsSubDomain(this.id, cookie.domain);
    }

    public cleanUrlNow(hostname: string) {
        cleanLocalStorage([hostname], this.id);
        this.cleanCookiesByDomain(hostname, true);
    }

    public onDomainLeave(removedDomain: string) {
        if (this.domainRemoveTimeouts[removedDomain]) {
            clearTimeout(this.domainRemoveTimeouts[removedDomain]);
            delete this.domainRemoveTimeouts[removedDomain];
        }
        if (this.snoozing) {
            this.snoozedDomainLeaves[removedDomain] = true;
            return;
        }
        let timeout = settings.get('domainLeave.delay') * 60 * 1000;
        if (timeout <= 0) {
            this.cleanByDomainWithRulesNow(removedDomain);
        } else {
            this.domainRemoveTimeouts[removedDomain] = setTimeout(() => {
                if (this.snoozing)
                    this.snoozedDomainLeaves[removedDomain] = true;
                else
                    this.cleanByDomainWithRulesNow(removedDomain);
                delete this.domainRemoveTimeouts[removedDomain];
            }, timeout);
        }
    }

    public setSnoozing(snoozing: boolean) {
        this.snoozing = snoozing;
        if (snoozing) {
            // cancel countdowns and remember them for later
            for (const domain in this.domainRemoveTimeouts) {
                this.snoozedDomainLeaves[domain] = true;
                clearTimeout(this.domainRemoveTimeouts[domain]);
                delete this.domainRemoveTimeouts[domain];
            }
        } else {
            // reschedule
            for (const domain in this.snoozedDomainLeaves) {
                this.onDomainLeave(domain);
                delete this.snoozedDomainLeaves[domain];
            }
        }
    }
}
