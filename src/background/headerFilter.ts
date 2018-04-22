/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as messageUtil from "../lib/messageUtil";
import { settings } from "../lib/settings";
import { TabWatcher } from './tabWatcher';
import { RecentlyAccessedDomains } from './recentlyAccessedDomains';
import { browser, WebRequest } from "webextension-polyfill-ts";
import { getValidHostname } from "../shared";
import { RuleType } from "../lib/settingsSignature";
import { SetCookieHeader, parseSetCookieHeader } from "./backgroundHelpers";

// fixme: make this file unit-testable and add tests
export class HeaderFilter {
    private blockThirdpartyCookies = false;
    private readonly tabWatcher: TabWatcher;
    private readonly recentlyAccessedDomains: RecentlyAccessedDomains;
    private readonly onHeadersReceived: (details: WebRequest.OnHeadersReceivedDetailsType) => WebRequest.BlockingResponse;

    public constructor(tabWatcher: TabWatcher, recentlyAccessedDomains: RecentlyAccessedDomains) {
        this.tabWatcher = tabWatcher;
        this.recentlyAccessedDomains = recentlyAccessedDomains;
        this.onHeadersReceived = (details) => {
            if (details.responseHeaders) {
                return {
                    responseHeaders: this.filterResponseHeaders(details.responseHeaders, getValidHostname(details.url), details.tabId)
                }
            }
            return {};
        }
        this.updateSettings();
        messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
            if (changedKeys.indexOf('cleanThirdPartyCookies.beforeCreation') !== -1 || changedKeys.indexOf('rules') !== -1 || changedKeys.indexOf('fallbackRule') !== -1)
                this.updateSettings();
        });
    }

    private shouldCookieBeBlocked(tabId: number, cookieInfo: SetCookieHeader) {
        const type = settings.getRuleTypeForCookie(cookieInfo.domain.startsWith('.') ? cookieInfo.domain.substr(1) : cookieInfo.domain, cookieInfo.name);
        if (type === RuleType.WHITE || type === RuleType.GRAY)
            return false;
        return type === RuleType.BLOCK || this.blockThirdpartyCookies && this.tabWatcher.isThirdPartyCookieOnTab(tabId, cookieInfo.domain);
    }

    private filterResponseHeaders(responseHeaders: WebRequest.HttpHeaders, fallbackDomain: string, tabId: number): WebRequest.HttpHeaders | undefined {
        return responseHeaders.filter((x) => {
            if (x.name.toLowerCase() === 'set-cookie') {
                if (x.value) {
                    const cookieInfo = parseSetCookieHeader(x.value, fallbackDomain);
                    if (cookieInfo && this.shouldCookieBeBlocked(tabId, cookieInfo)) {
                        this.recentlyAccessedDomains.add(cookieInfo.domain);
                        return false;
                    }
                }
            }
            return true;
        });
    }

    private updateSettings() {
        this.blockThirdpartyCookies = settings.get('cleanThirdPartyCookies.beforeCreation');
        if (this.blockThirdpartyCookies || settings.hasBlockingRule())
            browser.webRequest.onHeadersReceived.addListener(this.onHeadersReceived, { urls: ["<all_urls>"] }, ["responseHeaders", "blocking"]);
        else
            browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
    }
}
