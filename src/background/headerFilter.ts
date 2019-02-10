/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil } from "../lib/messageUtil";
import { settings } from "../lib/settings";
import { TabWatcher } from "./tabWatcher";
import { browser, WebRequest } from "webextension-polyfill-ts";
import { getValidHostname } from "../shared";
import { CleanupType, SettingsKey } from "../lib/settingsSignature";
import { parseSetCookieHeader } from "./backgroundHelpers";
import { someItemsMatch } from "./backgroundShared";

const HEADER_FILTER_SETTINGS_KEYS: SettingsKey[] = ["cleanThirdPartyCookies.beforeCreation", "rules", "fallbackRule", "instantly.enabled"];

export class HeaderFilter {
    private blockThirdpartyCookies = false;
    private readonly tabWatcher: TabWatcher;
    private readonly onHeadersReceived: (details: WebRequest.OnHeadersReceivedDetailsType) => WebRequest.BlockingResponse;

    public constructor(tabWatcher: TabWatcher) {
        this.tabWatcher = tabWatcher;
        this.onHeadersReceived = (details) => {
            if (details.responseHeaders) {
                return {
                    responseHeaders: this.filterResponseHeaders(details.responseHeaders, getValidHostname(details.url), details.tabId)
                };
            }
            return {};
        };
        this.updateSettings();
        messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, HEADER_FILTER_SETTINGS_KEYS))
                this.updateSettings();
        });
    }

    public isEnabled() {
        return browser.webRequest.onHeadersReceived.hasListener(this.onHeadersReceived);
    }

    private shouldCookieBeBlocked(tabId: number, domain: string, name: string) {
        const type = settings.getCleanupTypeForCookie(domain.startsWith(".") ? domain.substr(1) : domain, name);
        if (type === CleanupType.NEVER || type === CleanupType.STARTUP)
            return false;
        return type === CleanupType.INSTANTLY || this.blockThirdpartyCookies && this.tabWatcher.isThirdPartyCookieOnTab(tabId, domain);
    }

    private filterResponseHeaders(responseHeaders: WebRequest.HttpHeaders, fallbackDomain: string, tabId: number): WebRequest.HttpHeaders | undefined {
        return responseHeaders.filter((x) => {
            if (x.name.toLowerCase() === "set-cookie") {
                if (x.value) {
                    const filtered = x.value.split("\n").filter((value) => {
                        const cookieInfo = parseSetCookieHeader(value.trim(), fallbackDomain);
                        if (cookieInfo) {
                            const domain = cookieInfo.domain.startsWith(".") ? cookieInfo.domain.substr(1) : cookieInfo.domain;
                            if (this.shouldCookieBeBlocked(tabId, domain, cookieInfo.name)) {
                                messageUtil.sendSelf("cookieRemoved", domain);
                                return false;
                            }
                        }
                        return true;
                    });

                    if (filtered.length === 0)
                        return false;
                    x.value = filtered.join("\n");
                }
            }
            return true;
        });
    }

    private updateSettings() {
        this.blockThirdpartyCookies = settings.get("cleanThirdPartyCookies.beforeCreation");
        if (this.blockThirdpartyCookies || settings.get("instantly.enabled") && settings.hasBlockingRule())
            browser.webRequest.onHeadersReceived.addListener(this.onHeadersReceived, { urls: ["<all_urls>"] }, ["responseHeaders", "blocking"]);
        else
            browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
    }
}
