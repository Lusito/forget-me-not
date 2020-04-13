/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, browser } from "webextension-polyfill-ts";

import { settings } from "../../lib/settings";
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

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.localStorage && removeLocalStorageByHostname) {
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            if (settings.get(startup ? "startup.localStorage.applyRules" : "cleanAll.localStorage.applyRules")) {
                typeSet.localStorage = false;
                const ids = await getAllCookieStoreIds();
                const hostnames = this.getDomainsToClean(startup, protectOpenDomains);
                await Promise.all([
                    ...ids.map((id) => this.cleanDomains(id, hostnames)),
                    this.removeFromDomainsToClean(hostnames),
                ]);
            } else {
                settings.set("domainsToClean", {});
                await settings.save();
            }
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        if (
            settings.get("domainLeave.enabled") &&
            settings.get("domainLeave.localStorage") &&
            !this.isLocalStorageProtected(storeId, domain)
        )
            await this.cleanDomain(storeId, domain);
    }

    public async cleanDomain(storeId: string, domain: string) {
        const domains = [domain];
        await this.cleanDomains(storeId, domains);
        await this.removeFromDomainsToClean(domains);
    }

    private async removeFromDomainsToClean(hostnames: string[]) {
        const domainsToClean = { ...settings.get("domainsToClean") };
        for (const hostname of hostnames) {
            if (!this.tabWatcher.containsDomain(hostname)) delete domainsToClean[hostname];
        }
        settings.set("domainsToClean", domainsToClean);
        await settings.save();
    }

    public async cleanDomains(storeId: string, hostnames: string[]) {
        // Fixme: use cookieStoreId when it's supported by firefox
        if (removeLocalStorageByHostname) {
            await browser.browsingData.remove(
                {
                    originTypes: { unprotectedWeb: true },
                    hostnames,
                },
                { localStorage: true }
            );
        }
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean) {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain)) return true;
        return settings.isDomainProtected(domain, ignoreStartupType);
    }

    private getDomainsToClean(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const domainsToClean = settings.get("domainsToClean");
        const result = [];
        for (const domain in domainsToClean) {
            if (domain in domainsToClean && !this.isDomainProtected(domain, ignoreStartupType, protectOpenDomains))
                result.push(domain);
        }
        return result;
    }

    public isLocalStorageProtected(storeId: string, domain: string) {
        if (this.tabWatcher.cookieStoreContainsDomain(storeId, domain, true)) return true;
        const type = settings.getCleanupTypeForDomain(domain);
        return type === CleanupType.NEVER || type === CleanupType.STARTUP;
    }
}
