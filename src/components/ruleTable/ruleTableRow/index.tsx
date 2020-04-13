import { h } from "tsx-dom";
import * as punycode from "punycode";

import { CleanupType } from "../../../lib/shared";
import { RuleButton } from "../../ruleButton";
import { ExtensionContext } from "../../../lib/bootstrap";

interface RuleTableRowProps {
    expression: string;
    type: CleanupType | null;
    temporary?: boolean;
    isChosen?: boolean;
    context: ExtensionContext;
}

export function RuleTableRow({ expression, type, temporary, isChosen, context }: RuleTableRowProps) {
    const punified = punycode.toUnicode(expression);
    const content = [<span>{expression}</span>];
    if (temporary) {
        content.unshift(<span>[ </span>);
        content.push(<span> ]</span>);
    }
    if (punified !== expression) content.push(<i> ({punified})</i>);
    const title = content.map((e) => e.textContent).join("");
    const classes = isChosen ? ["is-chosen-rule"] : [];
    if (expression.includes("@")) classes.push("is-cookie-rule");

    const { settings } = context;
    return (
        <tr class={classes.length ? classes.join(" ") : undefined}>
            <td title={title}>
                <div class="rules_table_row_expression">{content}</div>
            </td>
            <td>
                <RuleButton
                    expression={expression}
                    type={type}
                    temporary={temporary}
                    onConfirm={(newType, newExpression, newTemporary) =>
                        settings.setRule(newExpression, newType, newTemporary)
                    }
                    context={context}
                />
            </td>
            <td>
                <button onClick={() => settings.removeRule(expression)}>X</button>
            </td>
        </tr>
    );
}
