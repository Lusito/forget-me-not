/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export enum CleanupType {
    NEVER,
    STARTUP,
    LEAVE,
    INSTANTLY,
}

export interface RuleDefinition {
    rule: string;
    type: CleanupType;
    temporary?: true;
}

export interface SettingsTypeMap {
    "version": string;
    "showUpdateNotification": boolean;
    "showCookieRemovalNotification": boolean;
    "rules": RuleDefinition[];
    "whitelistNoTLD": boolean;
    "whitelistFileSystem": boolean;
    "fallbackRule": CleanupType;
    "domainsToClean": { [s: string]: boolean };
    "downloadsToClean": { [s: string]: boolean };
    "showBadge": boolean;
    "initialTab": string;
    "lastTab": string;
    "cleanAll.cookies": boolean;
    "cleanAll.cookies.applyRules": boolean;
    "cleanAll.localStorage": boolean;
    "cleanAll.localStorage.applyRules": boolean;
    "cleanAll.protectOpenDomains": boolean;
    "cleanAll.history": boolean;
    "cleanAll.history.applyRules": boolean;
    "cleanAll.downloads": boolean;
    "cleanAll.downloads.applyRules": boolean;
    "cleanAll.formData": boolean;
    "cleanAll.passwords": boolean;
    "cleanAll.indexedDB": boolean;
    "cleanAll.pluginData": boolean;
    "cleanAll.serviceWorkers": boolean;
    "cleanAll.serverBoundCertificates": boolean;
    "cleanAll.cache": boolean;

    "cleanThirdPartyCookies.enabled": boolean;
    "cleanThirdPartyCookies.delay": number;
    "cleanThirdPartyCookies.beforeCreation": boolean;

    "domainLeave.enabled": boolean;
    "domainLeave.delay": number;
    "domainLeave.cookies": boolean;
    "domainLeave.localStorage": boolean;
    "domainLeave.history": boolean;
    "domainLeave.downloads": boolean;

    "instantly.enabled": boolean;
    "instantly.cookies": boolean;
    "instantly.history": boolean;
    "instantly.history.applyRules": boolean;
    "instantly.downloads": boolean;
    "instantly.downloads.applyRules": boolean;

    "startup.enabled": boolean;
    "startup.cookies.applyRules": boolean;
    "startup.cookies": boolean;
    "startup.localStorage.applyRules": boolean;
    "startup.localStorage": boolean;
    "startup.history": boolean;
    "startup.history.applyRules": boolean;
    "startup.downloads": boolean;
    "startup.downloads.applyRules": boolean;
    "startup.formData": boolean;
    "startup.passwords": boolean;
    "startup.indexedDB": boolean;
    "startup.pluginData": boolean;
    "startup.serviceWorkers": boolean;
    "startup.serverBoundCertificates": boolean;
    "startup.cache": boolean;

    "purgeExpiredCookies": boolean;

    "logRAD.enabled": boolean;
    "logRAD.limit": number;
}

export type SettingsKey = keyof SettingsTypeMap;
export type SettingsSignature = { [T in SettingsKey]: SettingsTypeMap[T] };

export const EXPORT_IGNORE_KEYS: SettingsKey[] = ["domainsToClean", "downloadsToClean"];
