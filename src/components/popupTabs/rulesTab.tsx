import { h } from "tsx-dom";
import { SettingsCheckbox } from "../settingsCheckbox";
import { on } from "../../lib/htmlUtils";
import { RuleButton } from "../ruleButton";
import { settings, isValidExpression } from "../../lib/settings";
import { RuleTable } from "../ruleTable";
import { RuleType } from "../../lib/settingsSignature";
import { Key } from "ts-keycode-enum";
import { HelpLink } from "../helpLink";
import { RuleDialog } from "../dialogs/ruleDialog";
import { ExpressionHint } from "../expressionHint";

function setFallbackRule(type: RuleType) {
    settings.set("fallbackRule", type);
    settings.save();
}

export function RulesTab() {
    const filterInput = <input data-i18n="rules_input?placeholder" /> as HTMLInputElement;

    function addRule() {
        const expression = filterInput.value.trim().toLowerCase();
        if (expression && isValidExpression(expression) && settings.getExactRuleType(expression) === null) {
            function onConfirm(type: RuleType | false) {
                if (type !== false) {
                    settings.setRule(expression, type);
                    filterInput.value = "";
                    filterInput.dispatchEvent(new Event("input")); // force hint update
                }
                filterInput.focus();
            }
            let focusRule = settings.getExactRuleType(expression);
            if (focusRule === null)
                focusRule = RuleType.WHITE;
            <RuleDialog expression={expression} focusRule={focusRule} onConfirm={onConfirm} />;
        }
    }

    on(filterInput, "keydown", (e) => {
        if (e.keyCode === Key.Enter) {
            e.preventDefault();
            addRule();
        }
    });

    return <div id="rules_tab_page">
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
        <RuleTable headerI18n="rules_column_expression" filterInput={filterInput}/>
        <div><SettingsCheckbox key="whitelistNoTLD" i18n="setting_whitelist_no_tld?text?title" /></div>
        <div><SettingsCheckbox key="whitelistFileSystem" i18n="setting_whitelist_file_system" /></div>
        <div class="split_equal">
            <span data-i18n="settings_fallback_rule" />
            <span class="align_right"><RuleButton type={settings.get("fallbackRule")} onConfirm={setFallbackRule}/></span>
        </div>
    </div>;
}
