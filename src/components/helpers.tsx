import { h } from "tsx-dom";
import * as punycode from "punycode";
import { isValidExpression, settings } from "../lib/settings";
import { CleanupType } from "../lib/settingsSignature";
import { RuleDialog } from "./dialogs/ruleDialog";

export function appendPunycode(domain: string) {
    const punified = punycode.toUnicode(domain);
    return (punified === domain) ? domain : `${domain} (${punified})`;
}

export function getSuggestedRuleExpression(domain: string, cookieName?: string) {
    if (cookieName)
        return `${cookieName.toLowerCase()}@${domain.startsWith(".") ? `*${domain}` : domain}`;
    return domain.startsWith(".") ? `*${domain}` : `*.${domain}`;
}

export function showAddRuleDialog(expression: string, next?: () => void) {
    if (isValidExpression(expression)) {
        function onConfirm(type: CleanupType | false, expression?: string) {
            if (expression && type !== false) {
                settings.setRule(expression, type);
                next && next();
            }
        }
        let focusType = settings.getExactCleanupType(expression);
        if (focusType === null)
            focusType = CleanupType.NEVER;
        <RuleDialog expression={expression} editable={true} focusType={focusType} onConfirm={onConfirm} />;
    }
}
