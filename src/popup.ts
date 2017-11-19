/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { settings, RuleType, RuleDefinition, isValidExpression } from "./lib/settings";
import { on, byId, createElement, removeAllChildren, translateChildren } from './lib/htmlUtils';
import { isFirefox, browserInfo } from './lib/browserInfo';
import { connectSettings, permanentDisableSettings, updateFromSettings } from './lib/htmlSettings';
import * as messageUtil from "./lib/messageUtil";
import { loadJSONFile, saveJSONFile } from './lib/fileHelper';
import * as dialogs from './lib/dialogs';

const allowedProtocols = /https?:/;
const removeLocalStorageByHostname = isFirefox && parseFloat(browserInfo.version) >= 58;
// hello.com
interface RulesListDetail {
    itemNode: HTMLElement;
    inputNode: HTMLInputElement;
    ruleDef: RuleDefinition;
}

function sortByRule(a: RuleDefinition, b: RuleDefinition) {
    if (a.rule < b.rule)
        return -1;
    else if (a.rule > b.rule)
        return 1;
    return 0;
}

class Popup {
    private hostname?: string;
    private rulesHint: HTMLElement;
    private rulesInput: HTMLInputElement;
    private rulesListDetails: RulesListDetail[];
    private rulesList: HTMLElement;
    private pages: NodeListOf<Element>;
    private tabs: NodeListOf<Element>;
    public constructor() {
        browser;
        if (isFirefox)
            document.body.className += " firefox";

        this.tabs = document.querySelectorAll('#tabs > div');
        this.pages = document.querySelectorAll('#pages > div');
        for (let i = 0; i < this.tabs.length; i++)
            this.linkTab(i);

        connectSettings(document.body);
        if (!removeLocalStorageByHostname) {
            permanentDisableSettings([
                'cleanAll.localStorage.applyRules',
                'domainLeave.localStorage',
                'startup.localStorage.applyRules'
            ], true);
        }

        this.initCurrentTab();

        this.rulesInput = byId('rules_input') as HTMLInputElement;
        on(this.rulesInput, 'keyup', this.onRulesInputKeyUp.bind(this));
        this.rulesList = byId('rules_list') as HTMLElement;
        this.rulesHint = byId('rules_hint') as HTMLElement;
        this.rebuildRulesList();
        on(byId('settings_import') as HTMLElement, 'click', this.onImport.bind(this));
        on(byId('settings_export') as HTMLElement, 'click', this.onExport.bind(this));
        on(byId('settings_reset') as HTMLElement, 'click', this.onReset.bind(this));

        translateChildren(document.body);
        messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
            if (changedKeys.length > 1 || changedKeys.indexOf('domainsToClean') === -1)
                updateFromSettings();
            if (changedKeys.indexOf('rules') !== -1) {
                this.rebuildRulesList();
                this.rebuildMatchingRules();
            }
        });
    }

    private setInvalidTab() {
        let label = byId('current_tab');
        if (label)
            label.textContent = browser.i18n.getMessage('invalid_tab');
        let cleanCurrentTab = byId('clean_current_tab');
        if (cleanCurrentTab)
            cleanCurrentTab.style.display = 'none';
        this.selectTab(1);
    }

    private initCurrentTab() {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            let cleanAllNow = byId('clean_all_now');
            if (cleanAllNow)
                on(cleanAllNow, 'click', () => messageUtil.send('cleanAllNow'));

            let tab = tabs.length && tabs[0];
            if (tab && tab.url && !tab.incognito) {
                let url = new URL(tab.url);
                let label = byId('current_tab');
                let cleanCurrentTab = byId('clean_current_tab');
                if (!allowedProtocols.test(url.protocol)) {
                    this.setInvalidTab();
                } else {
                    this.hostname = url.hostname;
                    if (label)
                        label.textContent = this.hostname;
                    if (cleanCurrentTab) {
                        on(cleanCurrentTab, 'click', () => {
                            messageUtil.send('cleanUrlNow', this.hostname);
                        });
                    }
                    this.rebuildMatchingRules();
                }
            } else {
                this.setInvalidTab();
            }
        });
    }

    private rebuildMatchingRules() {
        if (this.hostname) {
            let matchingRules = settings.getMatchingRules(this.hostname);
            let list = byId('rules_list_current_tab') as HTMLElement;
            removeAllChildren(list);
            for (const rule of matchingRules)
                this.createRuleListItem(rule, list);
        }
    }

    private onImport() {
        if (isFirefox)
            messageUtil.send('import');
        else {
            loadJSONFile((json) => {
                if (json && settings.setAll(json)) {
                    console.log('success');
                }
            });
        }
    }

    private onExport() {
        saveJSONFile(settings.getAll(), 'forget-me-not-settings.json');
    }

    private onReset() {
        let dialog = dialogs.createDialog('confirm', 'reset_dialog_title', {
            'confirm_settings_and_rules': () => {
                dialog.close();
                settings.setAll({
                    domainsToClean: settings.get('domainsToClean')
                });
            },
            'confirm_settings_only': () => {
                dialog.close();
                settings.setAll({
                    domainsToClean: settings.get('domainsToClean'),
                    rules: settings.get('rules')
                });
            },
            'confirm_cancel': () => {
                dialog.close();
            }
        });
        dialog.contentNode.setAttribute('data-l10n-id', 'reset_dialog_content');
        dialog.buttonNodes.confirm_settings_only.focus();
        translateChildren(dialog.domNode);
    }

    private onRulesInputKeyUp(e: KeyboardEvent) {
        let value = this.rulesInput.value.trim().toLowerCase();
        let validExpression = isValidExpression(value);
        this.rulesHint.textContent = value.length === 0 ? ''
            : browser.i18n.getMessage(validExpression ? 'rules_hint_add' : 'rules_hint_invalid');
        if (e.keyCode === 13) {
            if (validExpression) {
                let rules = settings.get('rules').slice();
                let entry = rules.find((r) => r.rule === value);
                const type: RuleType = e.shiftKey ? RuleType.GRAY : RuleType.WHITE;
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
        this.updateFilter();
    }

    private updateFilter() {
        let value = this.rulesInput.value.trim().toLowerCase();
        if (value.length === 0) {
            for (const detail of this.rulesListDetails)
                detail.itemNode.style.display = '';
        }
        else {
            for (const detail of this.rulesListDetails) {
                let visible = detail.ruleDef.rule.indexOf(value) !== -1;
                detail.itemNode.style.display = visible ? '' : 'none';
            }
        }
    }

    private rebuildRulesList() {
        const rules = settings.get('rules').slice();
        for (const rule of rules)
            rule.rule = rule.rule.toLowerCase();
        rules.sort(sortByRule);
        removeAllChildren(this.rulesList);
        this.rulesListDetails = [];

        for (const rule of rules)
            this.rulesListDetails.push(this.createRuleListItem(rule, this.rulesList));
        this.updateFilter();
    }

    private createRuleListItem(rule: RuleDefinition, parent: HTMLElement) {
        let li = createElement(document, parent, 'li');
        createElement(document, li, 'div', { textContent: rule.rule });
        let label = createElement(document, li, 'label', { className: 'ruleSwitch type_column' });
        let input = createElement(document, label, 'input', { type: 'checkbox', checked: rule.type === RuleType.WHITE }) as HTMLInputElement;
        let div = createElement(document, label, 'div', { className: 'ruleSlider' });
        createElement(document, div, 'span', { className: 'whitelist', textContent: browser.i18n.getMessage('setting_type_white') });
        createElement(document, div, 'span', { className: 'graylist', textContent: browser.i18n.getMessage('setting_type_gray') });
        let button = createElement(document, li, 'button', { textContent: 'X', className: 'delete_column' });
        const entry = {
            itemNode: li,
            inputNode: input as HTMLInputElement,
            ruleDef: rule
        };
        on(input, 'click', () => {
            let rules = settings.get('rules').slice();
            let rule = rules.find((r) => r.rule === entry.ruleDef.rule);
            if (rule) {
                rule.type = input.checked ? RuleType.WHITE : RuleType.GRAY;
                settings.set('rules', rules);
                settings.save();
            }
        });
        on(button, 'click', () => {
            let rules = settings.get('rules').slice();
            let index = rules.findIndex((r) => r.rule === entry.ruleDef.rule);
            if (index !== -1) {
                rules.splice(index, 1);
                settings.set('rules', rules);
                settings.save();
            }
        });
        return entry;
    }

    private selectTab(index: number) {
        let tabs = document.querySelectorAll('#tabs > div');
        let pages = document.querySelectorAll('#pages > div');
        if (index > 0 && index < tabs.length && index < pages.length)
            this.updateSelectedTab(index);
    }

    private updateSelectedTab(index: number) {
        for (let i = 0; i < this.tabs.length; i++) {
            let className = i === index ? 'active' : '';
            this.tabs[i].className = className;
            this.pages[i].className = className;
        }
    }

    private linkTab(index: number) {
        on(this.tabs[index], 'click', () => this.updateSelectedTab(index));
    }

}

settings.onReady(() => new Popup());
