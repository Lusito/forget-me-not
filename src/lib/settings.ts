/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// This file manages all settings, their defaults and changes

import * as browser from 'webextension-polyfill';
import * as messageUtil from "./messageUtil";
import { isFirefox, browserInfo } from "./browserInfo";
import { SettingsTypeMap, SettingsSignature } from "./settingsSignature";

type Callback = () => void;

export enum RuleType {
    WHITE,
    GRAY
}
export interface RuleDefinition {
    rule: string,
    type: RuleType
}

type SettingsValue = string | boolean | number | (RuleDefinition[]) | { [s: string]: boolean };
type SettingsMap = { [s: string]: SettingsValue };

const localStorageDefault: boolean = isFirefox && parseFloat(browserInfo.version) >= 58;

const defaultSettings: SettingsMap = {
    "rules": [],
    "domainsToClean": {},
    "cleanAll.cookies": true,
    "cleanAll.cookies.applyRules": true,
    "cleanAll.localStorage": localStorageDefault,
    "cleanAll.localStorage.applyRules": localStorageDefault,
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
    "startup.serverBoundCertificates": false
};

const isAlNum = /^[a-z0-9]+$/;
const isAlNumDash = /^[a-z0-9\-]+$/;

export function isValidExpressionPart(part: string) {
    if (part.length === 0)
        return false;
    if (part === '*')
        return true;
    return isAlNum.test(part[0]) && isAlNum.test(part[part.length - 1]) && isAlNumDash.test(part);
}
export function isValidExpression(exp: string) {
    const parts = exp.split('.');
    return parts.length > 0 && parts.findIndex((p) => !isValidExpressionPart(p)) === -1;
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

class Settings {
    private storage: browser.storage.StorageArea;
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

    private load(changes?: { [key: string]: browser.storage.StorageChange }) {
        this.storage.get(null).then((map) => {
            this.map = map;
            if (this.readyCallbacks) {
                for (let callback of this.readyCallbacks)
                    callback();
                this.readyCallbacks = null;
            }
            if (typeof (messageUtil) !== 'undefined') {
                let changedKeys = Object.getOwnPropertyNames(changes || map);
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
            else {
                let validRules: RuleDefinition[] = [];
                for (const ruleDef of (json as any).rules as RuleDefinition[]) {
                    if (typeof (ruleDef.rule) !== 'string')
                        continue;
                    if (isValidExpression(ruleDef.rule) && (ruleDef.type === RuleType.WHITE || ruleDef.type === RuleType.GRAY)) {
                        validRules.push({
                            rule: ruleDef.rule,
                            type: ruleDef.type
                        });
                    }
                }
                (json as any).rules = validRules;
            }
        }
        for (const key in json) {
            if (!json.hasOwnProperty(key))
                continue;
            if (!defaultSettings.hasOwnProperty(key) || typeof (defaultSettings[key]) !== typeof (json[key])) {
                console.warn('Could not import setting: ', key);
                delete json[key];
            }
        }

        let keysToRemove = Object.getOwnPropertyNames(settings.getAll()).filter((key) => !json.hasOwnProperty(key));
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
    public getMatchingRules(domain: string) {
        let rules = settings.get('rules');
        let matchingRules: RuleDefinition[] = [];
        for (const rule of rules) {
            let re = getRegExForRule(rule.rule);
            if (re.test(domain))
                matchingRules.push(rule);
        }
        return matchingRules;
    }
}
export const settings = new Settings();
