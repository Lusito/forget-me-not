import { h } from "tsx-dom";
import { Key } from "ts-keycode-enum";
import { container } from "tsyringe";

import { SettingsCheckbox } from "../settingsCheckbox";
import { on } from "../../frontend/htmlUtils";
import { RuleButton } from "../ruleButton";
import { RuleTable } from "../ruleTable";
import { CleanupType } from "../../shared/types";
import { HelpLink } from "../helpLink";
import { ExpressionHint } from "../expressionHint";
import { showAddRuleDialog } from "../helpers";
import { isValidExpression } from "../../shared/expressionUtils";
import { Settings } from "../../shared/settings";
import { RuleManager } from "../../shared/ruleManager";

export function RulesTab() {
    const filterInput = (<input data-i18n="rules_input?placeholder" />) as HTMLInputElement;

    const settings = container.resolve(Settings);
    const ruleManager = container.resolve(RuleManager);

    function setFallbackRule(type: CleanupType) {
        settings.set("fallbackRule", type);
        settings.save();
    }

    function addRule() {
        const expression = filterInput.value.trim().toLowerCase();
        if (expression && isValidExpression(expression) && ruleManager.getExactRuleDefinition(expression) === null) {
            showAddRuleDialog(expression, () => {
                filterInput.value = "";
                filterInput.dispatchEvent(new Event("input")); // force hint update
            });
        }
    }

    on(filterInput, "keydown", (e) => {
        if (e.keyCode === Key.Enter) {
            e.preventDefault();
            addRule();
        }
    });

    return (
        <div id="rules_tab_page">
            <h2 class="tab_heading">
                <span data-i18n="define_rules" />
                <HelpLink i18n="help_button?title" href="readme.html#tutorial" />
            </h2>
            <div class="rules_input_wrapper">
                <div>
                    {filterInput}
                    <ExpressionHint input={filterInput} />
                </div>
                <button data-i18n="rules_add" onClick={addRule} />
            </div>
            <div class="rules_table_wrapper">
                <RuleTable headerI18n="rules_column_expression" filterInput={filterInput} />
            </div>
            <div>
                <SettingsCheckbox key="whitelistNoTLD" i18n="setting_whitelist_no_tld?text?title" />
            </div>
            <div>
                <SettingsCheckbox key="whitelistFileSystem" i18n="setting_whitelist_file_system" />
            </div>
            <div class="split_equal">
                <span data-i18n="settings_fallback_rule" />
                <span class="align_right">
                    <RuleButton type={settings.get("fallbackRule")} onConfirm={setFallbackRule} />
                </span>
            </div>
        </div>
    );
}
