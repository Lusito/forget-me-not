import type { ExtensionContextWithoutSettings } from "./bootstrap";
import { CleanupType } from "./shared";

export interface RuleDefinition {
    rule: string;
    type: CleanupType;
    temporary?: true;
}

export const EXPORT_IGNORE_KEYS: SettingsKey[] = ["domainsToClean", "downloadsToClean"];

// fixme: different file?
export function getUnsupportedSettings(context: ExtensionContextWithoutSettings) {
    // fixme: cache?
    const unsupported: SettingsKey[] = context.browserInfo.mobile
        ? [
              "cleanAll.localStorage",
              "cleanAll.localStorage.applyRules",
              "startup.localStorage",
              "startup.localStorage.applyRules",
              "domainLeave.localStorage",
              "cleanAll.history.applyRules",
              "startup.history.applyRules",
              "domainLeave.history",
              "instantly.history",
              "instantly.history.applyRules",
              "cleanAll.passwords",
              "startup.passwords",
              "cleanAll.indexedDB",
              "startup.indexedDB",
              "cleanAll.pluginData",
              "startup.pluginData",
              "cleanAll.serviceWorkers",
              "startup.serviceWorkers",
          ]
        : [];

    if (!context.supports.removeLocalStorageByHostname) {
        unsupported.push("cleanAll.localStorage.applyRules");
        unsupported.push("domainLeave.localStorage");
        unsupported.push("startup.localStorage.applyRules");
    }

    return unsupported;
}

export type BooleanMap = { [s: string]: boolean };

export function createDefaultSettings(context: ExtensionContextWithoutSettings) {
    const defaultSettings = {
        "version": context.version,
        "showUpdateNotification": true,
        "showCookieRemovalNotification": false,
        "rules": [] as RuleDefinition[],
        "whitelistNoTLD": false,
        "whitelistFileSystem": true,
        "fallbackRule": CleanupType.LEAVE,
        "domainsToClean": {} as BooleanMap,
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
        "cleanAll.pluginData": true,
        "cleanAll.serviceWorkers": true,
        "cleanAll.serverBoundCertificates": false,
        "cleanAll.cache": false,

        "cleanThirdPartyCookies.enabled": false,
        "cleanThirdPartyCookies.delay": 60,
        "cleanThirdPartyCookies.beforeCreation": false,

        "domainLeave.enabled": false,
        "domainLeave.delay": 120,
        "domainLeave.cookies": true,
        "domainLeave.localStorage": true,
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
        "startup.history": false,
        "startup.history.applyRules": true,
        "startup.downloads": true,
        "startup.downloads.applyRules": false,
        "startup.formData": false,
        "startup.passwords": false,
        "startup.indexedDB": true,
        "startup.pluginData": true,
        "startup.serviceWorkers": true,
        "startup.serverBoundCertificates": false,
        "startup.cache": false,

        "purgeExpiredCookies": false,

        "logRAD.enabled": true,
        "logRAD.limit": 20,
    };
    for (const key of getUnsupportedSettings(context)) (defaultSettings as any)[key] = false;
    return defaultSettings;
}

export type SettingsSignature = ReturnType<typeof createDefaultSettings>;
export type SettingsKey = keyof SettingsSignature;
