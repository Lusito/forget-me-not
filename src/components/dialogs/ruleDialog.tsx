import { h } from "tsx-dom";
import { Dialog, showDialog, hideDialog } from "./dialog";
import { RuleType } from "../../lib/settingsSignature";
import { ExpressionHint } from "../expressionHint";
import { isValidExpression, settings } from "../../lib/settings";
import { ConfirmDialog } from "./confirmDialog";

export interface RuleDialogProps {
    expression?: string;
    editable?: boolean;
    focusRule: RuleType | null;
    onConfirm: (type: RuleType | false, expression?: string) => void;
}

export function RuleDialog({ expression, editable, focusRule, onConfirm }: RuleDialogProps) {
    function onCancel() {
        hideDialog(dialog);
        onConfirm(false);
    }

    function confirmAndHide(type: RuleType, expression?: string) {
        hideDialog(dialog);
        onConfirm(type, expression);
    }

    function confirmAndHideChecked(type: RuleType, expression?: string) {
        if (editable && expression && settings.getExactRuleType(expression) !== null) {
            function onConfirmClose(value: boolean) {
                if (value) {
                    hideDialog(dialog);
                    onConfirm(type, expression);
                } else {
                    const focus = dialog.querySelector("input");
                    focus && focus.focus();
                }
            }

            <ConfirmDialog titleI18nKey="confirm_rule_replace_dialog_title" contentI18nKey="confirm_rule_replace_dialog_content" onClose={onConfirmClose}/>;
        } else {
            confirmAndHide(type, expression);
        }
    }

    function selectRule(type: RuleType) {
        if (!expression)
            confirmAndHideChecked(type);
        else if (!editable)
            confirmAndHideChecked(type, expression);
        else {
            const changedExpression = (expressionElement as HTMLInputElement).value.trim().toLowerCase();
            if (changedExpression && isValidExpression(changedExpression))
                confirmAndHideChecked(type, changedExpression);
        }
    }
    const ruleButtons = [
        <button data-i18n="setting_type_white?markdown" class="badge_white" onClick={() => selectRule(RuleType.WHITE)} />,
        <button data-i18n="setting_type_gray?markdown" class="badge_gray" onClick={() => selectRule(RuleType.GRAY)} />,
        <button data-i18n="setting_type_forget?markdown" class="badge_forget" onClick={() => selectRule(RuleType.FORGET)} />,
        <button data-i18n="setting_type_block?markdown" class="badge_block" onClick={() => selectRule(RuleType.BLOCK)} />
    ];
    const expressionElement = editable ? <input value={expression} /> : <span>{expression}</span>;
    const expressionContainer = expression ? <div class="rules_input_wrapper">
        <b data-i18n="rule_dialog_expression"></b>
        <div>
            {expressionElement}
            {editable ? <ExpressionHint input={expressionElement as HTMLInputElement} /> : null}
        </div>
    </div> : null;

    const dialog = <Dialog className="rule_dialog" titleI18nKey="rule_dialog_title">
        {expressionContainer}
        <div data-i18n="rule_dialog_content?markdown"></div>
        <div class="split_equal split_wrap">{ruleButtons}</div>
        <div class="split_equal split_wrap">
            <button data-i18n="confirm_cancel" onClick={onCancel} />
        </div>
    </Dialog>;

    let focusElement = focusRule === null ? ruleButtons[RuleType.WHITE] : ruleButtons[focusRule];
    if (editable && expression && settings.getExactRuleType(expression) !== null)
        focusElement = expressionElement;
    return showDialog(dialog, focusElement);
}
