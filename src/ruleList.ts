/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings, isValidExpression } from "./lib/settings";
import { on, byId, removeAllChildren } from './lib/htmlUtils';
import * as messageUtil from "./lib/messageUtil";
import { RuleListItem } from './ruleListItem';
import { browser } from "webextension-polyfill-ts";
import { RuleDefinition, RuleType } from "./lib/settingsSignature";

function sortByRule(a: RuleDefinition, b: RuleDefinition) {
    if (a.rule < b.rule)
        return -1;
    else if (a.rule > b.rule)
        return 1;
    return 0;
}

export function recreateRuleListItems(previousItems: RuleListItem[], rules: RuleDefinition[], parent: HTMLElement) {
    if (rules.length === previousItems.length) {
        let changed = false;
        for (let i = 0; i < rules.length; i++) {
            let item = previousItems[i];
            let rule = rules[i];
            if (item.isRule(rule))
                item.updateRule(rule);
            else {
                changed = true;
                break;
            }
        }
        if (!changed)
            return previousItems;
    }

    let newItems: RuleListItem[] = [];
    removeAllChildren(parent);
    for (let rule of rules)
        newItems.push(new RuleListItem(rule, parent));
    return newItems;
}

export class RuleList {
    private hint: HTMLElement;
    private input: HTMLInputElement;
    private items: RuleListItem[] = [];
    private list: HTMLElement;

    public constructor(inputId: string, listId: string, hintId: string, addId: string) {
        this.input = byId(inputId) as HTMLInputElement;
        on(this.input, 'keyup', this.onRulesInputKeyUp.bind(this));
        this.list = byId(listId) as HTMLElement;
        this.hint = byId(hintId) as HTMLElement;
        this.rebuildRulesList();
        messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
            if (changedKeys.indexOf('rules') !== -1)
                this.rebuildRulesList();
        });
        on(byId(addId) as HTMLElement, 'click', () => this.addRule(RuleType.WHITE));
    }

    public setInput(value: string) {
        this.input.value = value;
        let validExpression = isValidExpression(value);
        this.updateRulesHint(validExpression, value.length === 0);
        this.updateFilter();
        this.input.focus();
    }

    private onRulesInputKeyUp(e: KeyboardEvent) {
        let value = this.input.value.trim().toLowerCase();
        let validExpression = isValidExpression(value);
        this.updateRulesHint(validExpression, value.length === 0);
        if (e.keyCode === 13)
            this.addRule(e.shiftKey ? RuleType.GRAY : RuleType.WHITE);
        this.updateFilter();
    }

    private updateFilter() {
        let value = this.input.value.trim().toLowerCase();
        if (value.length === 0) {
            for (const detail of this.items)
                detail.itemNode.style.display = '';
        }
        else {
            for (const detail of this.items) {
                let visible = detail.ruleDef.rule.indexOf(value) !== -1;
                detail.itemNode.style.display = visible ? '' : 'none';
            }
        }
    }

    private addRule(type: RuleType) {
        let value = this.input.value.trim().toLowerCase();
        if (isValidExpression(value)) {
            let rules = settings.get('rules').slice();
            let entry = rules.find((r) => r.rule === value);
            if (entry)
                entry.type = type;
            else {
                rules.push({
                    type: type,
                    rule: value
                });
            }
            settings.set('rules', rules);
            settings.save();
        }
    }

    private updateRulesHint(validExpression: boolean, empty: boolean) {
        this.hint.textContent = empty ? '' : browser.i18n.getMessage(validExpression ? 'rules_hint_add' : 'rules_hint_invalid');
        this.hint.className = validExpression ? '' : 'error';
    }

    private rebuildRulesList() {
        const rules = settings.get('rules').slice();
        for (const rule of rules)
            rule.rule = rule.rule.toLowerCase();
        rules.sort(sortByRule);
        let newItems = recreateRuleListItems(this.items, rules, this.list);
        if (newItems !== this.items) {
            this.items = newItems;
            this.updateFilter();
        }
    }
}
