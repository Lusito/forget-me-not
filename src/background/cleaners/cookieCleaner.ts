/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, Cookies, browser } from "webextension-polyfill-ts";
import { getDomain } from "tldjs";

import { Cleaner } from "./cleaner";
import { CleanupType } from "../../lib/shared";
import { ExtensionBackgroundContext } from "../backgroundShared";

export class CookieCleaner extends Cleaner {
    private readonly context: ExtensionBackgroundContext;

    private readonly snoozedThirdpartyCookies: Cookies.Cookie[] = [];

    private readonly snoozedInstantlyCookies: Cookies.Cookie[] = [];

    public constructor(context: ExtensionBackgroundContext) {
        super();
        this.context = context;

        browser.cookies.onChanged.addListener(this.onCookieChanged);
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (
            typeSet.cookies &&
            this.context.settings.get(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules")
        ) {
            typeSet.cookies = false;
            const protectOpenDomains = startup || this.context.settings.get("cleanAll.protectOpenDomains");
            await this.cleanCookiesWithRulesNow(startup, protectOpenDomains);
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        const { settings } = this.context;
        if (settings.get("domainLeave.enabled") && settings.get("domainLeave.cookies"))
            await this.cleanDomainInternal(storeId, domain, false);
    }

    public async cleanDomain(storeId: string, domain: string) {
        await this.cleanDomainInternal(storeId, domain, true);
    }

    private async cleanDomainInternal(storeId: string, domain: string, ignoreRules: boolean) {
        const domainFP = getDomain(domain) || domain;
        await this.removeCookies(storeId, (cookie) => {
            if (this.shouldPurgeExpiredCookie(cookie)) return true;
            const match = cookie.firstPartyDomain
                ? cookie.firstPartyDomain === domainFP
                : this.context.domainUtils.getFirstPartyCookieDomain(cookie.domain) === domainFP;
            return match && (ignoreRules || !this.isCookieAllowed(cookie, false, true, true));
        });
    }

    public async setSnoozing(snoozing: boolean) {
        await super.setSnoozing(snoozing);
        if (!snoozing) {
            const promise1 = Promise.all(
                this.snoozedThirdpartyCookies.map((cookie) => this.removeCookieIfThirdparty(cookie))
            );
            this.snoozedThirdpartyCookies.length = 0;

            const promise2 = Promise.all(
                this.snoozedInstantlyCookies
                    .filter(
                        (cookie) =>
                            this.shouldRemoveCookieInstantly(cookie) ||
                            this.shouldRemoveThirdPartyCookieInstantly(cookie)
                    )
                    .map(this.context.cookieUtils.removeCookie)
            );
            this.snoozedInstantlyCookies.length = 0;

            await Promise.all([promise1, promise2]);
        }
    }

    private async cleanCookiesWithRulesNow(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const ids = await this.context.storeUtils.getAllCookieStoreIds();
        const test = (cookie: Cookies.Cookie) =>
            this.shouldPurgeExpiredCookie(cookie) ||
            !this.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains, true);
        await Promise.all(ids.map((id) => this.removeCookies(id, test)));
    }

    private shouldRemoveThirdPartyCookieInstantly(cookie: Cookies.Cookie) {
        const { settings, incognitoWatcher } = this.context;
        return (
            settings.get("cleanThirdPartyCookies.beforeCreation") &&
            !incognitoWatcher.hasCookieStore(cookie.storeId) &&
            this.isThirdpartyCookie(cookie)
        );
    }

    private shouldRemoveCookieInstantly(cookie: Cookies.Cookie) {
        // Special case if snoozing: needs to be added to this.snoozedInstantlyCookies
        if (this.snoozing && this.shouldRemoveThirdPartyCookieInstantly(cookie)) return true;

        const { settings } = this.context;
        if (!settings.get("instantly.enabled") || !settings.get("instantly.cookies")) return false;
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        return settings.getCleanupTypeForCookie(rawDomain, cookie.name) === CleanupType.INSTANTLY;
    }

    private onCookieChanged = (changeInfo: Cookies.OnChangedChangeInfoType) => {
        const { settings, incognitoWatcher } = this.context;
        if (!changeInfo.removed && !incognitoWatcher.hasCookieStore(changeInfo.cookie.storeId)) {
            // Cookies set by javascript can't be denied, but can be removed instantly.
            if (this.shouldRemoveCookieInstantly(changeInfo.cookie)) {
                if (this.snoozing) this.snoozedInstantlyCookies.push(changeInfo.cookie);
                else this.context.cookieUtils.removeCookie(changeInfo.cookie);
            } else if (settings.get("cleanThirdPartyCookies.enabled")) this.removeCookieIfThirdparty(changeInfo.cookie);
        }
    };

    private async removeCookieIfThirdparty(cookie: Cookies.Cookie) {
        const { settings, incognitoWatcher } = this.context;
        if (!incognitoWatcher.hasCookieStore(cookie.storeId) && this.isThirdpartyCookie(cookie)) {
            if (this.snoozing) {
                this.snoozedThirdpartyCookies.push(cookie);
                return;
            }

            const removeFn = async () => {
                if (this.snoozing) {
                    this.snoozedThirdpartyCookies.push(cookie);
                    return;
                }
                if (this.isThirdpartyCookie(cookie) && !this.isCookieAllowed(cookie, false, false, false))
                    await this.context.cookieUtils.removeCookie(cookie);
            };
            const delay = settings.get("cleanThirdPartyCookies.delay") * 1000;
            if (delay)
                setTimeout(() => {
                    removeFn();
                }, delay);
            else await removeFn();
        }
    }

    private isThirdpartyCookie(cookie: Cookies.Cookie) {
        const firstPartyDomain = this.context.domainUtils.getFirstPartyCookieDomain(cookie.domain);
        if (cookie.firstPartyDomain) return cookie.firstPartyDomain !== firstPartyDomain;
        return !this.context.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, false);
    }

    private async removeCookies(storeId: string, test: (cookie: Cookies.Cookie) => boolean) {
        const details: Cookies.GetAllDetailsType = { storeId };
        if (this.context.supports.firstPartyIsolation) details.firstPartyDomain = null;

        const cookies = await browser.cookies.getAll(details);
        await Promise.all(cookies.filter(test).map(this.context.cookieUtils.removeCookie));
    }

    private shouldPurgeExpiredCookie(cookie: Cookies.Cookie) {
        return (
            (this.context.settings.get("purgeExpiredCookies") &&
                cookie.expirationDate &&
                cookie.expirationDate < Date.now() / 1000) ||
            false
        );
    }

    public isCookieAllowed(
        cookie: Cookies.Cookie,
        ignoreStartupType: boolean,
        protectOpenDomains: boolean,
        protectSubFrames: boolean
    ) {
        const { settings, tabWatcher } = this.context;
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        const type = settings.getCleanupTypeForCookie(rawDomain, cookie.name);
        if (type === CleanupType.NEVER || (type === CleanupType.STARTUP && !ignoreStartupType)) return true;
        if (type === CleanupType.INSTANTLY || !protectOpenDomains) return false;
        if (cookie.firstPartyDomain)
            return tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, cookie.firstPartyDomain, protectSubFrames);
        const firstPartyDomain = getDomain(rawDomain) || rawDomain;
        return tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, protectSubFrames);
    }
}
