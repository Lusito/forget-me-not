/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings, isValidExpression, isValidCookieExpression } from "./lib/settings";
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
import { RuleList, recreateRuleListItems } from "./ruleList";

const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

class Popup {
    //@ts-ignore
    private readonly cookieRuleList: RuleList;
    private readonly ruleList: RuleList;
    private hostname?: string;
    private matchingRulesListItems: RuleListItem[] = [];
    private readonly mainTabSupport = new TabSupport(byId('mainTabContainer') as HTMLElement, this.onTabChange.bind(this));
    private readonly rulesTabSupport = new TabSupport(byId('rulesTabContainer') as HTMLElement);
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
            this.mainTabSupport.setTab(settings.get('lastTab'));
        else
            this.mainTabSupport.setTab(initialTab);

        this.initCurrentTab();
        this.initSnoozeButton();

        on(byId('clean_all_now') as HTMLElement, 'click', () => messageUtil.send('cleanAllNow'));

        this.ruleList = new RuleList('rules_input', 'rules_list', 'rules_hint', 'rules_add', 'rules', isValidExpression);
        this.cookieRuleList = new RuleList('cookie_rules_input', 'cookie_rules_list', 'cookie_rules_hint', 'cookie_rules_add', 'cookieRules', isValidCookieExpression);
        on(byId('settings_import') as HTMLElement, 'click', this.onImport.bind(this));
        on(byId('settings_export') as HTMLElement, 'click', this.onExport.bind(this));
        on(byId('settings_reset') as HTMLElement, 'click', this.onReset.bind(this));
        let links = document.querySelectorAll('a.open_as_tab');
        for (let i = 0; i < links.length; i++)
            makeLinkOpenAsTab(links[i] as HTMLAnchorElement);

        translateChildren(document.body);
        messageUtil.receive('settingsChanged', (changedKeys: string[]) => {
            if (changedKeys.length > 1 || changedKeys.indexOf('domainsToClean') === -1)
                updateFromSettings();
            if (changedKeys.indexOf('rules') !== -1)
                this.rebuildMatchingRulesList();
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
        this.ruleList.setInput("*." + domain.trim().toLowerCase());
        this.mainTabSupport.setTab('rules');
        this.rulesTabSupport.setTab('main_rules');
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
        if (this.mainTabSupport.getTab() === 'this_tab')
            this.mainTabSupport.setTab('clean_all');
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


    private rebuildMatchingRulesList() {
        if (this.hostname) {
            let matchingRules = settings.getMatchingRules(this.hostname);
            let list = byId('rules_list_current_tab') as HTMLElement;
            this.matchingRulesListItems = recreateRuleListItems(this.matchingRulesListItems, matchingRules, list, 'rules');
        }
    }
}

settings.onReady(() => new Popup());
