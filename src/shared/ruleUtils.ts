import { RuleDefinition } from "./defaultSettings";
import { CleanupType } from "./types";
import { isValidExpression } from "./expressionUtils";

export interface CompiledRuleDefinition {
    definition: RuleDefinition;
    regex: RegExp;
    cookieName?: string;
    storeId?: string;
    error?: string;
}

export function cleanupTypeForElement(element: HTMLElement) {
    if (element.classList.contains("cleanup_type_never")) return CleanupType.NEVER;
    if (element.classList.contains("cleanup_type_startup")) return CleanupType.STARTUP;
    if (element.classList.contains("cleanup_type_leave")) return CleanupType.LEAVE;
    if (element.classList.contains("cleanup_type_instantly")) return CleanupType.INSTANTLY;
    return null;
}

function isValidCleanupType(type: CleanupType) {
    return (
        type === CleanupType.NEVER ||
        type === CleanupType.STARTUP ||
        type === CleanupType.LEAVE ||
        type === CleanupType.INSTANTLY
    );
}

export function sanitizeRules(rules: RuleDefinition[]) {
    const validRules: RuleDefinition[] = [];
    for (const ruleDef of rules) {
        if (typeof ruleDef.rule === "string" && isValidExpression(ruleDef.rule) && isValidCleanupType(ruleDef.type)) {
            validRules.push({
                rule: ruleDef.rule,
                type: ruleDef.type,
            });
        }
    }
    return validRules;
}

export const matchCookie = (cookie: string) => (rule: CompiledRuleDefinition) => rule.cookieName === cookie;
export const matchNoCookie = (rule: CompiledRuleDefinition) => !rule.cookieName;
export const matchStore = (storeId: string) => (rule: CompiledRuleDefinition) => rule.storeId === storeId;
export const matchStoreOrNoStore = (storeId: string) => (rule: CompiledRuleDefinition) =>
    !rule.storeId || rule.storeId === storeId;
export const matchNoStore = (rule: CompiledRuleDefinition) => !rule.storeId;
export const matchDomain = (domain: string) => (rule: CompiledRuleDefinition) => rule.regex.test(domain);
export const toRuleDefinition = (rule: CompiledRuleDefinition) => rule.definition;
