import { h } from "tsx-dom";
import { getDomain } from "tldjs";
import { wetLayer } from "wet-layer";

import { RuleTableRow } from "./ruleTableRow";
import { removeAllChildren, translateChildren, on } from "../../frontend/htmlUtils";
import { messageUtil } from "../../lib/messageUtil";
import { RuleDefinition } from "../../lib/defaultSettings";
import "./style.scss";
import { ExtensionContext } from "../../lib/bootstrap";

interface RuleTableProps {
    headerI18n: string;
    forDomain?: string;
    filterInput?: HTMLInputElement;
    context: ExtensionContext;
}

function sortByRule(a: RuleDefinition, b: RuleDefinition) {
    if (a.rule < b.rule) return -1;
    if (a.rule > b.rule) return 1;
    return 0;
}

function rebuildRows(
    context: ExtensionContext,
    tbody: HTMLElement,
    forDomain?: string,
    filterInput?: HTMLInputElement
) {
    // fixme: rather than recreate, update existing dom-nodes
    removeAllChildren(tbody);
    let rules: RuleDefinition[];
    let chosenRulesForDomain: RuleDefinition[];
    const { settings } = context;
    if (forDomain) {
        chosenRulesForDomain = settings.getChosenRulesForDomain(forDomain);
        const domainFP = getDomain(forDomain) || forDomain;
        const expressions = [`*.${domainFP}`];
        if (domainFP !== forDomain) expressions.push(`*.${forDomain}`);
        expressions.forEach((expression) => {
            const chosenRule = chosenRulesForDomain.find((r) => r.rule === expression);
            const temporary = chosenRule?.temporary || false;
            tbody.appendChild(
                <RuleTableRow
                    expression={expression}
                    isChosen={!!chosenRule}
                    type={settings.getExactCleanupType(expression)}
                    temporary={temporary}
                    context={context}
                />
            );
        });

        rules = settings.getRulesForDomain(forDomain).filter((rule) => !expressions.includes(rule.rule));
    } else {
        chosenRulesForDomain = [];
        rules = settings.get("rules").slice();
    }

    for (const rule of rules) rule.rule = rule.rule.toLowerCase();
    rules.sort(sortByRule);
    rules.forEach((rule) => {
        const isChosen = chosenRulesForDomain.some((r) => r.rule === rule.rule);
        tbody.appendChild(
            <RuleTableRow
                expression={rule.rule}
                isChosen={isChosen}
                type={rule.type}
                temporary={rule.temporary}
                context={context}
            />
        );
    });

    translateChildren(tbody);
    applyFilter(tbody, filterInput);
}

function applyFilter(tbody: HTMLElement, filterInput?: HTMLInputElement) {
    if (filterInput) {
        const value = filterInput.value.trim().toLowerCase();
        for (const tr of tbody.querySelectorAll("tr")) {
            const visible = !value || (tr.textContent && tr.textContent.includes(value));
            tr.classList.toggle("is-filtered", !visible);
        }
    }
    updateIsNotEmpty(tbody);
}

function updateIsNotEmpty(tbody: HTMLElement) {
    tbody.className = tbody.querySelector("tr:not(.is-filtered)") ? "is-not-empty" : "";
}

export function RuleTable({ headerI18n, forDomain, filterInput, context }: RuleTableProps) {
    const tbody = <tbody aria-live="polite" />;

    messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
        if (changedKeys.includes("rules")) rebuildRows(context, tbody, forDomain, filterInput);
    });
    wetLayer.addListener(() => rebuildRows(context, tbody, forDomain, filterInput));
    rebuildRows(context, tbody, forDomain, filterInput);

    if (filterInput) on(filterInput, "input", () => applyFilter(tbody, filterInput));

    const className = `rules_table${forDomain ? " rules_table_for_domain" : ""}`;

    return (
        <table class={className}>
            <thead>
                <tr>
                    <th data-i18n={headerI18n} />
                    <th data-i18n="rules_column_type" class="rules_column_type" />
                    <th />
                </tr>
            </thead>
            {tbody}
            <tbody class="no_entries_label">
                <tr>
                    <td colSpan={3} data-i18n="rules_no_entries" />
                </tr>
            </tbody>
        </table>
    );
}
