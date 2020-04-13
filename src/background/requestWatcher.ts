/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, WebRequest, WebNavigation } from "webextension-polyfill-ts";

import { ExtensionContext } from "../lib/bootstrap";

const WEB_REQUEST_FILTER: WebRequest.RequestFilter = { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] };

export interface RequestWatcherListener {
    prepareNavigation(tabId: number, frameId: number, hostname: string): void;
    commitNavigation(tabId: number, frameId: number, hostname: string): void;
    completeNavigation(tabId: number, frameId: number): void;
}

export class RequestWatcher {
    private readonly listener: RequestWatcherListener;

    private context: ExtensionContext;

    public constructor(listener: RequestWatcherListener, context: ExtensionContext) {
        this.listener = listener;
        this.context = context;

        browser.webNavigation.onBeforeNavigate.addListener(this.onBeforeNavigate);
        browser.webNavigation.onCommitted.addListener(this.onCommitted);
        browser.webNavigation.onCompleted.addListener(this.onCompleted);
        browser.webRequest.onBeforeRedirect.addListener(this.onBeforeRedirect, WEB_REQUEST_FILTER);
    }

    private onBeforeNavigate = (details: WebNavigation.OnBeforeNavigateDetailsType) => {
        this.listener.prepareNavigation(
            details.tabId,
            details.frameId,
            this.context.domainUtils.getValidHostname(details.url)
        );
    };

    private onCommitted = (details: WebNavigation.OnCommittedDetailsType) => {
        this.listener.commitNavigation(
            details.tabId,
            details.frameId,
            this.context.domainUtils.getValidHostname(details.url)
        );
    };

    private onCompleted = (details: WebNavigation.OnCompletedDetailsType) => {
        this.listener.completeNavigation(details.tabId, details.frameId);
    };

    private onBeforeRedirect = (details: WebRequest.OnBeforeRedirectDetailsType) => {
        this.listener.prepareNavigation(
            details.tabId,
            details.frameId,
            this.context.domainUtils.getValidHostname(details.redirectUrl)
        );
    };
}
