/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, browser } from "webextension-polyfill-ts";

import { Cleaner } from "./cleaner";
import { CleanupType } from "../../lib/shared";
import { ExtensionBackgroundContext } from "../backgroundShared";

export class LocalStorageCleaner extends Cleaner {
    private readonly context: ExtensionBackgroundContext;

    public constructor(context: ExtensionBackgroundContext) {
        super();
        this.context = context;
    }

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        const { settings, supports, storeUtils } = this.context;
        if (typeSet.localStorage && supports.removeLocalStorageByHostname) {
            const protectOpenDomains = startup || settings.get("cleanAll.protectOpenDomains");
            if (settings.get(startup ? "startup.localStorage.applyRules" : "cleanAll.localStorage.applyRules")) {
                typeSet.localStorage = false;
                const ids = await storeUtils.getAllCookieStoreIds();
                const hostnames = this.getDomainsToClean(startup, protectOpenDomains);
                if (hostnames.length) {
                    await this.removeFromDomainsToClean(hostnames);
                    await Promise.all(ids.map((id) => this.cleanDomains(id, hostnames)));
                }
            } else {
                settings.set("domainsToClean", {});
                await settings.save();
            }
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        const { settings } = this.context;
        if (
            settings.get("domainLeave.enabled") &&
            settings.get("domainLeave.localStorage") &&
            !this.isLocalStorageProtected(storeId, domain)
        ) {
            await this.cleanDomain(storeId, domain);
        }
    }

    public async cleanDomain(storeId: string, domain: string) {
        const domains = [domain];
        await this.cleanDomains(storeId, domains);
        await this.removeFromDomainsToClean(domains);
    }

    private async removeFromDomainsToClean(hostnames: string[]) {
        const { settings, tabWatcher } = this.context;
        const domainsToClean = { ...settings.get("domainsToClean") };
        for (const hostname of hostnames) {
            if (!tabWatcher.containsDomain(hostname)) delete domainsToClean[hostname];
        }
        settings.set("domainsToClean", domainsToClean);
        await settings.save();
    }

    private async cleanDomains(storeId: string, hostnames: string[]) {
        // Fixme: use cookieStoreId when it's supported by firefox
        if (this.context.supports.removeLocalStorageByHostname) {
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
        if (protectOpenDomains && this.context.tabWatcher.containsDomain(domain)) return true;
        return this.context.settings.isDomainProtected(domain, ignoreStartupType);
    }

    private getDomainsToClean(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const domainsToClean = this.context.settings.get("domainsToClean");
        const result = [];
        for (const domain in domainsToClean) {
            if (domain in domainsToClean && !this.isDomainProtected(domain, ignoreStartupType, protectOpenDomains))
                result.push(domain);
        }
        return result;
    }

    private isLocalStorageProtected(storeId: string, domain: string) {
        if (this.context.tabWatcher.cookieStoreContainsDomain(storeId, domain, true)) return true;
        const type = this.context.settings.getCleanupTypeForDomain(domain);
        return type === CleanupType.NEVER || type === CleanupType.STARTUP;
    }
}
