import { singleton } from "tsyringe";
import { BrowsingData, Cookies, browser } from "webextension-polyfill-ts";

import { Cleaner } from "./cleaner";
import { CleanupType } from "../../shared/types";
import { Settings } from "../../shared/settings";
import { DomainUtils } from "../../shared/domainUtils";
import { CookieUtils } from "../cookieUtils";
import { TabWatcher } from "../tabWatcher";
import { IncognitoWatcher } from "../incognitoWatcher";
import { StoreUtils } from "../../shared/storeUtils";
import { SupportsInfo } from "../../shared/supportsInfo";
import { SnoozeManager } from "../snoozeManager";
import { RuleManager } from "../../shared/ruleManager";

@singleton()
export class CookieCleaner extends Cleaner {
    private readonly snoozedThirdpartyCookies: Cookies.Cookie[] = [];

    private readonly snoozedInstantlyCookies: Cookies.Cookie[] = [];

    private snoozing: boolean;

    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly domainUtils: DomainUtils,
        private readonly cookieUtils: CookieUtils,
        private readonly tabWatcher: TabWatcher,
        private readonly incognitoWatcher: IncognitoWatcher,
        private readonly storeUtils: StoreUtils,
        private readonly supports: SupportsInfo,
        snoozeManager: SnoozeManager
    ) {
        super();

        this.snoozing = snoozeManager.isSnoozing();

        browser.cookies.onChanged.addListener((changeInfo) => {
            this.onCookieChanged(changeInfo);
        });
        snoozeManager.listeners.add((snoozing) => {
            this.setSnoozing(snoozing);
        });
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (
            typeSet.cookies &&
            this.settings.get(startup ? "startup.cookies.applyRules" : "cleanAll.cookies.applyRules")
        ) {
            typeSet.cookies = false;
            const protectOpenDomains = startup || this.settings.get("cleanAll.protectOpenDomains");
            await this.cleanCookiesWithRulesNow(startup, protectOpenDomains);
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        if (this.settings.get("domainLeave.enabled") && this.settings.get("domainLeave.cookies"))
            await this.cleanDomainInternal(storeId, domain, false);
    }

    public async cleanDomain(storeId: string, domain: string) {
        await this.cleanDomainInternal(storeId, domain, true);
    }

    private async cleanDomainInternal(storeId: string, domain: string, ignoreRules: boolean) {
        const domainFP = this.domainUtils.getFirstPartyDomain(domain);
        await this.removeCookies(storeId, (cookie) => {
            if (this.shouldPurgeExpiredCookie(cookie)) return true;
            const match = cookie.firstPartyDomain
                ? cookie.firstPartyDomain === domainFP
                : this.domainUtils.getFirstPartyCookieDomain(cookie.domain) === domainFP;
            return match && (ignoreRules || !this.isCookieAllowed(cookie, false, true, true));
        });
    }

    public async setSnoozing(snoozing: boolean) {
        this.snoozing = snoozing;
        if (!snoozing) {
            const promises: Array<Promise<any>> = [];

            this.settings.get("cleanThirdPartyCookies.enabled") &&
                promises.push(
                    Promise.all(this.snoozedThirdpartyCookies.map((cookie) => this.removeCookieIfThirdparty(cookie)))
                );
            this.snoozedThirdpartyCookies.length = 0;

            this.settings.get("cleanThirdPartyCookies.beforeCreation") &&
                promises.push(
                    Promise.all(
                        this.snoozedInstantlyCookies
                            .filter((cookie) => this.isUnwantedThirdPartyCookie(cookie))
                            .map((cookie) => this.cookieUtils.removeCookie(cookie))
                    )
                );
            this.snoozedInstantlyCookies.length = 0;

            await Promise.all(promises);
        }
    }

    private async cleanCookiesWithRulesNow(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const ids = await this.storeUtils.getAllCookieStoreIds();
        const test = (cookie: Cookies.Cookie) =>
            this.shouldPurgeExpiredCookie(cookie) ||
            !this.isCookieAllowed(cookie, ignoreStartupType, protectOpenDomains, true);
        await Promise.all(ids.map((id) => this.removeCookies(id, test)));
    }

    private isUnwantedThirdPartyCookie(cookie: Cookies.Cookie) {
        return !this.incognitoWatcher.hasCookieStore(cookie.storeId) && this.isThirdpartyCookie(cookie);
    }

    private shouldRemoveCookieInstantly(cookie: Cookies.Cookie) {
        if (!this.settings.get("instantly.enabled") || !this.settings.get("instantly.cookies")) return false;
        const rawDomain = this.domainUtils.removeLeadingDot(cookie.domain);
        return this.ruleManager.getCleanupTypeFor(rawDomain, cookie.storeId, cookie.name) === CleanupType.INSTANTLY;
    }

    private async onCookieChanged(changeInfo: Cookies.OnChangedChangeInfoType) {
        if (!changeInfo.removed && !this.incognitoWatcher.hasCookieStore(changeInfo.cookie.storeId)) {
            // Cookies set by javascript can't be denied, but can be removed instantly.
            if (this.snoozing) await this.onCookieAddedSnoozing(changeInfo.cookie);
            else await this.onCookieAddedAwake(changeInfo.cookie);
        }
    }

    private async onCookieAddedSnoozing(cookie: Cookies.Cookie) {
        // Special case if snoozing: needs to be added to the snoozed lists
        if (this.isUnwantedThirdPartyCookie(cookie)) {
            if (this.settings.get("cleanThirdPartyCookies.beforeCreation")) this.snoozedInstantlyCookies.push(cookie);
            else if (this.settings.get("cleanThirdPartyCookies.enabled")) await this.removeCookieIfThirdparty(cookie);
        }
    }

    private async onCookieAddedAwake(cookie: Cookies.Cookie) {
        if (this.shouldRemoveCookieInstantly(cookie)) this.cookieUtils.removeCookie(cookie);
        else if (this.settings.get("cleanThirdPartyCookies.enabled")) await this.removeCookieIfThirdparty(cookie);
    }

    private async removeCookieIfThirdparty(cookie: Cookies.Cookie) {
        if (this.isUnwantedThirdPartyCookie(cookie)) await this.scheduleThirdpartyCookieRemove(cookie);
    }

    private async scheduleThirdpartyCookieRemove(cookie: Cookies.Cookie) {
        if (this.snoozing) {
            this.snoozedThirdpartyCookies.push(cookie);
            return;
        }
        const removeFn = async () => {
            await this.delayedScheduleThirdpartyCookieRemove(cookie);
        };
        const delay = this.settings.get("cleanThirdPartyCookies.delay") * 1000;
        if (delay > 0)
            setTimeout(() => {
                removeFn();
            }, delay);
        else await removeFn();
    }

    private async delayedScheduleThirdpartyCookieRemove(cookie: Cookies.Cookie) {
        if (this.snoozing) this.snoozedThirdpartyCookies.push(cookie);
        else if (this.isThirdpartyCookie(cookie) && !this.isCookieAllowed(cookie, false, false, false))
            await this.cookieUtils.removeCookie(cookie);
    }

    private isThirdpartyCookie(cookie: Cookies.Cookie) {
        const firstPartyDomain = this.domainUtils.getFirstPartyCookieDomain(cookie.domain);
        if (cookie.firstPartyDomain) return cookie.firstPartyDomain !== firstPartyDomain;
        return !this.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, false);
    }

    private async removeCookies(storeId: string, test: (cookie: Cookies.Cookie) => boolean) {
        const details: Cookies.GetAllDetailsType = { storeId };
        if (this.supports.firstPartyIsolation) details.firstPartyDomain = null;

        const cookies = await browser.cookies.getAll(details);
        await Promise.all(cookies.filter(test).map((cookie) => this.cookieUtils.removeCookie(cookie)));
    }

    private shouldPurgeExpiredCookie(cookie: Cookies.Cookie) {
        return (
            (this.settings.get("purgeExpiredCookies") &&
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
        const rawDomain = this.domainUtils.removeLeadingDot(cookie.domain);
        const type = this.ruleManager.getCleanupTypeFor(rawDomain, cookie.storeId, cookie.name);
        if (type === CleanupType.NEVER || (type === CleanupType.STARTUP && !ignoreStartupType)) return true;
        if (type === CleanupType.INSTANTLY || !protectOpenDomains) return false;
        if (cookie.firstPartyDomain)
            return this.tabWatcher.cookieStoreContainsDomainFP(
                cookie.storeId,
                cookie.firstPartyDomain,
                protectSubFrames
            );
        const firstPartyDomain = this.domainUtils.getFirstPartyDomain(rawDomain);
        return this.tabWatcher.cookieStoreContainsDomainFP(cookie.storeId, firstPartyDomain, protectSubFrames);
    }
}
