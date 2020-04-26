/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { singleton } from "tsyringe";
import { browser, Cookies, WebRequest } from "webextension-polyfill-ts";

import { CookieDomainInfo } from "../shared/types";
import { getBadgeForCleanupType } from "../shared/badges";
import { someItemsMatch } from "./backgroundShared";
import { Settings } from "../shared/settings";
import { IncognitoWatcher } from "./incognitoWatcher";
import { DomainUtils } from "../shared/domainUtils";
import { MessageUtil } from "../shared/messageUtil";

const APPLY_SETTINGS_KEYS = ["logRAD.enabled", "logRAD.limit"];
const UPDATE_SETTINGS_KEYS = ["fallbackRule", "rules", "whitelistNoTLD", "whitelistFileSystem"];
const WEB_REQUEST_FILTER: WebRequest.RequestFilter = { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] };

@singleton()
export class RecentlyAccessedDomains {
    private enabled = false;

    private limit = 0;

    private domains: string[] = [];

    public constructor(
        private readonly settings: Settings,
        private readonly incognitoWatcher: IncognitoWatcher,
        private readonly domainUtils: DomainUtils,
        messageUtil: MessageUtil
    ) {
        messageUtil.receive("getRecentlyAccessedDomains", () => {
            messageUtil.send("onRecentlyAccessedDomains", this.get());
        });
        messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, APPLY_SETTINGS_KEYS)) {
                this.applySettings();
                messageUtil.send("onRecentlyAccessedDomains", this.get());
            } else if (someItemsMatch(changedKeys, UPDATE_SETTINGS_KEYS)) {
                messageUtil.send("onRecentlyAccessedDomains", this.get());
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
        if (this.domains.length > limit) this.domains.length = limit;
    }

    public get() {
        const result: CookieDomainInfo[] = [];
        for (const domain of this.domains) {
            const badge = getBadgeForCleanupType(this.settings.getCleanupTypeForDomain(domain));
            if (badge) {
                result.push({
                    domain,
                    className: badge.className,
                    i18nBadge: badge.i18nBadge,
                    i18nButton: badge.i18nButton,
                });
            }
        }
        return result;
    }

    public add(domain: string) {
        if (this.enabled && domain) {
            const index = this.domains.indexOf(domain);
            if (index !== 0) {
                if (index !== -1) this.domains.splice(index, 1);
                this.domains.unshift(domain);
                this.applyLimit();
            }
        }
    }

    private onCookieChanged = (changeInfo: Cookies.OnChangedChangeInfoType) => {
        if (!changeInfo.removed && !this.incognitoWatcher.hasCookieStore(changeInfo.cookie.storeId)) {
            const { domain } = changeInfo.cookie;
            this.add(this.domainUtils.removeLeadingDot(domain));
        }
    };

    private onHeadersReceived = (details: WebRequest.OnHeadersReceivedDetailsType) => {
        if (details.tabId >= 0 && !details.incognito && !this.incognitoWatcher.hasTab(details.tabId))
            this.add(this.domainUtils.getValidHostname(details.url));
    };
}
