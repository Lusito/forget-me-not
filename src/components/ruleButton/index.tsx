import { h } from "tsx-dom";

import { CleanupType } from "../../lib/shared";
import { getBadgeForCleanupType } from "../../background/backgroundHelpers";
import { translateElement } from "../../frontend/htmlUtils";
import { RuleDialog } from "../dialogs/ruleDialog";
import { cleanupTypeForElement } from "../../lib/settings";
import { ExtensionContext } from "../../lib/bootstrap";

interface RuleButtonProps {
    expression?: string;
    type: CleanupType | null;
    temporary?: boolean;
    onConfirm: (type: CleanupType, expression: string, temporary: boolean) => void;
    context: ExtensionContext;
}

function updateRuleButton(button: HTMLElement, type: CleanupType | null) {
    const badge = type !== null && getBadgeForCleanupType(type);
    button.className = badge ? badge.className : "cleanup_type_none";
    button.setAttribute("data-i18n", `${badge ? badge.i18nButton : "cleanup_type_create_button"}?title?markdown`);
    translateElement(button);
    // fixme: aria label
}

export function RuleButton({ expression, type, temporary, onConfirm, context }: RuleButtonProps) {
    function onChangeProxy(changedType: CleanupType | false, changedExpression: string, changedTemporary: boolean) {
        if (changedType !== false) {
            updateRuleButton(button, changedType);
            onConfirm(changedType, changedExpression || "", changedTemporary);
        }
    }

    function onClick() {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        <RuleDialog
            expression={expression}
            editable={type === null}
            focusType={cleanupTypeForElement(button)}
            temporary={temporary || false}
            onConfirm={onChangeProxy}
            context={context}
        />;
    }

    const button = <button onClick={onClick} />;
    updateRuleButton(button, type);
    return button;
}
