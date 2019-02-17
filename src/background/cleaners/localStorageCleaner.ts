/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../../lib/settings";
import { BrowsingData, browser } from "webextension-polyfill-ts";
import { Cleaner } from "./cleaner";
import { getAllCookieStoreIds } from "../backgroundHelpers";
import { removeLocalStorageByHostname } from "../backgroundShared";
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
                        this.cleanDomains(id, hostnames);
                });
            } else {
                settings.set("domainsToClean", {});
                settings.save();
            }
        }
    }

    public cleanDomainOnLeave(storeId: string, domain: string): void {
        if (settings.get("domainLeave.enabled") && settings.get("domainLeave.localStorage") && !this.isLocalStorageProtected(storeId, domain))
            this.cleanDomains(storeId, [domain]);
    }

    public cleanDomain(storeId: string, domain: string): void {
        this.cleanDomains(storeId, [domain]);
    }

    public cleanDomains(storeId: string, hostnames: string[]) {
        // Fixme: use cookieStoreId when it's supported by firefox
        if (removeLocalStorageByHostname) {
            const domainsToClean = { ...settings.get("domainsToClean") };
            for (const hostname of hostnames) {
                if (!this.tabWatcher.containsDomain(hostname))
                    delete domainsToClean[hostname];
            }
            settings.set("domainsToClean", domainsToClean);
            settings.save();

            browser.browsingData.remove({
                originTypes: { unprotectedWeb: true },
                hostnames
            }, { localStorage: true });
        }
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
        if (this.tabWatcher.cookieStoreContainsDomain(storeId, domain, true))
            return true;
        const type = settings.getCleanupTypeForDomain(domain);
        return type === CleanupType.NEVER || type === CleanupType.STARTUP;
    }
}
