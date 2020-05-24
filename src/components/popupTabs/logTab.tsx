import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import { container } from "tsyringe";

import { SettingsCheckbox } from "../settingsCheckbox";
import { SettingsNumber } from "../settingsNumber";
import { CookieDomainInfo } from "../../shared/types";
import { removeAllChildren } from "../../frontend/htmlUtils";
import "./style.scss";
import { appendPunycode, getSuggestedRuleExpression, showAddRuleDialog } from "../helpers";
import { MessageUtil } from "../../shared/messageUtil";

export function LogTab() {
    const list = <ul id="recently_accessed_domains" />;

    function createListItem(info: CookieDomainInfo) {
        function addRule() {
            showAddRuleDialog(getSuggestedRuleExpression(info.domain));
        }
        const punified = appendPunycode(info.domain);
        const addRuleMessage = wetLayer.getMessage("button_log_add_rule");
        const title = wetLayer.getMessage(`${info.i18nButton}@title`);
        return (
            <li>
                <span class={info.className} title={title}>
                    {wetLayer.getMessage(info.i18nBadge)}
                </span>
                <span title={punified}>{punified}</span>
                <button
                    class="log_add_rule"
                    tabIndex={0}
                    aria-label={`${addRuleMessage} (${punified})`}
                    onClick={addRule}
                >
                    {addRuleMessage}
                </button>
            </li>
        );
    }

    const messageUtil = container.resolve(MessageUtil);
    messageUtil.onRecentlyAccessedDomains.receive((domains: CookieDomainInfo[]) => {
        removeAllChildren(list);
        for (const info of domains) list.appendChild(createListItem(info));
    });

    messageUtil.getRecentlyAccessedDomains.send();
    wetLayer.addListener(() => {
        messageUtil.getRecentlyAccessedDomains.send();
    });

    return (
        <div>
            <div class="split_equal">
                <SettingsCheckbox key="logRAD.enabled" i18n="setting_log_rad_enabled" />
                <SettingsNumber key="logRAD.limit" i18n="setting_log_rad_limit" class="align_right" />
            </div>
            <b data-i18n="recently_accessed_domains" class="top_margin" />
            {list}
        </div>
    );
}
