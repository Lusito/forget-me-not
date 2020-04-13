import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";

import { ExtensionContext } from "../../lib/bootstrap";
import { isValidExpression } from "../../lib/expressionUtils";
import { on } from "../../frontend/htmlUtils";
import "./style.scss";

interface ExpressionHintProps {
    input: HTMLInputElement;
    context: ExtensionContext;
}

export function ExpressionHint({ input, context: { settings } }: ExpressionHintProps) {
    const hint = <div class="expression_hint" />;

    function updateError(error: string) {
        hint.textContent = error;
        const isError = error.length > 0;
        hint.classList.toggle("error", isError);
        input.classList.toggle("error", isError);
        input.setAttribute("aria-invalid", isError.toString());
        if (isError) hint.setAttribute("role", "alert");
        else hint.removeAttribute("role");
    }

    function validate() {
        const expression = input.value.trim().toLowerCase();
        const validExpression = !expression || isValidExpression(expression);
        if (!validExpression) updateError(wetLayer.getMessage("expression_hint_invalid"));
        else if (settings.getExactRuleDefinition(expression) !== null)
            updateError(wetLayer.getMessage("expression_hint_exists"));
        else updateError("");
    }
    on(input, "input", validate);
    validate();
    return hint;
}
