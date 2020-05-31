import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import { container } from "tsyringe";
import { browser } from "webextension-polyfill-ts";

import { isValidExpression, splitExpression } from "../../shared/expressionUtils";
import { on } from "../../frontend/htmlUtils";
import { RuleManager } from "../../shared/ruleManager";
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

    async function init() {
        const contextualIdentities = (await browser.contextualIdentities.query({})).map((ci) => ci.name.toLowerCase());
        const ruleManager = container.resolve(RuleManager);
        function validate() {
            const expression = input.value.trim().toLowerCase();
            if (!expression) updateError("");
            else {
                const validExpression = isValidExpression(expression);
                if (!validExpression) updateError(wetLayer.getMessage("expression_hint_invalid"));
                else {
                    const split = splitExpression(expression);
                    if (split.container && !contextualIdentities.includes(split.container))
                        updateError(wetLayer.getMessage("expression_hint_invalid_container"));
                    else if (ruleManager.getExactRuleDefinition(expression) !== null)
                        updateError(wetLayer.getMessage("expression_hint_exists"));
                    else updateError("");
                }
            }
        }
        on(input, "input", validate);
        validate();
    }
    init();
    return hint;
}
