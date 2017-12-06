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
import { CookieDomainInfo } from './background/backgroundShared';
import { RuleListItem } from './ruleListItem';

const allowedProtocols = /https?:/;
const removeLocalStorageByHostname = isFirefox && parseFloat(browserInfo.version) >= 58;

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
    private rulesListItems: RuleListItem[] = [];
    private matchingRulesListItems: RuleListItem[] = [];
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
        on(byId('rules_add') as HTMLElement, 'click', () => this.addRule(RuleType.WHITE));

        translateChildren(document.body);
        messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
            if (changedKeys.length > 1 || changedKeys.indexOf('domainsToClean') === -1)
                updateFromSettings();
            if (changedKeys.indexOf('rules') !== -1) {
                this.rebuildRulesList();
                this.rebuildMatchingRulesList();
            }
        });

        let recentCookieDomainsList = byId('most_recent_cookie_domains') as HTMLElement;
        messageUtil.receive('onMostRecentCookieDomains', (domains: CookieDomainInfo[]) => {
            removeAllChildren(recentCookieDomainsList);
            for (const info of domains) {
                let li = createElement(document, recentCookieDomainsList, 'li');
                createElement(document, li, 'span', { textContent: browser.i18n.getMessage(info.badge), className: info.badge });
                createElement(document, li, 'span', { textContent: info.domain, title: info.domain });
                let addRule = createElement(document, li, 'span', { textContent: browser.i18n.getMessage('button_log_add_rule'), className: 'log_add_rule' });
                on(addRule, 'click', () => this.prepareAddRule(info.domain));
            }
        });

        messageUtil.send('getMostRecentCookieDomains');
    }

    private prepareAddRule(domain: string) {
        this.rulesInput.value = "*." + domain;
        this.selectTab(2);
        let value = this.rulesInput.value.trim().toLowerCase();
        let validExpression = isValidExpression(value);
        this.updateRulesHint(validExpression, value.length === 0);
        this.updateFilter();
        this.rulesInput.focus();
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
                    let addRule = byId('current_tab_add_rule');
                    if (addRule)
                        on(addRule, 'click', () => this.prepareAddRule(url.hostname));
                    this.rebuildMatchingRulesList();
                }
            } else {
                this.setInvalidTab();
            }
        });
    }

    private onImport() {
        // desktop firefox closes popup when dialog is shown
        if (isFirefox && !browserInfo.mobile)
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
        dialog.contentNode.setAttribute('data-i18n', 'reset_dialog_content');
        dialog.buttonNodes.confirm_settings_only.focus();
        translateChildren(dialog.domNode);
    }

    private updateRulesHint(validExpression: boolean, empty: boolean) {
        this.rulesHint.textContent = empty ? '' : browser.i18n.getMessage(validExpression ? 'rules_hint_add' : 'rules_hint_invalid');
        this.rulesHint.className = validExpression ? '' : 'error';
    }

    private addRule(type: RuleType) {
        let value = this.rulesInput.value.trim().toLowerCase();
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

    private onRulesInputKeyUp(e: KeyboardEvent) {
        let value = this.rulesInput.value.trim().toLowerCase();
        let validExpression = isValidExpression(value);
        this.updateRulesHint(validExpression, value.length === 0);
        if (e.keyCode === 13)
            this.addRule(e.shiftKey ? RuleType.GRAY : RuleType.WHITE);
        this.updateFilter();
    }

    private updateFilter() {
        let value = this.rulesInput.value.trim().toLowerCase();
        if (value.length === 0) {
            for (const detail of this.rulesListItems)
                detail.itemNode.style.display = '';
        }
        else {
            for (const detail of this.rulesListItems) {
                let visible = detail.ruleDef.rule.indexOf(value) !== -1;
                detail.itemNode.style.display = visible ? '' : 'none';
            }
        }
    }

    private rebuildMatchingRulesList() {
        if (this.hostname) {
            let matchingRules = settings.getMatchingRules(this.hostname);
            let list = byId('rules_list_current_tab') as HTMLElement;
            this.matchingRulesListItems = this.rebuildRulesListEx(this.matchingRulesListItems, matchingRules, list);
        }
    }

    private rebuildRulesList() {
        const rules = settings.get('rules').slice();
        for (const rule of rules)
            rule.rule = rule.rule.toLowerCase();
        rules.sort(sortByRule);
        let newItems = this.rebuildRulesListEx(this.rulesListItems, rules, this.rulesList);
        if (newItems !== this.rulesListItems) {
            this.rulesListItems = newItems;
            this.updateFilter();
        }
    }

    private rebuildRulesListEx(previousItems: RuleListItem[], rules: RuleDefinition[], parent: HTMLElement) {
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

    private selectTab(index: number) {
        let tabs = document.querySelectorAll('#tabs > div');
        let pages = document.querySelectorAll('#pages > div');
        if (index > 0 && index < tabs.length && index < pages.length)
            this.updateSelectedTab(index);
    }

    private updateSelectedTab(index: number) {
        for (let i = 0; i < this.tabs.length; i++) {
            if(i === index) {
                this.tabs[i].classList.add('active');
                this.pages[i].classList.add('active');
            } else {
                this.tabs[i].classList.remove('active');
                this.pages[i].classList.remove('active');
            }
        }
    }

    private linkTab(index: number) {
        on(this.tabs[index], 'click', () => this.updateSelectedTab(index));
    }

}

settings.onReady(() => new Popup());
