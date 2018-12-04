import { h } from "tsx-dom";
import { CleanupType } from "../../lib/settingsSignature";
import { getBadgeForCleanupType } from "../../background/backgroundHelpers";
import { translateElement } from "../../lib/htmlUtils";
import { RuleDialog } from "../dialogs/ruleDialog";
import { cleanupTypeForElement } from "../../lib/settings";

interface RuleButtonProps {
    expression?: string;
    type: CleanupType | null;
    allowRemove?: boolean;
    onConfirm: (type: CleanupType, expression: string) => void;
}

function updateRuleButton(button: HTMLElement, type: CleanupType | null, translate = false) {
    const badge = type !== null && getBadgeForCleanupType(type);
    button.className = badge ? badge.className : "cleanup_type_none";
    button.setAttribute("data-i18n", (badge ? badge.i18nButton : "cleanup_type_create_button") + "?title?markdown");
    translateElement(button);
    // fixme: aria label
}

export function RuleButton({ expression, type, onConfirm }: RuleButtonProps) {
    function onChangeProxy(type: CleanupType) {
        updateRuleButton(button, type, true);
        onConfirm(type, expression || "");
    }

    function onClick() {
        <RuleDialog expression={expression} editable={type === null} focusType={cleanupTypeForElement(button)} onConfirm={(type) => type !== false && onChangeProxy(type)} />;
    }

    const button = <button onClick={onClick} />;
    updateRuleButton(button, type);
    return button;
}
