/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Cookies, WebRequest } from "webextension-polyfill-ts";

import { messageUtil } from "../lib/messageUtil";
import { CookieDomainInfo } from "../lib/shared";
import { getBadgeForCleanupType } from "./backgroundHelpers";
import { someItemsMatch, ExtensionBackgroundContext } from "./backgroundShared";

const APPLY_SETTINGS_KEYS = ["logRAD.enabled", "logRAD.limit"];
const UPDATE_SETTINGS_KEYS = ["fallbackRule", "rules", "whitelistNoTLD", "whitelistFileSystem"];
const WEB_REQUEST_FILTER: WebRequest.RequestFilter = { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] };

export class RecentlyAccessedDomains {
    private enabled = false;

    private limit = 0;

    private domains: string[] = [];

    private readonly context: ExtensionBackgroundContext;

    public constructor(context: ExtensionBackgroundContext) {
        this.context = context;
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
        const { settings } = this.context;
        const enabled = settings.get("logRAD.enabled");
        if (this.enabled !== enabled) {
            this.enabled = enabled;
            if (this.enabled) this.addListeners();
            else this.removeListeners();
        }
        this.limit = settings.get("logRAD.limit");
        this.applyLimit();
    };

    private applyLimit() {
        const limit = this.enabled && this.limit > 0 ? this.limit : 0;
        if (this.domains.length > limit) this.domains.length = limit;
    }

    public get() {
        const { settings } = this.context;
        const result: CookieDomainInfo[] = [];
        for (const domain of this.domains) {
            const badge = getBadgeForCleanupType(settings.getCleanupTypeForDomain(domain));
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
        if (!changeInfo.removed && !this.context.incognitoWatcher.hasCookieStore(changeInfo.cookie.storeId)) {
            let { domain } = changeInfo.cookie;
            if (domain.startsWith(".")) domain = domain.substr(1);
            this.add(domain);
        }
    };

    private onHeadersReceived = (details: WebRequest.OnHeadersReceivedDetailsType) => {
        if (details.tabId >= 0 && !details.incognito && !this.context.incognitoWatcher.hasTab(details.tabId))
            this.add(this.context.domainUtils.getValidHostname(details.url));
    };
}
