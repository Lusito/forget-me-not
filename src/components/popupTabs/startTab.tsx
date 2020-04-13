import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import * as punycode from "punycode";
import { browser } from "webextension-polyfill-ts";

import { messageUtil } from "../../lib/messageUtil";
import { getValidHostname } from "../../shared";
import { on } from "../../lib/htmlUtils";
import { RuleTable } from "../ruleTable";

class StartTabManager {
    private hostname = "";

    private cleanButton: HTMLElement;

    private urlLabel: HTMLElement;

    private punifiedUrlLabel: HTMLElement;

    private ruleTableContainer: HTMLElement;

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
                this.hostname = hostname;
                this.setCurrentTabLabel(hostname);
                on(this.cleanButton, "click", () => {
                    messageUtil.send("cleanUrlNow", { hostname: this.hostname, cookieStoreId: tab.cookieStoreId });
                });
                this.ruleTableContainer.appendChild(
                    <RuleTable forDomain={hostname} headerI18n="rules_column_matching_expression" />
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
