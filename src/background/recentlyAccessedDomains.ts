import { singleton } from "tsyringe";
import { browser, Cookies, WebRequest } from "webextension-polyfill-ts";

import { CookieDomainInfo, DomainAndStore } from "../shared/types";
import { getBadgeForCleanupType } from "../shared/badges";
import { someItemsMatch } from "./backgroundShared";
import { Settings } from "../shared/settings";
import { IncognitoWatcher } from "./incognitoWatcher";
import { removeLeadingDot, getValidHostname } from "../shared/domainUtils";
import { MessageUtil } from "../shared/messageUtil";
import { StoreUtils } from "../shared/storeUtils";
import { RuleManager } from "../shared/ruleManager";

const APPLY_SETTINGS_KEYS = ["logRAD.enabled", "logRAD.limit"];
const UPDATE_SETTINGS_KEYS = ["fallbackRule", "rules", "whitelistNoTLD", "whitelistFileSystem"];
const WEB_REQUEST_FILTER: WebRequest.RequestFilter = { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] };

@singleton()
export class RecentlyAccessedDomains {
    private enabled = false;

    private limit = 0;

    private log: DomainAndStore[] = [];

    private readonly defaultCookieStoreId: string;

    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly incognitoWatcher: IncognitoWatcher,
        storeUtils: StoreUtils,
        messageUtil: MessageUtil
    ) {
        this.defaultCookieStoreId = storeUtils.defaultCookieStoreId;
        messageUtil.getRecentlyAccessedDomains.receive(() => {
            messageUtil.onRecentlyAccessedDomains.send(this.get());
        });
        messageUtil.settingsChanged.receive((changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, APPLY_SETTINGS_KEYS)) {
                this.applySettings();
                messageUtil.onRecentlyAccessedDomains.send(this.get());
            } else if (someItemsMatch(changedKeys, UPDATE_SETTINGS_KEYS)) {
                messageUtil.onRecentlyAccessedDomains.send(this.get());
            }
        });
        this.applySettings();
    }

    private addListeners() {
        browser.webRequest.onHeadersReceived.addListener(this.onHeadersReceived, WEB_REQUEST_FILTER);
        browser.cookies.onChanged.addListener(this.onCookieChanged);
    }

    private removeListeners() {
        browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
        browser.cookies.onChanged.removeListener(this.onCookieChanged);
    }

    public isEnabled() {
        return this.enabled;
    }

    public getLimit() {
        return this.limit;
    }

    private applySettings = () => {
        const enabled = this.settings.get("logRAD.enabled");
        if (this.enabled !== enabled) {
            this.enabled = enabled;
            if (this.enabled) this.addListeners();
            else this.removeListeners();
        }
        this.limit = this.settings.get("logRAD.limit");
        this.applyLimit();
    };

    private applyLimit() {
        const limit = this.enabled && this.limit > 0 ? this.limit : 0;
        if (this.log.length > limit) this.log.length = limit;
    }

    private get() {
        const result: CookieDomainInfo[] = [];
        for (const entry of this.log) {
            const badge = getBadgeForCleanupType(
                this.ruleManager.getCleanupTypeFor(entry.domain, entry.storeId, false)
            );
            if (badge) {
                result.push({
                    ...entry,
                    className: badge.className,
                    i18nBadge: badge.i18nBadge,
                    i18nButton: badge.i18nButton,
                });
            }
        }
        return result;
    }

    private add(domain: string, storeId: string) {
        if (this.enabled && domain) {
            const index = this.log.findIndex((entry) => entry.domain === domain && entry.storeId === storeId);
            if (index !== 0) {
                if (index !== -1) this.log.splice(index, 1);
                this.log.unshift({
                    domain,
                    storeId,
                });
                this.applyLimit();
            }
        }
    }

    private onCookieChanged = (changeInfo: Cookies.OnChangedChangeInfoType) => {
        if (!changeInfo.removed && !this.incognitoWatcher.hasCookieStore(changeInfo.cookie.storeId)) {
            const { domain } = changeInfo.cookie;
            this.add(removeLeadingDot(domain), changeInfo.cookie.storeId);
        }
    };

    private onHeadersReceived = (details: WebRequest.OnHeadersReceivedDetailsType) => {
        if (details.tabId >= 0 && !details.incognito && !this.incognitoWatcher.hasTab(details.tabId))
            this.add(getValidHostname(details.url), details.cookieStoreId || this.defaultCookieStoreId);
    };
}
