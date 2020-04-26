import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import { container } from "tsyringe";

import { isValidExpression } from "../../shared/expressionUtils";
import { on } from "../../frontend/htmlUtils";
import { Settings } from "../../shared/settings";
import "./style.scss";

interface ExpressionHintProps {
    input: HTMLInputElement;
}

export function ExpressionHint({ input }: ExpressionHintProps) {
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

    const settings = container.resolve(Settings);
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
