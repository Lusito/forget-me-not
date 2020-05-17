import { BrowsingData, browser, Tabs } from "webextension-polyfill-ts";

import { Cleaner } from "./cleaner";
import { CleanupType } from "../../shared/types";
import { Settings } from "../../shared/settings";
import { StoreUtils } from "../../shared/storeUtils";
import { TabWatcher } from "../tabWatcher";
import { IncognitoWatcher } from "../incognitoWatcher";
import { getValidHostname } from "../../shared/domainUtils";
import { RuleManager } from "../../shared/ruleManager";
import { BooleanMap } from "../../shared/defaultSettings";

interface AbstractStorageCleanupKeys {
    dataType: "localStorage" | "indexedDB" | "serviceWorkers";
    domainsToClean: "domainsToClean" | "domainsToClean.indexedDB" | "domainsToClean.serviceWorkers";
    startupApplyRules:
        | "startup.localStorage.applyRules"
        | "startup.indexedDB.applyRules"
        | "startup.serviceWorkers.applyRules";
    cleanAllApplyRules:
        | "cleanAll.localStorage.applyRules"
        | "cleanAll.indexedDB.applyRules"
        | "cleanAll.serviceWorkers.applyRules";
    domainLeave: "domainLeave.localStorage" | "domainLeave.indexedDB" | "domainLeave.serviceWorkers";
}

export abstract class AbstractStorageCleaner extends Cleaner {
    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly storeUtils: StoreUtils,
        private readonly tabWatcher: TabWatcher,
        private readonly incognitoWatcher: IncognitoWatcher,
        private readonly supportsCleanupByHostname: boolean,
        private readonly keys: AbstractStorageCleanupKeys
    ) {
        super();
    }

    public init(tabs: Tabs.Tab[]) {
        if (this.supportsCleanupByHostname) {
            const { defaultCookieStoreId } = this.storeUtils;
            for (const tab of tabs) {
                if (tab.url && tab.id && !tab.incognito) {
                    const hostname = getValidHostname(tab.url);
                    this.onDomainEnter(tab.cookieStoreId || defaultCookieStoreId, hostname);
                }
            }
            this.tabWatcher.domainEnterListeners.add(this.onDomainEnter);
        }
    }

    private onDomainEnter = (cookieStoreId: string, hostname: string) => {
        if (!this.incognitoWatcher.hasCookieStore(cookieStoreId)) {
            const domainsToClean = { ...this.settings.get(this.keys.domainsToClean) };
            domainsToClean[hostname] = true;
            this.updateDomainsToClean(domainsToClean);
        }
    };

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet[this.keys.dataType] && this.supportsCleanupByHostname) {
            if (this.settings.get(startup ? this.keys.startupApplyRules : this.keys.cleanAllApplyRules)) {
                typeSet[this.keys.dataType] = false;
                await this.cleanWithRules(startup);
            } else {
                await this.updateDomainsToClean({});
            }
        }
    }

    private async cleanWithRules(startup: boolean) {
        const hostnames = this.getDomainsToClean(startup);
        if (hostnames.length) {
            const ids = await this.storeUtils.getAllCookieStoreIds();
            await this.removeFromDomainsToClean(hostnames);
            await Promise.all(ids.map((id) => this.cleanDomains(id, hostnames)));
        }
    }

    private async updateDomainsToClean(domains: BooleanMap) {
        this.settings.set(this.keys.domainsToClean, domains);
        await this.settings.save();
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        if (
            this.settings.get("domainLeave.enabled") &&
            this.settings.get(this.keys.domainLeave) &&
            !this.isStorageProtected(domain)
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
        const domainsToClean = { ...this.settings.get(this.keys.domainsToClean) };
        for (const hostname of hostnames) {
            if (!this.tabWatcher.containsDomain(hostname)) delete domainsToClean[hostname];
        }
        await this.updateDomainsToClean(domainsToClean);
    }

    private async cleanDomains(storeId: string, hostnames: string[]) {
        // Fixme: use cookieStoreId when it's supported by firefox
        if (this.supportsCleanupByHostname) {
            await browser.browsingData.remove(
                {
                    originTypes: { unprotectedWeb: true },
                    hostnames,
                },
                { [this.keys.dataType]: true }
            );
        }
    }

    private isDomainProtected(domain: string, ignoreStartupType: boolean, protectOpenDomains: boolean) {
        if (protectOpenDomains && this.tabWatcher.containsDomain(domain)) return true;
        return this.ruleManager.isDomainProtected(domain, false, ignoreStartupType);
    }

    private getDomainsToClean(startup: boolean) {
        const protectOpenDomains = startup || this.settings.get("cleanAll.protectOpenDomains");
        return Object.keys(this.settings.get(this.keys.domainsToClean)).filter(
            (domain) => !this.isDomainProtected(domain, startup, protectOpenDomains)
        );
    }

    private isStorageProtected(domain: string) {
        if (this.tabWatcher.containsDomain(domain)) return true;
        const type = this.ruleManager.getCleanupTypeFor(domain, false, false);
        return type === CleanupType.NEVER || type === CleanupType.STARTUP;
    }
}
