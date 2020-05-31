// This file manages all settings, their defaults and changes

import { browser, Storage } from "webextension-polyfill-ts";
import { singleton } from "tsyringe";

import { isNodeTest } from "./browserInfo";
import { RuleDefinition, SettingsSignature, SettingsKey, DefaultSettingsProvider } from "./defaultSettings";
import { CleanupType } from "./types";
import migrateSettings from "./settingsMigrations";
import { MessageUtil } from "./messageUtil";
import { sanitizeRules } from "./ruleUtils";
import { RuleManager } from "./ruleManager";
import { someItemsMatch } from "../background/backgroundShared";

type SettingsValue = string | boolean | number | RuleDefinition[] | { [s: string]: boolean };
export type SettingsMap = { [s: string]: SettingsValue };

const RULE_MANAGER_SETTINGS = [
    "whitelistFileSystem",
    "whitelistNoTLD",
    "fallbackRule",
    "rules",
    "startup.protectOpenDomains",
    "cleanAll.protectOpenDomains",
];

@singleton()
export class Settings {
    private readonly storage: Storage.StorageArea;

    private map: SettingsMap = {};

    private readonly defaults: SettingsMap;

    public constructor(
        private readonly messageUtil: MessageUtil,
        private readonly ruleManager: RuleManager,
        defaultSettings: DefaultSettingsProvider
    ) {
        this.defaults = defaultSettings.get();
        this.storage = browser.storage.local;

        browser.storage.onChanged.addListener((changes) => {
            this.reload(changes);
        });
        messageUtil.importSettings.receive((params) => {
            this.setAll(params);
        });
    }

    public async load(changes?: { [key: string]: Storage.StorageChange }) {
        this.map = await this.storage.get(null);
        const changedKeys = Object.keys(changes || this.map);
        if (someItemsMatch(changedKeys, RULE_MANAGER_SETTINGS)) this.updateRules();
        return changedKeys;
    }

    private reload = async (changes: { [key: string]: Storage.StorageChange }) => {
        const changedKeys = await this.load(changes);
        this.messageUtil.settingsChanged.send(changedKeys); // to other background scripts
        this.messageUtil.settingsChanged.sendSelf(changedKeys); // since the above does not fire on the same process
    };

    public updateRules() {
        this.ruleManager.update({
            whitelistFileSystem: this.get("whitelistFileSystem"),
            whitelistNoTLD: this.get("whitelistNoTLD"),
            fallbackRule: this.get("fallbackRule"),
            rules: this.get("rules"),
            protectOpenDomains: {
                startup: this.get("startup.protectOpenDomains"),
                manual: this.get("cleanAll.protectOpenDomains"),
            },
        });
    }

    public async save() {
        await this.storage.set(this.map);
    }

    public async restoreDefaults() {
        this.map = {};
        this.storage.clear();
        await this.save();
    }

    public performUpgrade(previousVersion: string) {
        migrateSettings(previousVersion, this.map);
    }

    public async setAll(json: any) {
        // Validate and throw out anything that is no longer valid
        if (!json || typeof json !== "object") throw new Error("Expected settings json to be an object");
        if (json.rules) {
            if (!Array.isArray(json.rules)) delete json.rules;
            else (json as any).rules = sanitizeRules((json as any).rules as RuleDefinition[]);
        }
        for (const key of Object.keys(json)) {
            if (!(key in this.defaults)) {
                if (!isNodeTest) console.warn("Unknown setting: ", key);
                delete json[key];
            }
            if (typeof this.defaults[key] !== typeof json[key]) {
                if (!isNodeTest)
                    console.warn(
                        "Types do not match while importing setting: ",
                        key,
                        typeof this.defaults[key],
                        typeof json[key]
                    );
                delete json[key];
            }
        }

        const keysToRemove = Object.keys(this.getAll()).filter((key) => !(key in json));
        if (keysToRemove.length) await this.storage.remove(keysToRemove);

        this.map = json;
        this.performUpgrade(this.get("version"));
        this.set("version", this.defaults.version as string);
        await this.save();
    }

    public getAll() {
        const result: SettingsMap = {};
        for (const key in this.defaults) {
            if (key in this.map) result[key] = this.map[key];
            else result[key] = this.defaults[key];
        }
        return result as SettingsSignature;
    }

    public get<T extends SettingsKey>(key: T): SettingsSignature[T] {
        if (key in this.map) return this.map[key] as SettingsSignature[T];
        return this.defaults[key] as SettingsSignature[T];
    }

    public set<T extends SettingsKey>(key: T, value: SettingsSignature[T]) {
        this.map[key] = value;
    }

    public async setRule(expression: string, type: CleanupType, temporary: boolean) {
        const rules = this.get("rules").slice();
        let ruleDef = rules.find((r) => r.rule === expression);
        if (ruleDef) ruleDef.type = type;
        else {
            ruleDef = { rule: expression, type };
            rules.push(ruleDef);
        }
        if (temporary) ruleDef.temporary = true;
        else delete ruleDef.temporary;
        this.set("rules", rules);
        await this.save();
    }

    public async removeRule(expression: string) {
        const rules = this.get("rules").filter((r) => r.rule !== expression);
        this.set("rules", rules);
        await this.save();
    }

    public async removeRules(rules: string[]) {
        const remainingRules = this.get("rules").filter((r) => !rules.includes(r.rule));
        this.set("rules", remainingRules);
        await this.save();
    }

    public async removeTemporaryRules() {
        const rules = this.get("rules").filter((r) => !r.temporary);
        this.set("rules", rules);
        await this.save();
    }
}
