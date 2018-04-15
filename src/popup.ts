/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings, RuleType, RuleDefinition, isValidExpression } from "./lib/settings";
import { on, byId, createElement, removeAllChildren, translateChildren, makeLinkOpenAsTab } from './lib/htmlUtils';
import { isFirefox, browserInfo } from './lib/browserInfo';
import { connectSettings, permanentDisableSettings, updateFromSettings } from './lib/htmlSettings';
import * as messageUtil from "./lib/messageUtil";
import { loadJSONFile, saveJSONFile } from './lib/fileHelper';
import * as dialogs from './lib/dialogs';
import { CookieDomainInfo, getValidHostname } from './shared';
import { RuleListItem, setupRuleSelect, classNameForRuleType } from './ruleListItem';
import { browser } from "webextension-polyfill-ts";
import { TabSupport } from "./lib/tabSupport";
import * as punycode from "punycode";

const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

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
    private tabSupport = new TabSupport(this.onTabChange.bind(this));
    public constructor() {
        if (browserInfo.mobile)
            (document.querySelector('html') as HTMLHtmlElement).className = 'fullscreen';

        const fallbackRuleSelect = document.querySelector('#fallbackRule') as HTMLSelectElement;
        setupRuleSelect(fallbackRuleSelect, settings.get('fallbackRule'));
        on(fallbackRuleSelect, 'change', () => {
            settings.set('fallbackRule', parseInt(fallbackRuleSelect.value));
            settings.save();
        });

        connectSettings(document.body);
        if (!removeLocalStorageByHostname) {
            permanentDisableSettings([
                'cleanAll.localStorage.applyRules',
                'domainLeave.localStorage',
                'startup.localStorage.applyRules'
            ], true);
        }

        const initialTab = settings.get('initialTab');
        if (!initialTab || initialTab === 'last_active_tab')
            this.tabSupport.setTab(settings.get('lastTab'));
        else
            this.tabSupport.setTab(initialTab);

        this.initCurrentTab();
        this.initSnoozeButton();

        on(byId('clean_all_now') as HTMLElement, 'click', () => messageUtil.send('cleanAllNow'));

        this.rulesInput = byId('rules_input') as HTMLInputElement;
        on(this.rulesInput, 'keyup', this.onRulesInputKeyUp.bind(this));
        this.rulesList = byId('rules_list') as HTMLElement;
        this.rulesHint = byId('rules_hint') as HTMLElement;
        this.rebuildRulesList();
        on(byId('settings_import') as HTMLElement, 'click', this.onImport.bind(this));
        on(byId('settings_export') as HTMLElement, 'click', this.onExport.bind(this));
        on(byId('settings_reset') as HTMLElement, 'click', this.onReset.bind(this));
        on(byId('rules_add') as HTMLElement, 'click', () => this.addRule(RuleType.WHITE));
        let links = document.querySelectorAll('a.open_as_tab');
        for (let i = 0; i < links.length; i++)
            makeLinkOpenAsTab(links[i] as HTMLAnchorElement);

        translateChildren(document.body);
        messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
            if (changedKeys.length > 1 || changedKeys.indexOf('domainsToClean') === -1)
                updateFromSettings();
            if (changedKeys.indexOf('rules') !== -1) {
                this.rebuildRulesList();
                this.rebuildMatchingRulesList();
            }
            if (changedKeys.indexOf('fallbackRule') !== -1)
                fallbackRuleSelect.className = classNameForRuleType(settings.get('fallbackRule'));
        });

        let recentlyAccessedDomainsList = byId('recently_accessed_domains') as HTMLElement;
        messageUtil.receive('onRecentlyAccessedDomains', (domains: CookieDomainInfo[]) => {
            removeAllChildren(recentlyAccessedDomainsList);
            for (const info of domains) {
                let li = createElement(document, recentlyAccessedDomainsList, 'li');
                createElement(document, li, 'span', { textContent: browser.i18n.getMessage(info.badge), className: info.badge });
                const punified = this.appendPunycode(info.domain);
                createElement(document, li, 'span', { textContent: punified, title: punified });
                let addRule = createElement(document, li, 'span', { textContent: browser.i18n.getMessage('button_log_add_rule'), className: 'log_add_rule' });
                on(addRule, 'click', () => this.prepareAddRule(info.domain));
            }
        });

        messageUtil.send('getRecentlyAccessedDomains');
    }

    private appendPunycode(domain: string) {
        const punified = punycode.toUnicode(domain);
        return (punified === domain) ? domain : `${domain} (${punified})`;
    }

    private onTabChange(name: string) {
        settings.set('lastTab', name);
        settings.save();
    }

    private prepareAddRule(domain: string) {
        this.rulesInput.value = "*." + domain;
        this.tabSupport.setTab('rules');
        let value = this.rulesInput.value.trim().toLowerCase();
        let validExpression = isValidExpression(value);
        this.updateRulesHint(validExpression, value.length === 0);
        this.updateFilter();
        this.rulesInput.focus();
    }

    setCurrentTabLabel(domain: string | false) {
        let label = byId('current_tab');
        if (label)
            label.textContent = domain ? domain : browser.i18n.getMessage('invalid_tab');
        let labelPunnified = byId('current_tab_punyfied');
        if (labelPunnified) {
            let punnified = '';
            if (domain) {
                punnified = domain ? punycode.toUnicode(domain) : '';
                punnified = (punnified === domain) ? '' : `(${punnified})`;
            }
            labelPunnified.textContent = punnified;
        }
    }

    private setInvalidTab() {
        this.setCurrentTabLabel(false);
        let cleanCurrentTab = byId('clean_current_tab');
        if (cleanCurrentTab)
            cleanCurrentTab.style.display = 'none';
        if (this.tabSupport.getTab() === 'this_tab')
            this.tabSupport.setTab('clean_all');
    }

    private initCurrentTab() {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const tab = tabs.length && tabs[0];
            if (tab && tab.url && !tab.incognito) {
                const hostname = getValidHostname(tab.url);
                let cleanCurrentTab = byId('clean_current_tab');
                if (!hostname) {
                    this.setInvalidTab();
                } else {
                    this.hostname = hostname;
                    this.setCurrentTabLabel(hostname);
                    if (cleanCurrentTab) {
                        on(cleanCurrentTab, 'click', () => {
                            messageUtil.send('cleanUrlNow', { hostname: this.hostname, cookieStoreId: tab.cookieStoreId });
                        });
                    }
                    let addRule = byId('current_tab_add_rule');
                    if (addRule)
                        on(addRule, 'click', () => this.prepareAddRule(hostname));
                    this.rebuildMatchingRulesList();
                }
            } else {
                this.setInvalidTab();
            }
        });
    }

    private initSnoozeButton() {
        let toggleSnooze = byId('toggle_snooze') as HTMLButtonElement;
        toggleSnooze.disabled = true;
        on(toggleSnooze, 'click', () => {
            toggleSnooze.disabled = true;
            messageUtil.send('toggleSnoozingState');
        });
        messageUtil.receive('onSnoozingState', (snoozing: boolean) => {
            toggleSnooze.disabled = false;
            toggleSnooze.textContent = browser.i18n.getMessage('button_toggle_snooze_' + snoozing);
        });
        messageUtil.send('getSnoozingState');
    }

    private onImport() {
        // desktop firefox closes popup when dialog is shown
        if (isFirefox && !browserInfo.mobile) {
            browser.tabs.create({
                url: browser.runtime.getURL('views/import.html'),
                active: true
            });
            window.close();
        } else {
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
                    rules: settings.get('rules'),
                    fallbackRule: settings.get('fallbackRule'),
                    whitelistNoTLD: settings.get('whitelistNoTLD')
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

}

settings.onReady(() => new Popup());
