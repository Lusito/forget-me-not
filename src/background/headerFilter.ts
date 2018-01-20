/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as messageUtil from "../lib/messageUtil";
import { settings } from "../lib/settings";
import { badges, getBadgeForDomain } from './backgroundShared';
import { TabWatcher } from './tabWatcher';
import { MostRecentCookieDomains } from './mostRecentCookieDomains';
import { browser, WebRequest } from "webextension-polyfill-ts";

const cookieDomainRegexp = /domain=([\.a-z0-9\-]+);/i;
function getCookieDomainFromCookieHeader(header: string) {
    var match = cookieDomainRegexp.exec(header);
    if (match)
        return match[1];
    return false;
}

export class HeaderFilter {
    private readonly tabWatcher: TabWatcher;
    private readonly mostRecentCookieDomains: MostRecentCookieDomains;
    private readonly onHeadersReceived: (details: WebRequest.OnHeadersReceivedDetailsType) => WebRequest.BlockingResponse;

    public constructor(tabWatcher: TabWatcher, mostRecentCookieDomains: MostRecentCookieDomains) {
        this.tabWatcher = tabWatcher;
        this.mostRecentCookieDomains = mostRecentCookieDomains;
        this.onHeadersReceived = (details) => {
            if (details.responseHeaders) {
                return {
                    responseHeaders: this.filterResponseHeaders(details.responseHeaders, details.tabId)
                }
            }
            return {};
        }
        this.updateSettings();
        messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
            if (changedKeys.indexOf('cleanThirdPartyCookies.beforeCreation') !== -1 || changedKeys.indexOf('rules') !== -1)
                this.updateSettings();
        });
    }

    private shouldCookieBeBlocked(tabId: number, domain: string) {
        const badge = getBadgeForDomain(domain.startsWith('.') ? domain.substr(1) : domain);
        if(badge === badges.white || badge === badges.gray)
            return false;
        return badge === badges.block || this.tabWatcher.isThirdPartyCookie(tabId, domain);
    }

    private filterResponseHeaders(responseHeaders: WebRequest.HttpHeaders, tabId: number): WebRequest.HttpHeaders | undefined {
        return responseHeaders.filter((x) => {
            if (x.name.toLowerCase() === 'set-cookie') {
                if (x.value) {
                    const domain = getCookieDomainFromCookieHeader(x.value);
                    if(domain && this.shouldCookieBeBlocked(tabId, domain)) {
                        this.mostRecentCookieDomains.add(domain);
                        return false;
                    }
                }
            }
            return true;
        });
    }

    private updateSettings() {
        if (settings.get('cleanThirdPartyCookies.beforeCreation') || settings.hasBlockingRule())
            browser.webRequest.onHeadersReceived.addListener(this.onHeadersReceived, { urls: ["<all_urls>"] }, ["responseHeaders", "blocking"]);
        else
            browser.webRequest.onHeadersReceived.removeListener(this.onHeadersReceived);
    }
}
