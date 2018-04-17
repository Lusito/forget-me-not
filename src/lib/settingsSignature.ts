/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */
import { RuleDefinition, RuleType } from "./settings";

export interface SettingsTypeMap {
    "version": string;
    "showUpdateNotification": boolean;
    "showCookieRemovalNotification": boolean,
    "rules": RuleDefinition[],
    "whitelistNoTLD": boolean;
    "fallbackRule": RuleType;
    "domainsToClean": { [s: string]: boolean },
    "showBadge": boolean,
    "initialTab": string,
    "lastTab": string,
    "cleanAll.cookies": boolean;
    "cleanAll.cookies.applyRules": boolean;
    "cleanAll.localStorage": boolean;
    "cleanAll.localStorage.applyRules": boolean;
    "cleanAll.protectOpenDomains": boolean;
    "cleanAll.history": boolean;
    "cleanAll.downloads": boolean;
    "cleanAll.formData": boolean;
    "cleanAll.passwords": boolean;
    "cleanAll.indexedDB": boolean;
    "cleanAll.pluginData": boolean;
    "cleanAll.serviceWorkers": boolean;
    "cleanAll.serverBoundCertificates": boolean;

    "cleanThirdPartyCookies.enabled": boolean,
    "cleanThirdPartyCookies.delay": number,
    "cleanThirdPartyCookies.beforeCreation": boolean,

    "domainLeave.enabled": boolean;
    "domainLeave.delay": number;
    "domainLeave.cookies": boolean;
    "domainLeave.localStorage": boolean;

    "startup.enabled": boolean;
    "startup.cookies.applyRules": boolean;
    "startup.cookies": boolean;
    "startup.localStorage.applyRules": boolean;
    "startup.localStorage": boolean;
    "startup.history": boolean;
    "startup.downloads": boolean;
    "startup.formData": boolean;
    "startup.passwords": boolean;
    "startup.indexedDB": boolean;
    "startup.pluginData": boolean;
    "startup.serviceWorkers": boolean;
    "startup.serverBoundCertificates": boolean;

    "logRAD.enabled": boolean;
    "logRAD.limit": number;
}

export type SettingsSignature = { [K in keyof SettingsTypeMap]: SettingsTypeMap[K] };
