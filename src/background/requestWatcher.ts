/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, WebRequest, WebNavigation } from "webextension-polyfill-ts";
import { getValidHostname } from "../shared";

const WEB_REQUEST_FILTER: WebRequest.RequestFilter = { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] };

export interface RequestWatcherListener {
    prepareNavigation(tabId: number, frameId: number, hostname: string): void;
    commitNavigation(tabId: number, frameId: number, hostname: string): void;
    completeNavigation(tabId: number, frameId: number): void;
}

export class RequestWatcher {
    private readonly listener: RequestWatcherListener;

    public constructor(listener: RequestWatcherListener) {
        this.listener = listener;

        browser.webNavigation.onBeforeNavigate.addListener(this.onBeforeNavigate = this.onBeforeNavigate.bind(this));
        browser.webNavigation.onCommitted.addListener(this.onCommitted = this.onCommitted.bind(this));
        browser.webNavigation.onCompleted.addListener(this.onCompleted = this.onCompleted.bind(this));
        browser.webRequest.onBeforeRedirect.addListener(this.onBeforeRedirect = this.onBeforeRedirect.bind(this), WEB_REQUEST_FILTER);
    }

    private onBeforeNavigate(details: WebNavigation.OnBeforeNavigateDetailsType) {
        this.listener.prepareNavigation(details.tabId, details.frameId, getValidHostname(details.url));
    }

    private onCommitted(details: WebNavigation.OnCommittedDetailsType) {
        this.listener.commitNavigation(details.tabId, details.frameId, getValidHostname(details.url));
    }

    private onCompleted(details: WebNavigation.OnCompletedDetailsType) {
        this.listener.completeNavigation(details.tabId, details.frameId);
    }

    private onBeforeRedirect(details: WebRequest.OnBeforeRedirectDetailsType) {
        this.listener.prepareNavigation(details.tabId, details.frameId, getValidHostname(details.redirectUrl));
    }
}
