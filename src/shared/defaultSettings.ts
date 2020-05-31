import { singleton } from "tsyringe";

import { CleanupType } from "./types";
import { UnsupportedSettings } from "./unsupportedSettings";
import { ExtensionInfo } from "./extensionInfo";

export interface RuleDefinition {
    rule: string;
    type: CleanupType;
    temporary?: true;
}

export const EXPORT_IGNORE_KEYS: SettingsKey[] = [
    "domainsToClean",
    "domainsToClean.indexedDB",
    "domainsToClean.serviceWorkers",
    "domainsToClean.cache",
    "domainsToClean.pluginData",
    "downloadsToClean",
];

export type BooleanMap = { [s: string]: boolean };

@singleton()
export class DefaultSettingsProvider {
    public constructor(
        private readonly unsupported: UnsupportedSettings,
        private readonly exensionInfo: ExtensionInfo
    ) {}

    public get() {
        const defaultSettings = {
            "version": this.exensionInfo.version,
            "showUpdateNotification": true,
            "showCookieRemovalNotification": false,
            "rules": [] as RuleDefinition[],
            "whitelistNoTLD": false,
            "whitelistFileSystem": true,
            "fallbackRule": CleanupType.LEAVE,
            "domainsToClean": {} as BooleanMap,
            "domainsToClean.indexedDB": {} as BooleanMap,
            "domainsToClean.serviceWorkers": {} as BooleanMap,
            "domainsToClean.cache": {} as BooleanMap,
            "domainsToClean.pluginData": {} as BooleanMap,
            "downloadsToClean": {} as BooleanMap,
            "showBadge": true,
            "initialTab": "this_tab",
            "lastTab": "this_tab",
            "cleanAll.cookies": true,
            "cleanAll.cookies.applyRules": true,
            "cleanAll.localStorage": true,
            "cleanAll.localStorage.applyRules": true,
            "cleanAll.protectOpenDomains": true,
            "cleanAll.history": false,
            "cleanAll.history.applyRules": true,
            "cleanAll.downloads": true,
            "cleanAll.downloads.applyRules": true,
            "cleanAll.formData": false,
            "cleanAll.passwords": false,
            "cleanAll.indexedDB": true,
            "cleanAll.indexedDB.applyRules": true,
            "cleanAll.pluginData": true,
            "cleanAll.pluginData.applyRules": true,
            "cleanAll.serviceWorkers": true,
            "cleanAll.serviceWorkers.applyRules": true,
            "cleanAll.serverBoundCertificates": false,
            "cleanAll.cache": false,
            "cleanAll.cache.applyRules": true,

            "cleanThirdPartyCookies.enabled": false,
            "cleanThirdPartyCookies.delay": 60,
            "cleanThirdPartyCookies.beforeCreation": false,

            "domainLeave.enabled": false,
            "domainLeave.delay": 120,
            "domainLeave.cookies": true,
            "domainLeave.localStorage": true,
            "domainLeave.indexedDB": true,
            "domainLeave.serviceWorkers": true,
            "domainLeave.cache": true,
            "domainLeave.pluginData": true,
            "domainLeave.history": false,
            "domainLeave.downloads": false,

            "instantly.enabled": true,
            "instantly.cookies": true,
            "instantly.history": false,
            "instantly.history.applyRules": true,
            "instantly.downloads": false,
            "instantly.downloads.applyRules": true,

            "startup.enabled": false,
            "startup.cookies": true,
            "startup.cookies.applyRules": true,
            "startup.localStorage": true,
            "startup.localStorage.applyRules": true,
            "startup.protectOpenDomains": true,
            "startup.history": false,
            "startup.history.applyRules": true,
            "startup.downloads": true,
            "startup.downloads.applyRules": false,
            "startup.formData": false,
            "startup.passwords": false,
            "startup.indexedDB": true,
            "startup.indexedDB.applyRules": true,
            "startup.pluginData": true,
            "startup.pluginData.applyRules": true,
            "startup.serviceWorkers": true,
            "startup.serviceWorkers.applyRules": true,
            "startup.serverBoundCertificates": false,
            "startup.cache": false,
            "startup.cache.applyRules": true,

            "purgeExpiredCookies": false,

            "logRAD.enabled": true,
            "logRAD.limit": 20,
        };

        for (const key of this.unsupported.get()) (defaultSettings as any)[key] = false;
        return defaultSettings;
    }
}

export type SettingsSignature = ReturnType<DefaultSettingsProvider["get"]>;
export type SettingsKey = keyof SettingsSignature;
