/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, Cookies, browser } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getAllCookieStoreIds, getFirstPartyCookieDomain, runIfCookieStoreNotIncognito } from "../backgroundHelpers";
import { settings } from "../../lib/settings";
import DelayedExecution from "../../lib/delayedExecution";
import { removeCookie } from "../backgroundShared";
import { TabWatcher } from "../tabWatcher";
import { CleanupType } from "../../lib/settingsSignature";
import { RecentlyAccessedDomains } from "../recentlyAccessedDomains";
import { getDomain } from "tldjs";
import { isNodeTest, isFirefox, browserInfo } from "../../lib/browserInfo";

const supportsFirstPartyIsolation = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 59;

export class CookieCleaner extends Cleaner {
    private readonly snoozedThirdpartyCookies: Cookies.Cookie[] = [];
    private readonly tabWatcher: TabWatcher;
    private readonly recentlyAccessedDomains: RecentlyAccessedDomains;

    public constructor(tabWatcher: TabWatcher, recentlyAccessedDomains: RecentlyAccessedDomains) {
        super();
        this.tabWatcher = tabWatcher;
        this.recentlyAccessedDomains = recentlyAccessedDomains;

        browser.cookies.onChanged.addListener(this.onCookieChanged.bind(this));
    }

    public clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.cookies) {
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            if (settings.get(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules")) {
                typeSet.cookies = false;
                this.cleanCookiesWithRulesNow(startup, protectOpenDomains);
            }
        }
    }

    public cleanDomainOnLeave(storeId: string, domain: string): void {
        if (settings.get("domainLeave.enabled")) {
            if (settings.get("domainLeave.cookies"))
                this.cleanDomainInternal(storeId, domain, false);
        }
    }

    public cleanDomain(storeId: string, domain: string): void {
        this.cleanDomainInternal(storeId, domain, true);
    }

    private cleanDomainInternal(storeId: string, domain: string, ignoreRules: boolean): void {
        this.removeCookies(storeId, (cookie) => {
            if (this.shouldPurgeExpiredCookie(cookie))
                return true;
            const domainFP = getDomain(domain) || domain;
            const match = cookie.firstPartyDomain ? cookie.firstPartyDomain === domainFP : getFirstPartyCookieDomain(cookie.domain) === domainFP;
            return match && (ignoreRules || !this.isCookieAllowed(cookie, false, true));
        });
    }

    public setSnoozing(snoozing: boolean) {
        super.setSnoozing(snoozing);
        if (!snoozing) {
            for (const cookie of this.snoozedThirdpartyCookies)
                this.removeCookieIfThirdparty(cookie);
            this.snoozedThirdpartyCookies.length = 0;
        }
    }

    private cleanCookiesWithRulesNow(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        getAllCookieStoreIds().then((ids) => {
            for (const id of ids)
                this.removeCookies(id, (cookie) => this.shouldPurgeExpiredCookie(cookie) || !this.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains));
        });
    }

    private shouldRemoveCookieInstantly(cookie: Cookies.Cookie) {
        if (!settings.get("instantly.enabled") || !settings.get("instantly.cookies"))
            return false;
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        return settings.getCleanupTypeForCookie(rawDomain, cookie.name) === CleanupType.INSTANTLY;
    }

    private onCookieChanged(changeInfo: Cookies.OnChangedChangeInfoType) {
        if (!changeInfo.removed) {
            runIfCookieStoreNotIncognito(changeInfo.cookie.storeId, () => {
                this.recentlyAccessedDomains.add(changeInfo.cookie.domain);
                // Cookies set by javascript can't be denied, but can be removed instantly.
                if (this.shouldRemoveCookieInstantly(changeInfo.cookie))
                    removeCookie(changeInfo.cookie);
                else if (settings.get("cleanThirdPartyCookies.enabled"))
                    this.removeCookieIfThirdparty(changeInfo.cookie);
            });
        }
    }

    private removeCookieIfThirdparty(cookie: Cookies.Cookie) {
        if (this.isThirdpartyCookie(cookie)) {
            if (this.snoozing) {
                this.snoozedThirdpartyCookies.push(cookie);
                return;
            }
            const exec = new DelayedExecution(() => {
                if (this.snoozing) {
                    this.snoozedThirdpartyCookies.push(cookie);
                    return;
                }
                const delta = Date.now() - this.tabWatcher.getLastDomainChange(cookie.storeId);
                if (delta < 1000)
                    exec.restart(500);
                else if (this.isThirdpartyCookie(cookie))
                    removeCookie(cookie);
            });
            exec.restart(settings.get("cleanThirdPartyCookies.delay") * 60 * 1000);
        }
    }

    private isThirdpartyCookie(cookie: Cookies.Cookie) {
        const firstPartyDomain = getFirstPartyCookieDomain(cookie.domain);
        if (cookie.firstPartyDomain)
            return cookie.firstPartyDomain !== firstPartyDomain;
        return !this.tabWatcher.isFirstPartyDomainOnCookieStore(cookie.storeId, firstPartyDomain);
    }

    private removeCookies(storeId: string, test: (cookie: Cookies.Cookie) => boolean) {
        const details: Cookies.GetAllDetailsType = { storeId };
        if (supportsFirstPartyIsolation)
            details.firstPartyDomain = null;

        browser.cookies.getAll(details).then((cookies) => {
            for (const cookie of cookies) {
                if (test(cookie))
                    removeCookie(cookie);
            }
        });
    }

    private shouldPurgeExpiredCookie(cookie: Cookies.Cookie) {
        return settings.get("purgeExpiredCookies") && cookie.expirationDate && cookie.expirationDate < Date.now() / 1000;
    }

    public isCookieAllowed(cookie: Cookies.Cookie, ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        const type = settings.getCleanupTypeForCookie(rawDomain, cookie.name);
        if (type === CleanupType.NEVER || (type === CleanupType.STARTUP && !ignoreStartupType))
            return true;
        if (type === CleanupType.INSTANTLY || !protectOpenDomains)
            return false;
        if (cookie.firstPartyDomain)
            return this.tabWatcher.isFirstPartyDomainOnCookieStore(cookie.storeId, cookie.firstPartyDomain);
        const firstPartyDomain = getFirstPartyCookieDomain(cookie.domain);
        return this.tabWatcher.isFirstPartyDomainOnCookieStore(cookie.storeId, firstPartyDomain);
    }
}
