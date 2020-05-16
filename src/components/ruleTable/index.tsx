import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import { container } from "tsyringe";

import { RuleTableRow } from "./ruleTableRow";
import { removeAllChildren, translateChildren, on } from "../../frontend/htmlUtils";
import { RuleDefinition } from "../../shared/defaultSettings";
import "./style.scss";
import { Settings } from "../../shared/settings";
import { MessageUtil } from "../../shared/messageUtil";
import { DomainAndStore } from "../../shared/types";
import { RuleManager } from "../../shared/ruleManager";
import { getFirstPartyDomain } from "../../shared/domainUtils";

interface RuleTableProps {
    headerI18n: string;
    ruleFilter?: DomainAndStore;
    filterInput?: HTMLInputElement;
}

function sortByRule(a: RuleDefinition, b: RuleDefinition) {
    if (a.rule < b.rule) return -1;
    if (a.rule > b.rule) return 1;
    return 0;
}

function rebuildRows(tbody: HTMLElement, ruleFilter?: DomainAndStore, filterInput?: HTMLInputElement) {
    // fixme: rather than recreate, update existing dom-nodes
    removeAllChildren(tbody);
    let rules: RuleDefinition[];
    let chosenRulesForDomain: RuleDefinition[];
    const settings = container.resolve(Settings);
    if (ruleFilter) {
        const ruleManager = container.resolve(RuleManager);
        const { domain, storeId } = ruleFilter;
        chosenRulesForDomain = ruleManager.getChosenRulesForDomain(domain, storeId);
        const domainFP = getFirstPartyDomain(domain);
        const expressions = [`*.${domainFP}`];
        if (domainFP !== domain) expressions.push(`*.${ruleFilter}`);
        expressions.forEach((expression) => {
            const chosenRule = chosenRulesForDomain.find((r) => r.rule === expression);
            const temporary = chosenRule?.temporary || false;
            tbody.appendChild(
                <RuleTableRow
                    expression={expression}
                    isChosen={!!chosenRule}
                    type={ruleManager.getExactCleanupType(expression)}
                    temporary={temporary}
                />
            );
        });

        rules = ruleManager.getRulesForDomain(domain, storeId).filter((rule) => !expressions.includes(rule.rule));
    } else {
        chosenRulesForDomain = [];
        rules = settings.get("rules").slice();
    }

    for (const rule of rules) rule.rule = rule.rule.toLowerCase();
    rules.sort(sortByRule);
    rules.forEach((rule) => {
        const isChosen = chosenRulesForDomain.some((r) => r.rule === rule.rule);
        tbody.appendChild(
            <RuleTableRow expression={rule.rule} isChosen={isChosen} type={rule.type} temporary={rule.temporary} />
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

export function RuleTable({ headerI18n, ruleFilter, filterInput }: RuleTableProps) {
    const tbody = <tbody aria-live="polite" />;

    const messageUtil = container.resolve(MessageUtil);
    messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
        if (changedKeys.includes("rules")) rebuildRows(tbody, ruleFilter, filterInput);
    });
    wetLayer.addListener(() => rebuildRows(tbody, ruleFilter, filterInput));
    rebuildRows(tbody, ruleFilter, filterInput);

    if (filterInput) on(filterInput, "input", () => applyFilter(tbody, filterInput));

    const className = `rules_table${ruleFilter ? " rules_table_for_domain" : ""}`;

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
