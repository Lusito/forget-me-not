import { h } from "tsx-dom";
import { CleanupType } from "../../../lib/settingsSignature";
import { RuleButton } from "../../ruleButton";
import * as punycode from "punycode";
import { settings } from "../../../lib/settings";

interface RuleTableRowProps {
    expression: string;
    type: CleanupType | null;
    isChosen?: boolean;
}

export function RuleTableRow({ expression, type, isChosen }: RuleTableRowProps) {
    const punified = punycode.toUnicode(expression);
    const content = [<span>{expression}</span>];
    if (punified !== expression)
        content.push(<i> ({punified})</i>);
    const title = content.map((e) => e.textContent).join("");

    return <tr class={isChosen ? "is-selected" : undefined}>
        <td title={title}><div class="rules_table_row_expression">{content}</div></td>
        <td><RuleButton expression={expression} type={type} onConfirm={(newType, updatedExpression) => settings.setRule(updatedExpression, newType)} /></td>
        <td><button onClick={() => settings.removeRule(expression)}>X</button></td>
    </tr>;
}
