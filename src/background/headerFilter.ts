/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as messageUtil from "../lib/messageUtil";
import { settings } from "../lib/settings";
import { badges, getBadgeForCookie } from './backgroundShared';
import { TabWatcher } from './tabWatcher';
import { RecentlyAccessedDomains } from './recentlyAccessedDomains';
import { browser, WebRequest } from "webextension-polyfill-ts";
import { getValidHostname } from "../shared";

interface SetCookieInfo {
    name: string;
    value: string;
    domain: string;
}
const cookieDomainRegexp = /^domain=;/i;
const keyValueRegexpSplit = /=(.+)/;
function parseSetCookies(header: string, fallbackDomain: string) : SetCookieInfo {
    const parts = header.split(';');
    const kv = parts[0].split(keyValueRegexpSplit);
    const domainPart = parts.find((part, i)=> i>0 && cookieDomainRegexp.test(part));
    let domain = null;
    if(domainPart)
        domain = domainPart.split('=')[1];
    domain = (domain || fallbackDomain);
    if(domain.startsWith('.'))
        domain = domain.substr(1);
    //fixme: get first party domain?
    return {
        name: kv[0],
        value: kv[1],
        domain: domain
    };
}

export class HeaderFilter {
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

    private shouldCookieBeBlocked(tabId: number, cookieInfo: SetCookieInfo) {
        const badge = getBadgeForCookie(cookieInfo.domain.startsWith('.') ? cookieInfo.domain.substr(1) : cookieInfo.domain, cookieInfo.name);
        if (badge === badges.white || badge === badges.gray)
            return false;
        return badge === badges.block || this.tabWatcher.isThirdPartyCookie(tabId, cookieInfo.domain);
    }

    private filterResponseHeaders(responseHeaders: WebRequest.HttpHeaders, fallbackDomain: string, tabId: number): WebRequest.HttpHeaders | undefined {
        return responseHeaders.filter((x) => {
            if (x.name.toLowerCase() === 'set-cookie') {
                if (x.value) {
                    const cookieInfo = parseSetCookies(x.value, fallbackDomain);
                    if (this.shouldCookieBeBlocked(tabId, cookieInfo)) {
                        this.recentlyAccessedDomains.add(cookieInfo.domain);
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
