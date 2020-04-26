/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { singleton } from "tsyringe";
import { browser, WebRequest, WebNavigation } from "webextension-polyfill-ts";

import { DomainUtils } from "../shared/domainUtils";
import { TabWatcher } from "./tabWatcher";

const WEB_REQUEST_FILTER: WebRequest.RequestFilter = { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] };

@singleton()
export class RequestWatcher {
    public constructor(private readonly domainUtils: DomainUtils, private readonly tabWatcher: TabWatcher) {
        browser.webNavigation.onBeforeNavigate.addListener(this.onBeforeNavigate);
        browser.webNavigation.onCommitted.addListener(this.onCommitted);
        browser.webNavigation.onCompleted.addListener(this.onCompleted);
        browser.webRequest.onBeforeRedirect.addListener(this.onBeforeRedirect, WEB_REQUEST_FILTER);
    }

    private onBeforeNavigate = (details: WebNavigation.OnBeforeNavigateDetailsType) => {
        this.tabWatcher.prepareNavigation(
            details.tabId,
            details.frameId,
            this.domainUtils.getValidHostname(details.url)
        );
    };

    private onCommitted = (details: WebNavigation.OnCommittedDetailsType) => {
        this.tabWatcher.commitNavigation(
            details.tabId,
            details.frameId,
            this.domainUtils.getValidHostname(details.url)
        );
    };

    private onCompleted = (details: WebNavigation.OnCompletedDetailsType) => {
        this.tabWatcher.completeNavigation(details.tabId);
    };

    private onBeforeRedirect = (details: WebRequest.OnBeforeRedirectDetailsType) => {
        this.tabWatcher.prepareNavigation(
            details.tabId,
            details.frameId,
            this.domainUtils.getValidHostname(details.redirectUrl)
        );
    };
}
