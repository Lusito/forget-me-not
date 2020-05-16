import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import * as punycode from "punycode";
import { browser } from "webextension-polyfill-ts";
import { container } from "tsyringe";

import { on } from "../../frontend/htmlUtils";
import { RuleTable } from "../ruleTable";
import { getValidHostname } from "../../shared/domainUtils";
import { MessageUtil } from "../../shared/messageUtil";
import { StoreUtils } from "../../shared/storeUtils";

class StartTabManager {
    private hostname = "";

    private cleanButton: HTMLElement;

    private urlLabel: HTMLElement;

    private punifiedUrlLabel: HTMLElement;

    private ruleTableContainer: HTMLElement;

    private readonly defaultCookieStoreId: string;

    public constructor(
        cleanButton: HTMLElement,
        urlLabel: HTMLElement,
        punifiedUrlLabel: HTMLElement,
        ruleTableContainer: HTMLElement
    ) {
        this.cleanButton = cleanButton;
        this.urlLabel = urlLabel;
        this.punifiedUrlLabel = punifiedUrlLabel;
        this.ruleTableContainer = ruleTableContainer;
        this.defaultCookieStoreId = container.resolve(StoreUtils).defaultCookieStoreId;
        this.initCurrentTab();

        wetLayer.addListener(() => this.setCurrentTabLabel(this.hostname || false));
    }

    private setCurrentTabLabel(domain: string | false) {
        this.urlLabel.textContent = domain || wetLayer.getMessage("invalid_tab");
        let punnified = "";
        if (domain) {
            punnified = domain ? punycode.toUnicode(domain) : "";
            punnified = punnified === domain ? "" : `(${punnified})`;
        }
        this.punifiedUrlLabel.textContent = punnified;
    }

    private setInvalidTab() {
        this.setCurrentTabLabel(false);
        this.cleanButton.style.display = "none";
    }

    private async initCurrentTab() {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs.length ? tabs[0] : null;
        if (tab?.url && !tab.incognito) {
            const hostname = getValidHostname(tab.url);
            if (!hostname) {
                this.setInvalidTab();
            } else {
                const ruleFilter = {
                    domain: hostname,
                    storeId: tab.cookieStoreId || this.defaultCookieStoreId,
                };
                this.hostname = hostname;
                this.setCurrentTabLabel(hostname);
                const messageUtil = container.resolve(MessageUtil);
                on(this.cleanButton, "click", () => {
                    messageUtil.send("cleanUrlNow", { hostname: this.hostname, cookieStoreId: tab.cookieStoreId });
                });
                this.ruleTableContainer.appendChild(
                    <RuleTable ruleFilter={ruleFilter} headerI18n="rules_column_matching_expression" />
                );
            }
        } else {
            this.setInvalidTab();
        }
    }
}

export function StartTab() {
    const urlLabel = <span id="current_tab">?</span>;
    const cleanButton = <button id="clean_current_tab" data-i18n="button_clean_domain" />;
    const punifiedUrlLabel = <div id="current_tab_punyfied" />;
    const ruleTableContainer = <div />;
    // eslint-disable-next-line no-new
    new StartTabManager(cleanButton, urlLabel, punifiedUrlLabel, ruleTableContainer);

    return (
        <div>
            <div>
                {urlLabel}
                {cleanButton}
                {punifiedUrlLabel}
            </div>
            {ruleTableContainer}
        </div>
    );
}
