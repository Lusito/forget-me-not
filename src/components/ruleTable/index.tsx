import { h } from "tsx-dom";
import { RuleTableRow } from "./ruleTableRow";
import { getDomain } from "tldjs";
import { settings } from "../../lib/settings";
import { removeAllChildren, translateChildren, on } from "../../lib/htmlUtils";
import { messageUtil } from "../../lib/messageUtil";
import { wetLayer } from "wet-layer";
import { RuleDefinition } from "../../lib/settingsSignature";
import "./style.scss";

interface RuleTableProps {
    headerI18n: string;
    forDomain?: string;
    filterInput?: HTMLInputElement;
}

function sortByRule(a: RuleDefinition, b: RuleDefinition) {
    if (a.rule < b.rule)
        return -1;
    else if (a.rule > b.rule)
        return 1;
    return 0;
}

function rebuildRows(tbody: HTMLElement, forDomain?: string, filterInput?: HTMLInputElement) {
    // fixme: rather than recreate, update existing dom-nodes
    removeAllChildren(tbody);
    let rules: RuleDefinition[];
    let chosenRulesForDomain: RuleDefinition[];
    if (forDomain) {
        chosenRulesForDomain = settings.getChosenRulesForDomain(forDomain);
        const domainFP = getDomain(forDomain) || forDomain;
        const domains = ["*." + domainFP];
        if (domainFP !== forDomain)
            domains.push("*." + forDomain);
        domains.forEach((rule) => {
            const isChosen = chosenRulesForDomain.some((r) => r.rule === rule);
            tbody.appendChild(<RuleTableRow rule={rule} isChosen={isChosen} type={settings.getExactRuleType(rule)} />);
        });

        rules = settings.getMatchingRules(forDomain).filter((rule) => domains.indexOf(rule.rule) === -1);
    } else {
        chosenRulesForDomain = [];
        rules = settings.get("rules").slice();
    }

    for (const rule of rules)
        rule.rule = rule.rule.toLowerCase();
    rules.sort(sortByRule);
    rules.forEach((rule) => {
        const isChosen = chosenRulesForDomain.some((r) => r.rule === rule.rule);
        tbody.appendChild(<RuleTableRow rule={rule.rule} isChosen={isChosen} type={rule.type} />);
    });

    translateChildren(tbody);
    applyFilter(tbody, filterInput);
}

function applyFilter(tbody: HTMLElement, filterInput?: HTMLInputElement) {
    if (filterInput) {
        const value = filterInput.value.trim().toLowerCase();
        for (const tr of tbody.querySelectorAll("tr")) {
            const visible = !value || tr.textContent && tr.textContent.indexOf(value) !== -1;
            tr.classList.toggle("is-filtered", !visible);
        }
    }
    updateIsNotEmpty(tbody);
}

function updateIsNotEmpty(tbody: HTMLElement) {
    tbody.className = tbody.querySelector("tr:not(.is-filtered)") ? "is-not-empty" : "";
}

export function RuleTable({ headerI18n, forDomain, filterInput }: RuleTableProps) {
    const tbody = <tbody aria-live="polite" />;

    messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
        if (changedKeys.indexOf("rules") !== -1)
            rebuildRows(tbody, forDomain, filterInput);
    });
    wetLayer.addListener(() => rebuildRows(tbody, forDomain, filterInput));
    rebuildRows(tbody, forDomain, filterInput);

    if (filterInput)
        on(filterInput, "input", () => applyFilter(tbody, filterInput));

    const className = "rules_table" + (forDomain ? " rules_table_for_domain" : "");

    return <table class={className}>
        <thead>
            <tr>
                <th data-i18n={headerI18n} />
                <th data-i18n="rules_column_type" class="rules_column_type" />
                <th />
            </tr>
        </thead>
        {tbody}
        <tbody class="no_entries_label">
            <tr><td colSpan={3} data-i18n="rules_no_entries"></td></tr>
        </tbody>
    </table>;
}
