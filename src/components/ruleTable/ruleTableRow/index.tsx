import { h } from "tsx-dom";
import { RuleType } from "../../../lib/settingsSignature";
import { RuleButton } from "../../ruleButton";
import * as punycode from "punycode";
import { settings } from "../../../lib/settings";

interface RuleTableRowProps {
    rule: string;
    type: RuleType | null;
    isChosen?: boolean;
}

export function RuleTableRow({ rule, type, isChosen }: RuleTableRowProps) {
    const punified = punycode.toUnicode(rule);
    const content = [<span>{rule}</span>];
    if (punified !== rule)
        content.push(<i> ({punified})</i>);
    const title = content.map((e) => e.textContent).join("");

    return <tr class={isChosen ? "is-selected" : undefined}>
        <td title={title}><div class="rules_table_row_expression">{content}</div></td>
        <td><RuleButton expression={rule} type={type} onConfirm={(newType) => settings.setRule(rule, newType)} /></td>
        <td><button onClick={() => settings.removeRule(rule)}>X</button></td>
    </tr>;
}
