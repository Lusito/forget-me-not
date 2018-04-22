/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// This file manages all settings, their defaults and changes
// fixme: make this file unit-testable and add tests

import * as messageUtil from "./messageUtil";
import { isFirefox, browserInfo } from "./browserInfo";
import { SettingsTypeMap, SettingsSignature, RuleDefinition, RuleType } from "./settingsSignature";
import { browser, Storage } from "webextension-polyfill-ts";

type Callback = () => void;

type SettingsValue = string | boolean | number | (RuleDefinition[]) | { [s: string]: boolean };
type SettingsMap = { [s: string]: SettingsValue };

const localStorageDefault: boolean = isFirefox && browserInfo.versionAsNumber >= 58;

const defaultSettings: SettingsMap = {
    "version": "",
    "showUpdateNotification": true,
    "showCookieRemovalNotification": false,
    "rules": [],
    "whitelistNoTLD": false,
    "fallbackRule": RuleType.FORGET,
    "domainsToClean": {},
    "showBadge": true,
    "initialTab": "this_tab",
    "lastTab": "this_tab",
    "cleanAll.cookies": true,
    "cleanAll.cookies.applyRules": true,
    "cleanAll.localStorage": localStorageDefault,
    "cleanAll.localStorage.applyRules": localStorageDefault,
    "cleanAll.protectOpenDomains": true,
    "cleanAll.history": false,
    "cleanAll.downloads": true,
    "cleanAll.formData": false,
    "cleanAll.passwords": false,
    "cleanAll.indexedDB": true,
    "cleanAll.pluginData": true,
    "cleanAll.serviceWorkers": true,
    "cleanAll.serverBoundCertificates": false,

    "cleanThirdPartyCookies.enabled": false,
    "cleanThirdPartyCookies.delay": 1,
    "cleanThirdPartyCookies.beforeCreation": false,

    "domainLeave.enabled": false,
    "domainLeave.delay": 2,
    "domainLeave.cookies": true,
    "domainLeave.localStorage": localStorageDefault,

    "startup.enabled": false,
    "startup.cookies": true,
    "startup.cookies.applyRules": true,
    "startup.localStorage": localStorageDefault,
    "startup.localStorage.applyRules": localStorageDefault,
    "startup.history": false,
    "startup.downloads": true,
    "startup.formData": false,
    "startup.passwords": false,
    "startup.indexedDB": true,
    "startup.pluginData": true,
    "startup.serviceWorkers": true,
    "startup.serverBoundCertificates": false,

    "logRAD.enabled": true,
    "logRAD.limit": 20
};

