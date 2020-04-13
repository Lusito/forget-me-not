/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, Cookies, browser } from "webextension-polyfill-ts";
import { getDomain } from "tldjs";

import { Cleaner } from "./cleaner";
import { getAllCookieStoreIds, getFirstPartyCookieDomain } from "../backgroundHelpers";
import { settings } from "../../lib/settings";
import { TabWatcher } from "../tabWatcher";
import { CleanupType } from "../../lib/settingsSignature";
import { isNodeTest, isFirefox, browserInfo } from "../../lib/browserInfo";
import { messageUtil } from "../../lib/messageUtil";
import { IncognitoWatcher } from "../incognitoWatcher";

const supportsFirstPartyIsolation = isNodeTest || (isFirefox && browserInfo.versionAsNumber >= 59);

function getCookieRemovalInfo(cookie: Cookies.Cookie) {
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

export async function removeCookie(cookie: Cookies.Cookie) {
    const removalInfo = getCookieRemovalInfo(cookie);
    const details: Cookies.RemoveDetailsType = {
        name: cookie.name,
        url: removalInfo.url,
        storeId: cookie.storeId,
    };
    if (supportsFirstPartyIsolation) details.firstPartyDomain = cookie.firstPartyDomain;

    const result = await browser.cookies.remove(details);
    messageUtil.sendSelf("cookieRemoved", removalInfo.removedFrom);
    return result;
}

export class CookieCleaner extends Cleaner {
    private readonly snoozedThirdpartyCookies: Cookies.Cookie[] = [];

    private readonly snoozedInstantlyCookies: Cookies.Cookie[] = [];

    private readonly tabWatcher: TabWatcher;

    private readonly incognitoWatcher: IncognitoWatcher;

    public constructor(tabWatcher: TabWatcher, incognitoWatcher: IncognitoWatcher) {
        super();
        this.tabWatcher = tabWatcher;
        this.incognitoWatcher = incognitoWatcher;

        browser.cookies.onChanged.addListener(this.onCookieChanged);
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.cookies && settings.get(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules")) {
            typeSet.cookies = false;
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            await this.cleanCookiesWithRulesNow(startup, protectOpenDomains);
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
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
                : getFirstPartyCookieDomain(cookie.domain) === domainFP;
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
                    .map(removeCookie)
            );
            this.snoozedInstantlyCookies.length = 0;

            await Promise.all([promise1, promise2]);
        }
    }

    private async cleanCookiesWithRulesNow(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const ids = await getAllCookieStoreIds();
        const test = (cookie: Cookies.Cookie): boolean =>
            this.shouldPurgeExpiredCookie(cookie) ||
            !this.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains, true);
        await Promise.all(ids.map((id) => this.removeCookies(id, test)));
    }

    private shouldRemoveThirdPartyCookieInstantly(cookie: Cookies.Cookie) {
        return (
            settings.get("cleanThirdPartyCookies.beforeCreation") &&
            !this.incognitoWatcher.hasCookieStore(cookie.storeId) &&
            this.isThirdpartyCookie(cookie)
        );
    }

    private shouldRemoveCookieInstantly(cookie: Cookies.Cookie) {
        // Special case if snoozing: needs to be added to this.snoozedInstantlyCookies
        if (this.snoozing && this.shouldRemoveThirdPartyCookieInstantly(cookie)) return true;

        if (!settings.get("instantly.enabled") || !settings.get("instantly.cookies")) return false;
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        return settings.getCleanupTypeForCookie(rawDomain, cookie.name) === CleanupType.INSTANTLY;
    }

    private onCookieChanged = (changeInfo: Cookies.OnChangedChangeInfoType) => {
        if (!changeInfo.removed && !this.incognitoWatcher.hasCookieStore(changeInfo.cookie.storeId)) {
            // Cookies set by javascript can't be denied, but can be removed instantly.
            if (this.shouldRemoveCookieInstantly(changeInfo.cookie)) {
                if (this.snoozing) this.snoozedInstantlyCookies.push(changeInfo.cookie);
                else removeCookie(changeInfo.cookie);
            } else if (settings.get("cleanThirdPartyCookies.enabled")) this.removeCookieIfThirdparty(changeInfo.cookie);
        }
    };

    private async removeCookieIfThirdparty(cookie: Cookies.Cookie) {
        if (!this.incognitoWatcher.hasCookieStore(cookie.storeId) && this.isThirdpartyCookie(cookie)) {
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
                    await removeCookie(cookie);
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
        const firstPartyDomain = getFirstPartyCookieDomain(cookie.domain);
        if (cookie.firstPartyDomain) return cookie.firstPartyDomain !== firstPartyDomain;
        return !this.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, false);
    }

    private async removeCookies(storeId: string, test: (cookie: Cookies.Cookie) => boolean) {
        const details: Cookies.GetAllDetailsType = { storeId };
        if (supportsFirstPartyIsolation) details.firstPartyDomain = null;

        const cookies = await browser.cookies.getAll(details);
        await Promise.all(cookies.filter(test).map((cookie) => removeCookie(cookie)));
    }

    private shouldPurgeExpiredCookie(cookie: Cookies.Cookie) {
        return (
            (settings.get("purgeExpiredCookies") &&
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
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        const type = settings.getCleanupTypeForCookie(rawDomain, cookie.name);
        if (type === CleanupType.NEVER || (type === CleanupType.STARTUP && !ignoreStartupType)) return true;
        if (type === CleanupType.INSTANTLY || !protectOpenDomains) return false;
        if (cookie.firstPartyDomain)
            return this.tabWatcher.cookieStoreContainsDomainFP(
                cookie.storeId,
                cookie.firstPartyDomain,
                protectSubFrames
            );
        const firstPartyDomain = getDomain(rawDomain) || rawDomain;
        return this.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, protectSubFrames);
    }
}
