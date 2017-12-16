/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { settings } from "../lib/settings";
import { badges, removeCookie, cleanLocalStorage, removeLocalStorageByHostname, getBadgeForDomain } from './backgroundShared';

export class CleanStore {
    private readonly id: string;
    private currentDomains: string[] = [];
    private newDomains: string[] = [];

    public constructor(id: string) {
        this.id = id;
    }

    public prepareNewDomains() {
        this.newDomains = [];
    }

    public addNewDomain(domain: string) {
        if (this.newDomains.indexOf(domain) === -1)
            this.newDomains.push(domain);
    }

    public finishNewDomains() {
        var oldDomains = this.currentDomains;
        this.currentDomains = this.newDomains;
        this.newDomains = [];

        const removed = oldDomains.filter((domain) => this.currentDomains.indexOf(domain) === -1);
        const added = this.currentDomains.filter((domain) => oldDomains.indexOf(domain) === -1);
        if (removed.length)
            this.onDomainsRemoved(removed);
        if (added.length)
            this.onDomainsAdded(added);
        return {
        };
    }

    public isActiveDomain(domain: string) {
        this.currentDomains.indexOf(domain) !== -1
    }


    public cleanCookiesByDomain(domain: string, ignoreRules?: boolean) {
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

    public cleanByDomainWithRulesNow(domain: string) {
        if (!settings.get('domainLeave.enabled') || this.isDomainProtected(domain, false))
            return;

        if (settings.get('domainLeave.cookies'))
            this.cleanCookiesByDomain(domain);

        if (settings.get('domainLeave.localStorage'))
            cleanLocalStorage([domain], this.id);
    }

    public isDomainProtected(domain: string, ignoreGrayList: boolean): boolean {
        if (this.currentDomains.indexOf(domain) !== -1)
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
        if (allowSubDomains) {
            for (const otherDomain of this.currentDomains) {
                if (otherDomain.endsWith(domain))
                    return true;
            }
        }
        return false;
    }

    public cleanUrlNow(hostname: string) {
        cleanLocalStorage([hostname], this.id);
        this.cleanCookiesByDomain(hostname, true);
    }

    private onDomainsRemoved(removedDomains: string[]) {
        let timeout = settings.get('domainLeave.delay') * 60 * 1000;
        if (timeout <= 0) {
            for (let domain of removedDomains)
                this.cleanByDomainWithRulesNow(domain);
        } else {
            setTimeout(() => {
                for (let domain of removedDomains)
                    this.cleanByDomainWithRulesNow(domain);
            }, timeout);
        }
    }

    private onDomainsAdded(addedDomains: string[]) {
        if (removeLocalStorageByHostname) {
            let domainsToClean = { ...settings.get('domainsToClean') };
            for (const domain of addedDomains)
                domainsToClean[domain] = true;
            settings.set('domainsToClean', domainsToClean);
            settings.save();
        }
    }
}
