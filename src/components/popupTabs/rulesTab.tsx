import { h } from "tsx-dom";
import { Key } from "ts-keycode-enum";

import { SettingsCheckbox } from "../settingsCheckbox";
import { on } from "../../frontend/htmlUtils";
import { RuleButton } from "../ruleButton";
import { RuleTable } from "../ruleTable";
import { CleanupType } from "../../lib/shared";
import { HelpLink } from "../helpLink";
import { ExpressionHint } from "../expressionHint";
import { showAddRuleDialog } from "../helpers";
import { ExtensionContextProps } from "../../lib/bootstrap";
import { isValidExpression } from "../../lib/expressionUtils";

export function RulesTab({ context }: ExtensionContextProps) {
    const filterInput = (<input data-i18n="rules_input?placeholder" />) as HTMLInputElement;
    const { settings } = context;

    function setFallbackRule(type: CleanupType) {
        settings.set("fallbackRule", type);
        settings.save();
    }

    function addRule() {
        const expression = filterInput.value.trim().toLowerCase();
        if (expression && isValidExpression(expression) && settings.getExactRuleDefinition(expression) === null) {
            showAddRuleDialog(context, expression, () => {
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
                    <ExpressionHint input={filterInput} context={context} />
                </div>
                <button data-i18n="rules_add" onClick={addRule} />
            </div>
            <div class="rules_table_wrapper">
                <RuleTable headerI18n="rules_column_expression" filterInput={filterInput} context={context} />
            </div>
            <div>
                <SettingsCheckbox key="whitelistNoTLD" i18n="setting_whitelist_no_tld?text?title" context={context} />
            </div>
            <div>
                <SettingsCheckbox key="whitelistFileSystem" i18n="setting_whitelist_file_system" context={context} />
            </div>
            <div class="split_equal">
                <span data-i18n="settings_fallback_rule" />
                <span class="align_right">
                    <RuleButton type={settings.get("fallbackRule")} onConfirm={setFallbackRule} context={context} />
                </span>
            </div>
        </div>
    );
}
