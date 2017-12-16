/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { settings } from "../lib/settings";
import { badges, removeCookie, cleanLocalStorage, getBadgeForDomain } from './backgroundShared';
import { TabWatcher } from './tabWatcher';

export class CleanStore {
    private readonly tabWatcher: TabWatcher;
    private readonly id: string;

    public constructor(id: string, tabWatcher: TabWatcher) {
        this.id = id;
        this.tabWatcher = tabWatcher;
    }

    private cleanCookiesByDomain(domain: string, ignoreRules?: boolean) {
        browser.cookies.getAll({ storeId: this.id }).then((cookies) => {
            for (const cookie of cookies) {
                let allowSubDomains = cookie.domain.startsWith('.');
                let match = allowSubDomains ? domain.endsWith(cookie.domain) : (domain === cookie.domain);
                if (match && (ignoreRules || !this.isCookieDomainAllowed(cookie.domain, false)))
                    removeCookie(cookie);
            }
        });
    }

    public cleanCookiesWithRulesNow(ignoreGrayList: boolean) {
        browser.cookies.getAll({ storeId: this.id }).then((cookies) => {
            for (const cookie of cookies) {
                if (!this.isCookieDomainAllowed(cookie.domain, ignoreGrayList))
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

    public isCookieDomainAllowed(domain: string, ignoreGrayList: boolean) {
        let allowSubDomains = domain.startsWith('.');
        let rawDomain = allowSubDomains ? domain.substr(1) : domain;
        if (this.isDomainProtected(rawDomain, ignoreGrayList))
            return true;
        return this.tabWatcher.cookieStoreContainsSubDomain(this.id, domain);
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
