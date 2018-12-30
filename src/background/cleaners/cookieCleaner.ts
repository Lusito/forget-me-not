/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, Cookies, browser } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getAllCookieStoreIds, getFirstPartyCookieDomain } from "../backgroundHelpers";
import { settings } from "../../lib/settings";
import DelayedExecution from "../../lib/delayedExecution";
import { TabWatcher } from "../tabWatcher";
import { CleanupType } from "../../lib/settingsSignature";
import { getDomain } from "tldjs";
import { isNodeTest, isFirefox, browserInfo } from "../../lib/browserInfo";
import { messageUtil } from "../../lib/messageUtil";
import { IncognitoWatcher } from "../incognitoWatcher";

const supportsFirstPartyIsolation = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 59;

function getCookieRemovalInfo(cookie: Cookies.Cookie) {
    if (cookie.domain.length === 0) {
        return {
            url: `file://${cookie.path}`,
            removedFrom: cookie.path
        };
    }
    const allowSubDomains = cookie.domain.startsWith(".");
    const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
    return {
        url: (cookie.secure ? "https://" : "http://") + rawDomain + cookie.path,
        removedFrom: rawDomain
    };
}

export function removeCookie(cookie: Cookies.Cookie) {
    const removalInfo = getCookieRemovalInfo(cookie);
    const details: Cookies.RemoveDetailsType = {
        name: cookie.name,
        url: removalInfo.url,
        storeId: cookie.storeId
    };
    if (supportsFirstPartyIsolation)
        details.firstPartyDomain = cookie.firstPartyDomain;

    const promise = browser.cookies.remove(details);
    messageUtil.sendSelf("cookieRemoved", removalInfo.removedFrom);
    return promise;
}

export class CookieCleaner extends Cleaner {
    private readonly snoozedThirdpartyCookies: Cookies.Cookie[] = [];
    private readonly tabWatcher: TabWatcher;
    private readonly incognitoWatcher: IncognitoWatcher;

    public constructor(tabWatcher: TabWatcher, incognitoWatcher: IncognitoWatcher) {
        super();
        this.tabWatcher = tabWatcher;
        this.incognitoWatcher = incognitoWatcher;

        browser.cookies.onChanged.addListener(this.onCookieChanged.bind(this));
    }

    public clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.cookies && settings.get(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules")) {
            typeSet.cookies = false;
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            this.cleanCookiesWithRulesNow(startup, protectOpenDomains);
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
        const domainFP = getDomain(domain) || domain;
        this.removeCookies(storeId, (cookie) => {
            if (this.shouldPurgeExpiredCookie(cookie))
                return true;
            const match = cookie.firstPartyDomain ? cookie.firstPartyDomain === domainFP : getFirstPartyCookieDomain(cookie.domain) === domainFP;
            return match && (ignoreRules || !this.isCookieAllowed(cookie, false, true, true));
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
                this.removeCookies(id, (cookie) => this.shouldPurgeExpiredCookie(cookie) || !this.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains, true));
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
        if (!changeInfo.removed && !this.incognitoWatcher.hasCookieStore(changeInfo.cookie.storeId)) {
            // Cookies set by javascript can't be denied, but can be removed instantly.
            if (this.shouldRemoveCookieInstantly(changeInfo.cookie))
                removeCookie(changeInfo.cookie);
            else if (settings.get("cleanThirdPartyCookies.enabled"))
                this.removeCookieIfThirdparty(changeInfo.cookie);
        }
    }

    private removeCookieIfThirdparty(cookie: Cookies.Cookie) {
        if (!this.incognitoWatcher.hasCookieStore(cookie.storeId) && this.isThirdpartyCookie(cookie)) {
            if (this.snoozing) {
                this.snoozedThirdpartyCookies.push(cookie);
                return;
            }
            const exec = new DelayedExecution(() => {
                if (this.snoozing) {
                    this.snoozedThirdpartyCookies.push(cookie);
                    return;
                }
                if (this.isThirdpartyCookie(cookie) && !this.isCookieAllowed(cookie, false, false, false))
                    removeCookie(cookie);
            });
            exec.restart(settings.get("cleanThirdPartyCookies.delay") * 1000);
        }
    }

    private isThirdpartyCookie(cookie: Cookies.Cookie) {
        const firstPartyDomain = getFirstPartyCookieDomain(cookie.domain);
        if (cookie.firstPartyDomain)
            return cookie.firstPartyDomain !== firstPartyDomain;
        return !this.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, false);
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

    public isCookieAllowed(cookie: Cookies.Cookie, ignoreStartupType: boolean, protectOpenDomains: boolean, protectSubFrames: boolean) {
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        const type = settings.getCleanupTypeForCookie(rawDomain, cookie.name);
        if (type === CleanupType.NEVER || (type === CleanupType.STARTUP && !ignoreStartupType))
            return true;
        if (type === CleanupType.INSTANTLY || !protectOpenDomains)
            return false;
        if (cookie.firstPartyDomain)
            return this.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, cookie.firstPartyDomain, protectSubFrames);
        const firstPartyDomain = getDomain(rawDomain) || rawDomain;
        return this.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, protectSubFrames);
    }
}
