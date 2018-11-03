/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// This file manages all settings, their defaults and changes

import { messageUtil } from "../lib/messageUtil";
import { isFirefox, browserInfo, isNodeTest } from "./browserInfo";
import { SettingsTypeMap, SettingsSignature, RuleDefinition, RuleType } from "./settingsSignature";
import { browser, Storage } from "webextension-polyfill-ts";
import { getRegExForRule } from "./regexp";

type Callback = () => void;

type SettingsValue = string | boolean | number | (RuleDefinition[]) | { [s: string]: boolean };
export type SettingsMap = { [s: string]: SettingsValue };

export const localStorageDefault: boolean = isNodeTest || (isFirefox && browserInfo.versionAsNumber >= 58);

export const defaultSettings: SettingsMap = {
    "version": "",
    "showUpdateNotification": true,
    "showCookieRemovalNotification": false,
    "rules": [],
    "whitelistNoTLD": false,
    "whitelistFileSystem": true,
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

    "purgeExpiredCookies": false,

    "logRAD.enabled": true,
    "logRAD.limit": 20
};

const isAlNum = /^[a-z0-9]+$/;
const isAlNumDash = /^[a-z0-9\-]+$/;
const validCookieName = /^[!,#,\$,%,&,',\*,\+,\-,\.,0-9,:,;,A-Z,\\,\^,_,`,a-z,\|,~]+$/i;

function isValidExpressionPart(part: string) {
    if (part.length === 0)
        return false;
    if (part === "*")
        return true;
    return isAlNum.test(part[0]) && isAlNum.test(part[part.length - 1]) && isAlNumDash.test(part);
}

function isValidDomainExpression(exp: string) {
    const parts = exp.split(".");
    return parts.length > 0 && parts.findIndex((p) => !isValidExpressionPart(p)) === -1;
}

export function isValidExpression(exp: string) {
    const parts = exp.split("@");
    if (parts.length === 1)
        return isValidDomainExpression(exp);
    return parts.length === 2 && validCookieName.test(parts[0]) && isValidDomainExpression(parts[1]);
}

export function classNameForRuleType(ruleType: RuleType) {
    if (ruleType === RuleType.WHITE)
        return "badge_white";
    if (ruleType === RuleType.GRAY)
        return "badge_gray";
    if (ruleType === RuleType.BLOCK)
        return "badge_block";
    return "badge_forget";
}

export function ruleTypeForElement(element: HTMLElement) {
    if (element.classList.contains("badge_white"))
        return RuleType.WHITE;
    if (element.classList.contains("badge_gray"))
        return RuleType.GRAY;
    if (element.classList.contains("badge_block"))
        return RuleType.BLOCK;
    if (element.classList.contains("badge_forget"))
        return RuleType.FORGET;
    return null;
}

function isValidRuleType(ruleType: RuleType) {
    return ruleType === RuleType.WHITE || ruleType === RuleType.GRAY || ruleType === RuleType.FORGET || ruleType === RuleType.BLOCK;
}

function sanitizeRules(rules: RuleDefinition[], expressionValidator: (value: string) => boolean) {
    const validRules: RuleDefinition[] = [];
    for (const ruleDef of rules) {
        if (typeof (ruleDef.rule) === "string" && expressionValidator(ruleDef.rule) && isValidRuleType(ruleDef.type)) {
            validRules.push({
                rule: ruleDef.rule,
                type: ruleDef.type
            });
        }
    }
    return validRules;
}

interface CompiledRuleDefinition {
    definition: RuleDefinition;
    regex: RegExp;
    cookieName?: string;
}

export class Settings {
    private rules: CompiledRuleDefinition[] = [];
    private cookieRules: CompiledRuleDefinition[] = [];
    private readonly storage: Storage.StorageArea;
    private map: SettingsMap = {};
    private readyCallbacks: Callback[] | null = [];
    public constructor() {
        this.storage = browser.storage.local;
        this.load();
        this.load = this.load.bind(this);
        browser.storage.onChanged.addListener(this.load);
    }

    public destroy() {
        browser.storage.onChanged.removeListener(this.load);
    }

    public load(changes?: { [key: string]: Storage.StorageChange }) {
        this.storage.get(null).then((map) => {
            this.map = map;
            const changedKeys = Object.getOwnPropertyNames(changes || map);
            if (changedKeys.indexOf("rules") >= 0)
                this.rebuildRules();
            if (this.readyCallbacks) {
                for (const callback of this.readyCallbacks)
                    callback();
                this.readyCallbacks = null;
            }
            if (typeof (messageUtil) !== "undefined") {
                messageUtil.send("settingsChanged", changedKeys); // to other background scripts
                messageUtil.sendSelf("settingsChanged", changedKeys); // since the above does not fire on the same process
            }
        });
    }

    private rebuildRules() {
        this.rules = [];
        this.cookieRules = [];
        const rules = this.get("rules");
        for (const rule of rules) {
            const parts = rule.rule.split("@");
            const isCookieRule = parts.length === 2;
            if (isCookieRule) {
                this.cookieRules.push({
                    definition: rule,
                    regex: getRegExForRule(parts[1]),
                    cookieName: parts[0].toLowerCase()
                });
            } else {
                this.rules.push({
                    definition: rule,
                    regex: getRegExForRule(rule.rule)
                });
            }
        }
    }

    public save() {
        return this.storage.set(this.map);
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
        this.rebuildRules();
        this.save();
    }

    public setAll(json: any) {
        // Validate and throw out anything that is no longer valid
        if (typeof (json) !== "object")
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
            if (!defaultSettings.hasOwnProperty(key)) {
                if (!isNodeTest)
                    console.warn("Unknown setting: ", key);
                delete json[key];
            }
            if (typeof (defaultSettings[key]) !== typeof (json[key])) {
                if (!isNodeTest)
                    console.warn("Types do not match while importing setting: ", key, typeof (defaultSettings[key]), typeof (json[key]));
                delete json[key];
            }
        }

        const keysToRemove = Object.getOwnPropertyNames(this.getAll()).filter((key) => !json.hasOwnProperty(key));
        this.storage.remove(keysToRemove);

        this.map = json;
        this.rebuildRules();
        this.save();
        return true;
    }

    public getAll() {
        const result: SettingsMap = {};
        for (const key in defaultSettings) {
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
        if (key === "rules")
            this.rebuildRules();
    }

    // Convenience methods
    public getExactRuleType(rule: string) {
        for (const crd of this.rules) {
            if (crd.definition.rule === rule)
                return crd.definition.type;
        }
        return null;
    }

    public getMatchingRules(domain: string, cookieName: string | false = false) {
        const rules = cookieName !== false ? this.cookieRules : this.rules;
        const lowerCookieName = cookieName && cookieName.toLowerCase();
        const matchingRules: RuleDefinition[] = [];
        for (const rule of rules) {
            if (rule.regex.test(domain) && (!rule.cookieName || rule.cookieName === lowerCookieName))
                matchingRules.push(rule.definition);
        }
        return matchingRules;
    }

    public hasBlockingRule() {
        return this.get("fallbackRule") === RuleType.BLOCK || !!this.get("rules").find((r) => r.type === RuleType.BLOCK);
    }

    private getRuleTypeFromMatchingRules(matchingRules: RuleDefinition[]) {
        if (matchingRules.find((r) => r.type === RuleType.BLOCK))
            return RuleType.BLOCK;
        if (matchingRules.find((r) => r.type === RuleType.FORGET))
            return RuleType.FORGET;
        if (matchingRules.find((r) => r.type === RuleType.WHITE))
            return RuleType.WHITE;
        return RuleType.GRAY;
    }

    public getRuleTypeForCookie(domain: string, name: string) {
        if (this.get("whitelistFileSystem") && domain.length === 0)
            return RuleType.WHITE;
        if (this.get("whitelistNoTLD") && domain.indexOf(".") === -1)
            return RuleType.WHITE;
        const matchingRules = this.getMatchingRules(domain, name);
        if (matchingRules.length)
            return this.getRuleTypeFromMatchingRules(matchingRules);
        return this.getRuleTypeForDomain(domain);
    }

    public getRuleTypeForDomain(domain: string) {
        if (this.get("whitelistFileSystem") && domain.length === 0)
            return RuleType.WHITE;
        if (this.get("whitelistNoTLD") && domain.indexOf(".") === -1)
            return RuleType.WHITE;
        const matchingRules = this.getMatchingRules(domain);
        if (matchingRules.length)
            return this.getRuleTypeFromMatchingRules(matchingRules);
        return this.get("fallbackRule");
    }

    public getChosenRulesForDomain(domain: string) {
        if (this.get("whitelistFileSystem") && domain.length === 0)
            return [];
        if (this.get("whitelistNoTLD") && domain.indexOf(".") === -1)
            return [];
        const matchingRules = this.getMatchingRules(domain);
        if (matchingRules.length) {
            const types = [RuleType.BLOCK, RuleType.FORGET, RuleType.WHITE, RuleType.GRAY];
            for (const type of types) {
                const rules = matchingRules.filter((r) => r.type === type);
                if (rules.length)
                    return rules;
            }
        }
        return [];
    }

    public setRule(expression: string, type: RuleType) {
        const rules = this.get("rules").slice();
        const ruleDef = rules.find((r) => r.rule === expression);
        if (ruleDef)
            ruleDef.type = type;
        else
            rules.push({ rule: expression, type });
        this.set("rules", rules);
        this.save();
    }

    public removeRule(expression: string) {
        const rules = this.get("rules").filter((r) => r.rule !== expression);
        this.set("rules", rules);
        this.save();
    }
}
export const settings = new Settings();
