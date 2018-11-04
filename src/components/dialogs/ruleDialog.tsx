import { h } from "tsx-dom";
import { Dialog, showDialog, hideDialog } from "./dialog";
import { CleanupType } from "../../lib/settingsSignature";
import { ExpressionHint } from "../expressionHint";
import { isValidExpression, settings } from "../../lib/settings";
import { ConfirmDialog } from "./confirmDialog";

export interface RuleDialogProps {
    expression?: string;
    editable?: boolean;
    focusType: CleanupType | null;
    onConfirm: (type: CleanupType | false, expression?: string) => void;
}

export function RuleDialog({ expression, editable, focusType, onConfirm }: RuleDialogProps) {
    function onCancel() {
        hideDialog(dialog);
        onConfirm(false);
    }

    function confirmAndHide(type: CleanupType, expression?: string) {
        hideDialog(dialog);
        onConfirm(type, expression);
    }

    function confirmAndHideChecked(type: CleanupType, expression?: string) {
        if (editable && expression && settings.getExactCleanupType(expression) !== null) {
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

    function selectRule(type: CleanupType) {
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
    const cleanupTypeButtons = [
        <button data-i18n="cleanup_type_never_button?markdown" class="cleanup_type_never" onClick={() => selectRule(CleanupType.NEVER)} />,
        <button data-i18n="cleanup_type_startup_button?markdown" class="cleanup_type_startup" onClick={() => selectRule(CleanupType.STARTUP)} />,
        <button data-i18n="cleanup_type_leave_button?markdown" class="cleanup_type_leave" onClick={() => selectRule(CleanupType.LEAVE)} />,
        <button data-i18n="cleanup_type_instantly_button?markdown" class="cleanup_type_instantly" onClick={() => selectRule(CleanupType.INSTANTLY)} />
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
        <div class="split_equal split_wrap">{cleanupTypeButtons}</div>
        <div class="split_equal split_wrap">
            <button data-i18n="confirm_cancel" onClick={onCancel} />
        </div>
    </Dialog>;

    let focusElement = focusType === null ? cleanupTypeButtons[CleanupType.NEVER] : cleanupTypeButtons[focusType];
    if (editable && expression && settings.getExactCleanupType(expression) !== null)
        focusElement = expressionElement;
    return showDialog(dialog, focusElement);
}
