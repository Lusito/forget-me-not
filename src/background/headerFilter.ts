/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, WebRequest } from "webextension-polyfill-ts";

import { messageUtil } from "../lib/messageUtil";
import { SettingsKey } from "../lib/defaultSettings";
import { CleanupType } from "../lib/shared";
import { someItemsMatch, ExtensionBackgroundContext } from "./backgroundShared";

const LISTENER_OPTIONS: WebRequest.OnHeadersReceivedOptions[] = ["responseHeaders", "blocking"];
const HEADER_FILTER_SETTINGS_KEYS: SettingsKey[] = [
    "cleanThirdPartyCookies.beforeCreation",
    "rules",
    "fallbackRule",
    "instantly.enabled",
];

export class HeaderFilter {
    private filter: WebRequest.RequestFilter = { urls: ["<all_urls>"] };

    private snoozing = false;

    private blockThirdpartyCookies = false;

    private readonly context: ExtensionBackgroundContext;

    private readonly onHeadersReceived: (
        details: WebRequest.OnHeadersReceivedDetailsType
    ) => WebRequest.BlockingResponse;

    public constructor(context: ExtensionBackgroundContext) {
        this.context = context;
        if (context.supports.requestFilterIncognito) this.filter.incognito = false;
        this.onHeadersReceived = (details) => {
            if (details.responseHeaders && !details.incognito && !context.incognitoWatcher.hasTab(details.tabId)) {
                return {
                    responseHeaders: this.filterResponseHeaders(
                        details.responseHeaders,
                        context.domainUtils.getValidHostname(details.url),
                        details.tabId
                    ),
                };
            }
            return {};
        };
        this.updateSettings();
        messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, HEADER_FILTER_SETTINGS_KEYS)) this.updateSettings();
        });
    }

    public isEnabled() {
        return browser.webRequest.onHeadersReceived.hasListener(this.onHeadersReceived);
    }

    private shouldCookieBeBlocked(tabId: number, domain: string, name: string) {
        const { settings, tabWatcher } = this.context;
        const type = settings.getCleanupTypeForCookie(domain.startsWith(".") ? domain.substr(1) : domain, name);
        if (type === CleanupType.NEVER || type === CleanupType.STARTUP) return false;
        return (
            type === CleanupType.INSTANTLY ||
            (this.blockThirdpartyCookies && tabWatcher.isThirdPartyCookieOnTab(tabId, domain))
        );
    }

    private filterResponseHeaders(
        responseHeaders: WebRequest.HttpHeaders,
        fallbackDomain: string,
        tabId: number
    ): WebRequest.HttpHeaders | undefined {
        return responseHeaders.filter((x) => {
            if (x.name.toLowerCase() === "set-cookie") {
                if (x.value) {
                    const filtered = x.value.split("\n").filter((value) => {
                        const cookieInfo = this.context.cookieUtils.parseSetCookieHeader(value.trim(), fallbackDomain);
                        if (cookieInfo) {
                            const domain = cookieInfo.domain.startsWith(".")
                                ? cookieInfo.domain.substr(1)
                                : cookieInfo.domain;
                            if (this.shouldCookieBeBlocked(tabId, domain, cookieInfo.name)) {
                                messageUtil.sendSelf("cookieRemoved", domain);
                                return false;
                            }
                        }
                        return true;
                    });

                    if (filtered.length === 0) return false;
                    x.value = filtered.join("\n");
                }
            }
            return true;
        });
    }

    private updateSettings() {
        const { settings } = this.context;
        this.blockThirdpartyCookies = settings.get("cleanThirdPartyCookies.beforeCreation");
        const enable =
            !this.snoozing &&
            (this.blockThirdpartyCookies || (settings.get("instantly.enabled") && settings.hasBlockingRule()));
        if (enable !== this.isEnabled()) {
            if (enable)
                browser.webRequest.onHeadersReceived.addListener(this.onHeadersReceived, this.filter, LISTENER_OPTIONS);
            else browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
        }
    }

    public setSnoozing(snoozing: boolean) {
        this.snoozing = snoozing;
        this.updateSettings();
    }
}
