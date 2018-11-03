import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import { messageUtil } from "../../lib/messageUtil";
import * as punycode from "punycode";
import { browser } from "webextension-polyfill-ts";
import { getValidHostname } from "../../shared";
import { on } from "../../lib/htmlUtils";
import { RuleTable } from "../ruleTable";

class StartTabManager {
    private hostname: string = "";

    public constructor(private cleanButton: HTMLElement, private urlLabel: HTMLElement, private punifiedUrlLabel: HTMLElement, private ruleTableContainer: HTMLElement) {
        this.initCurrentTab();

        wetLayer.addListener(() => this.setCurrentTabLabel(this.hostname || false));
    }

    private setCurrentTabLabel(domain: string | false) {
        this.urlLabel.textContent = domain ? domain : wetLayer.getMessage("invalid_tab");
        let punnified = "";
        if (domain) {
            punnified = domain ? punycode.toUnicode(domain) : "";
            punnified = (punnified === domain) ? "" : `(${punnified})`;
        }
        this.punifiedUrlLabel.textContent = punnified;
    }

    private setInvalidTab() {
        this.setCurrentTabLabel(false);
        this.cleanButton.style.display = "none";
    }

    private initCurrentTab() {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const tab = tabs.length && tabs[0];
            if (tab && tab.url && !tab.incognito) {
                const hostname = getValidHostname(tab.url);
                if (!hostname) {
                    this.setInvalidTab();
                } else {
                    this.hostname = hostname;
                    this.setCurrentTabLabel(hostname);
                    on(this.cleanButton, "click", () => {
                        messageUtil.send("cleanUrlNow", { hostname: this.hostname, cookieStoreId: tab.cookieStoreId });
                    });
                    this.ruleTableContainer.appendChild(<RuleTable forDomain={hostname} headerI18n="rules_column_matching_expression" />);
                }
            } else {
                this.setInvalidTab();
            }
        });
    }
}

export function StartTab() {
    const urlLabel = <span id="current_tab">?</span>;
    const cleanButton = <button id="clean_current_tab" data-i18n="button_clean_domain" />;
    const punifiedUrlLabel = <div id="current_tab_punyfied" />;
    const ruleTableContainer = <div />;
    new StartTabManager(cleanButton, urlLabel, punifiedUrlLabel, ruleTableContainer);

    return <div>
        <div>
            {urlLabel}
            {cleanButton}
            {punifiedUrlLabel}
        </div>
        {ruleTableContainer}
    </div>;
}