const isAlNum = /^[a-z0-9]+$/;
const isAlNumDash = /^[a-z0-9\-]+$/;
const validCookieName = /^[!,#,\$,%,&,',\*,\+,\-,\.,0-9,:,;,A-Z,\\,\^,_,`,a-z,\|,~]+$/i;

function isValidExpressionPart(part: string) {
    if (part.length === 0)
        return false;
    if (part === '*')
        return true;
    return isAlNum.test(part[0]) && isAlNum.test(part[part.length - 1]) && isAlNumDash.test(part);
}

function isValidDomainExpression(exp: string) {
    const parts = exp.split('.');
    return parts.length > 0 && parts.findIndex((p) => !isValidExpressionPart(p)) === -1;
}

export function isValidExpression(exp: string) {
    const parts = exp.split('@');
    if (parts.length === 1)
        return isValidDomainExpression(exp);
    return parts.length === 2 && validCookieName.test(parts[0]) && isValidDomainExpression(parts[1]);
}

function isValidRuleType(ruleType: RuleType) {
    return ruleType === RuleType.WHITE || ruleType === RuleType.GRAY || ruleType === RuleType.FORGET || ruleType === RuleType.BLOCK;
}

function getRegExForRule(rule: string) {
    let parts = rule.split('.');
    let reParts = [];
    if (parts[0] === '*') {
        reParts.push('(^|\.)');
        parts.shift();
    } else {
        reParts.push('^');
    }
    for (const part of parts) {
        if (part === '*')
            reParts.push('.*');
        else
            reParts.push(part);
        reParts.push('.');
    }
    if (reParts[reParts.length - 1] === '.')
        reParts.pop();
    return new RegExp(reParts.join(''));
}

function sanitizeRules(rules: RuleDefinition[], expressionValidator: (value: string) => boolean) {
    let validRules: RuleDefinition[] = [];
    for (const ruleDef of rules) {
        if (typeof (ruleDef.rule) === 'string' && expressionValidator(ruleDef.rule) && isValidRuleType(ruleDef.type)) {
            validRules.push({
                rule: ruleDef.rule,
                type: ruleDef.type
            });
        }
    }
}

interface CompiledRuleDefinition {
    definition: RuleDefinition;
    regex: RegExp;
    cookieName?: string;
}

class Settings {
    private rules: CompiledRuleDefinition[] = [];
    private cookieRules: CompiledRuleDefinition[] = [];
    private storage: Storage.StorageArea;
    private map: SettingsMap = {};
    private readyCallbacks: Callback[] | null = [];
    public constructor() {
        //firefox sync is broken, not sure how to test against this exact problem, for now, always use local storage on firefox
        if (isFirefox) {
            this.storage = browser.storage.local;
        } else {
            this.storage = browser.storage.sync || browser.storage.local;
        }

        this.load();
        browser.storage.onChanged.addListener(this.load.bind(this));
    }

    private load(changes?: { [key: string]: Storage.StorageChange }) {
        this.storage.get(null).then((map) => {
            this.map = map;
            let changedKeys = Object.getOwnPropertyNames(changes || map);
            if (changedKeys.indexOf('rules')) {
                this.rules = [];
                this.cookieRules = [];
                let rules = this.get('rules');
                for (const rule of rules) {
                    const parts = rule.rule.split('@');
                    const isCookieRule = parts.length === 2;
                    if (isCookieRule) {
                        this.cookieRules.push({
                            definition: rule,
                            regex: getRegExForRule(parts[1]),
                            cookieName: parts[0]
                        });
                    } else {
                        this.rules.push({
                            definition: rule,
                            regex: getRegExForRule(rule.rule)
                        });
                    }
                }
            }
            if (this.readyCallbacks) {
                for (let callback of this.readyCallbacks)
                    callback();
                this.readyCallbacks = null;
            }
            if (typeof (messageUtil) !== 'undefined') {
                messageUtil.send('settingsChanged', changedKeys); // to other background scripts
                messageUtil.sendSelf('settingsChanged', changedKeys); // since the above does not fire on the same process
            }
        });
    }

    public save() {
        this.storage.set(this.map);
    }

    public onReady(callback: Callback) {
        if (this.readyCallbacks)
            this.readyCallbacks.push(callback);
        else
            callback();
    }

    public restoreDefaults() {
        this.map = {};
        this.storage.clear();
    }

    public setAll(json: any) {
        // Validate and throw out anything that is no longer valid
        if (typeof (json) !== 'object')
            return false;
        if (json.rules) {
            if (!Array.isArray(json.rules))
                delete json.rules;
            else
                (json as any).rules = sanitizeRules((json as any).rules as RuleDefinition[], isValidExpression);
        }
        for (const key in json) {
            if (!json.hasOwnProperty(key))
                continue;
            if (!defaultSettings.hasOwnProperty(key) || typeof (defaultSettings[key]) !== typeof (json[key])) {
                console.warn('Could not import setting: ', key);
                delete json[key];
            }
        }

        let keysToRemove = Object.getOwnPropertyNames(this.getAll()).filter((key) => !json.hasOwnProperty(key));
        this.storage.remove(keysToRemove);

        this.map = json;
        this.save();
        return true;
    }

    public getAll() {
        let result: SettingsMap = {};
        for (let key in defaultSettings) {
            if (this.map.hasOwnProperty(key))
                result[key] = this.map[key];
            else
                result[key] = defaultSettings[key];
        }
        return result as SettingsSignature;
    }

    public get<K extends keyof SettingsTypeMap>(key: K): SettingsTypeMap[K] {
        if (this.map.hasOwnProperty(key))
            return this.map[key] as SettingsTypeMap[K];
        return defaultSettings[key] as SettingsTypeMap[K];
    }

    public set<K extends keyof SettingsTypeMap>(key: K, value: SettingsTypeMap[K]) {
        this.map[key] = value;
    }

    // Convenience methods
    public getMatchingRules(domain: string, cookieName: string | false = false) {
        const rules = cookieName !== false ? this.cookieRules : this.rules;
        let lowerCookieName = cookieName && cookieName.toLowerCase();
        let matchingRules: RuleDefinition[] = [];
        for (const rule of rules) {
            if (rule.regex.test(domain) && (!rule.cookieName || rule.cookieName.toLowerCase() === lowerCookieName))
                matchingRules.push(rule.definition);
        }
        return matchingRules;
    }

    public hasBlockingRule() {
        return this.get('fallbackRule') === RuleType.BLOCK || !!this.get('rules').find((r) => r.type === RuleType.BLOCK);
    }
}
export const settings = new Settings();
