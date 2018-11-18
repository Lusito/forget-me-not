/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../../lib/settings";
import { BrowsingData } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getAllCookieStoreIds } from "../backgroundHelpers";
import { cleanLocalStorage, removeLocalStorageByHostname } from "../backgroundShared";
import { CleanupType } from "../../lib/settingsSignature";
import { TabWatcher } from "../tabWatcher";

export class LocalStorageCleaner extends Cleaner {
    private readonly tabWatcher: TabWatcher;

    public constructor(tabWatcher: TabWatcher) {
        super();
        this.tabWatcher = tabWatcher;
    }

    public clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.localStorage && removeLocalStorageByHostname) {
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            if (settings.get(startup ? "startup.localStorage.applyRules" : "cleanAll.localStorage.applyRules")) {
                typeSet.localStorage = false;
                getAllCookieStoreIds().then((ids) => {
                    const hostnames = this.getDomainsToClean(startup, protectOpenDomains);
                    for (const id of ids)
                        cleanLocalStorage(hostnames, id);
                });
            } else {
                settings.set("domainsToClean", {});
                settings.save();
            }
        }
    }

    public cleanDomainOnLeave(storeId: string, domain: string): void {
        if (settings.get("domainLeave.enabled") && settings.get("domainLeave.localStorage") && !this.isLocalStorageProtected(storeId, domain))
            cleanLocalStorage([domain], storeId);
    }

    public cleanDomain(storeId: string, domain: string): void {
        cleanLocalStorage([domain], storeId);
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean): boolean {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain))
            return true;
        return settings.isDomainProtected(domain, ignoreStartupType);
    }

    private getDomainsToClean(ignoreStartupType: boolean, protectOpenDomains: boolean): string[] {
        const domainsToClean = settings.get("domainsToClean");
        const result = [];
        for (const domain in domainsToClean) {
            if (domainsToClean.hasOwnProperty(domain) && !this.isDomainProtected(domain, ignoreStartupType, protectOpenDomains))
                result.push(domain);
        }
        return result;
    }

    public isLocalStorageProtected(storeId: string, domain: string): boolean {
        if (this.tabWatcher.cookieStoreContainsDomain(storeId, domain))
            return true;
        const type = settings.getCleanupTypeForDomain(domain);
        return type === CleanupType.NEVER || type === CleanupType.STARTUP;
    }
}
