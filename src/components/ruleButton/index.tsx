import { h } from "tsx-dom";

import { CleanupType } from "../../lib/settingsSignature";
import { getBadgeForCleanupType } from "../../background/backgroundHelpers";
import { translateElement } from "../../lib/htmlUtils";
import { RuleDialog } from "../dialogs/ruleDialog";
import { cleanupTypeForElement } from "../../lib/settings";

interface RuleButtonProps {
    expression?: string;
    type: CleanupType | null;
    temporary?: boolean;
    onConfirm: (type: CleanupType, expression: string, temporary: boolean) => void;
}

function updateRuleButton(button: HTMLElement, type: CleanupType | null) {
    const badge = type !== null && getBadgeForCleanupType(type);
    button.className = badge ? badge.className : "cleanup_type_none";
    button.setAttribute("data-i18n", `${badge ? badge.i18nButton : "cleanup_type_create_button"}?title?markdown`);
    translateElement(button);
    // fixme: aria label
}

export function RuleButton({ expression, type, temporary, onConfirm }: RuleButtonProps) {
    function onChangeProxy(changedType: false | CleanupType, changedExpression: string, changedTemporary: boolean) {
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
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            temporary={temporary || false}
            onConfirm={onChangeProxy}
        />;
    }

    const button = <button onClick={onClick} />;
    updateRuleButton(button, type);
    return button;
}
