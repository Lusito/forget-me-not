import { h } from "tsx-dom";
import { RuleType } from "../../lib/settingsSignature";
import { getBadgeForRuleType } from "../../background/backgroundHelpers";
import { translateElement } from "../../lib/htmlUtils";
import { RuleDialog } from "../dialogs/ruleDialog";
import { ruleTypeForElement } from "../../lib/settings";

interface RuleButtonProps {
    expression?: string;
    type: RuleType | null;
    allowRemove?: boolean;
    onConfirm: (badge: RuleType, expression?: string) => void;
}

function updateRuleButton(button: HTMLElement, type: RuleType | null, translate = false) {
    const badge = type !== null && getBadgeForRuleType(type);
    button.className = badge ? badge.i18nKey : "badge_none";
    button.setAttribute("data-i18n", (badge ? badge.i18nKeyLong : "setting_type_create") + "?title?markdown");
    translateElement(button);
    // fixme: aria label
}

export function RuleButton({ expression, type, onConfirm }: RuleButtonProps) {
    function onChangeProxy(type: RuleType) {
        updateRuleButton(button, type, true);
        onConfirm(type, expression);
    }

    function onClick() {
        <RuleDialog expression={expression} focusRule={ruleTypeForElement(button)} onConfirm={(type) => type !== false && onChangeProxy(type)} />;
    }

    const button = <button onClick={onClick} />;
    updateRuleButton(button, type);
    return button;
}
