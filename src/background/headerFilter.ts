/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { singleton } from "tsyringe";
import { browser, WebRequest } from "webextension-polyfill-ts";

import { SettingsKey } from "../shared/defaultSettings";
import { CleanupType } from "../shared/types";
import { someItemsMatch } from "./backgroundShared";
import { Settings } from "../shared/settings";
import { IncognitoWatcher } from "./incognitoWatcher";
import { DomainUtils } from "../shared/domainUtils";
import { TabWatcher } from "./tabWatcher";
import { CookieUtils } from "./cookieUtils";
import { SupportsInfo } from "../shared/supportsInfo";
import { MessageUtil } from "../shared/messageUtil";
import { SnoozeManager } from "./snoozeManager";

const LISTENER_OPTIONS: WebRequest.OnHeadersReceivedOptions[] = ["responseHeaders", "blocking"];
const HEADER_FILTER_SETTINGS_KEYS: SettingsKey[] = [
    "cleanThirdPartyCookies.beforeCreation",
    "rules",
    "fallbackRule",
    "instantly.enabled",
];

@singleton()
export class HeaderFilter {
    private filter: WebRequest.RequestFilter = { urls: ["<all_urls>"] };

    private blockThirdpartyCookies = false;

    public constructor(
        private readonly settings: Settings,
        private readonly incognitoWatcher: IncognitoWatcher,
        private readonly tabWatcher: TabWatcher,
        private readonly domainUtils: DomainUtils,
        private readonly cookieUtils: CookieUtils,
        private readonly messageUtil: MessageUtil,
        private readonly snoozeManager: SnoozeManager,
        private readonly supports: SupportsInfo
    ) {}

    public init() {
        if (this.supports.requestFilterIncognito) this.filter.incognito = false;
        this.updateSettings();
        this.messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, HEADER_FILTER_SETTINGS_KEYS)) this.updateSettings();
        });
        this.snoozeManager.listeners.add(() => this.updateSettings());
    }

    private onHeadersReceived = (details: WebRequest.OnHeadersReceivedDetailsType): WebRequest.BlockingResponse => {
        if (details.responseHeaders && (details.incognito === false || !this.incognitoWatcher.hasTab(details.tabId))) {
            return {
                responseHeaders: this.filterResponseHeaders(
                    details.responseHeaders,
                    this.domainUtils.getValidHostname(details.url),
                    details.tabId
                ),
            };
        }
        return {};
    };

    private shouldCookieBeBlocked(tabId: number, domain: string, name: string) {
        const type = this.settings.getCleanupTypeForCookie(domain, name);
        if (type === CleanupType.NEVER || type === CleanupType.STARTUP) return false;
        return (
            type === CleanupType.INSTANTLY ||
            (this.blockThirdpartyCookies && this.tabWatcher.isThirdPartyCookieOnTab(tabId, domain))
        );
    }

    private filterResponseHeaders(
        responseHeaders: WebRequest.HttpHeaders,
        fallbackDomain: string,
        tabId: number
    ): WebRequest.HttpHeaders {
        return responseHeaders.filter((x) => {
            if (x.value && x.name.toLowerCase() === "set-cookie") {
                const filtered = x.value.split("\n").filter((value) => {
                    const cookieInfo = this.cookieUtils.parseSetCookieHeader(value.trim(), fallbackDomain);
                    if (cookieInfo) {
                        const domain = this.domainUtils.removeLeadingDot(cookieInfo.domain);
                        if (this.shouldCookieBeBlocked(tabId, domain, cookieInfo.name)) {
                            this.messageUtil.sendSelf("cookieRemoved", domain);
                            return false;
                        }
                    }
                    return true;
                });

                if (filtered.length === 0) return false;
                x.value = filtered.join("\n");
            }
            return true;
        });
    }

    private updateSettings() {
        if (this.snoozeManager.isSnoozing()) this.setEnabled(false);
        else {
            this.blockThirdpartyCookies = this.settings.get("cleanThirdPartyCookies.beforeCreation");

            if (this.blockThirdpartyCookies) this.setEnabled(true);
            else this.setEnabled(this.settings.get("instantly.enabled") && this.settings.hasBlockingRule());
        }
    }

    private isEnabled() {
        return browser.webRequest.onHeadersReceived.hasListener(this.onHeadersReceived);
    }

    private setEnabled(enabled: boolean) {
        if (enabled !== this.isEnabled()) {
            const { onHeadersReceived } = browser.webRequest;
            if (enabled) onHeadersReceived.addListener(this.onHeadersReceived, this.filter, LISTENER_OPTIONS);
            else onHeadersReceived.removeListener(this.onHeadersReceived);
        }
    }
}
