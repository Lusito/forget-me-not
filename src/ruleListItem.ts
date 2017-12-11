/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { settings, RuleType, RuleDefinition } from "./lib/settings";
import { on, createElement } from './lib/htmlUtils';

function classNameForRuleType(ruleType: RuleType) {
    if(ruleType === RuleType.WHITE)
        return 'badge_white';
    if(ruleType === RuleType.GRAY)
        return 'badge_gray';
    return 'badge_forget';
}
export class RuleListItem {
    public readonly labelNode: HTMLElement;
    public ruleDef: RuleDefinition;
    public readonly itemNode: HTMLElement;
    public readonly selectNode: HTMLSelectElement;
    public constructor(ruleDef: RuleDefinition, parent: HTMLElement) {
        this.ruleDef = ruleDef;
        this.itemNode = createElement(document, parent, 'li');
        this.labelNode = createElement(document, this.itemNode, 'div', { textContent: ruleDef.rule, title: ruleDef.rule });
        let label = createElement(document, this.itemNode, 'label', { className: 'type_column' });
        this.selectNode = createElement(document, label, 'select', { className: classNameForRuleType(ruleDef.type) });
        createElement(document, this.selectNode, 'option', { className: 'badge_white', value: RuleType.WHITE, textContent: browser.i18n.getMessage('setting_type_white') });
        createElement(document, this.selectNode, 'option', { className: 'badge_gray', value: RuleType.GRAY, textContent: browser.i18n.getMessage('setting_type_gray') });
        createElement(document, this.selectNode, 'option', { className: 'badge_forget', value: RuleType.FORGET, textContent: browser.i18n.getMessage('setting_type_forget') });
        this.selectNode.value = ruleDef.type.toString();
        let button = createElement(document, this.itemNode, 'button', { textContent: 'X', className: 'delete_column' });

        on(this.selectNode, 'change', () => {
            let rules = settings.get('rules').slice();
            let rule = rules.find((r) => r.rule === this.ruleDef.rule);
            if (rule) {
                rule.type = parseInt(this.selectNode.value);
                this.selectNode.className = classNameForRuleType(rule.type);
                settings.set('rules', rules);
                settings.save();
            }
        });
        on(button, 'click', () => {
            let rules = settings.get('rules').slice();
            let index = rules.findIndex((r) => r.rule === this.ruleDef.rule);
            if (index !== -1) {
                rules.splice(index, 1);
                settings.set('rules', rules);
                settings.save();
            }
        });
    }

    public isRule(ruleDef: RuleDefinition) {
        return this.ruleDef.rule === ruleDef.rule;
    }

    public updateRule(ruleDef: RuleDefinition) {
        this.ruleDef = ruleDef;
        this.selectNode.value = ruleDef.type.toString();
        this.selectNode.className = classNameForRuleType(ruleDef.type);
        this.labelNode.textContent = ruleDef.rule;
        this.labelNode.title = ruleDef.rule;
    }
}
