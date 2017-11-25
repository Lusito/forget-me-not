/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { settings, RuleType, RuleDefinition } from "./lib/settings";
import { on, createElement } from './lib/htmlUtils';

export class RuleListItem {
    public readonly labelNode: HTMLElement;
    public ruleDef: RuleDefinition;
    public readonly itemNode: HTMLElement;
    public readonly inputNode: HTMLInputElement;
    public constructor(ruleDef: RuleDefinition, parent: HTMLElement) {
        this.ruleDef = ruleDef;
        this.itemNode = createElement(document, parent, 'li');
        this.labelNode = createElement(document, this.itemNode, 'div', { textContent: ruleDef.rule, title: ruleDef.rule });
        let label = createElement(document, this.itemNode, 'label', { className: 'ruleSwitch type_column' });
        this.inputNode = createElement(document, label, 'input', { type: 'checkbox', checked: ruleDef.type === RuleType.WHITE }) as HTMLInputElement;
        let div = createElement(document, label, 'div', { className: 'ruleSlider' });
        createElement(document, div, 'span', { className: 'whitelist', textContent: browser.i18n.getMessage('setting_type_white') });
        createElement(document, div, 'span', { className: 'graylist', textContent: browser.i18n.getMessage('setting_type_gray') });
        let button = createElement(document, this.itemNode, 'button', { textContent: 'X', className: 'delete_column' });

        on(this.inputNode, 'click', () => {
            let rules = settings.get('rules').slice();
            let rule = rules.find((r) => r.rule === this.ruleDef.rule);
            if (rule) {
                rule.type = this.inputNode.checked ? RuleType.WHITE : RuleType.GRAY;
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
        this.inputNode.checked = ruleDef.type === RuleType.WHITE;
        this.labelNode.textContent = ruleDef.rule;
        this.labelNode.title = ruleDef.rule;
    }
}
