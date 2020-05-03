import { singleton } from "tsyringe";
import { BrowsingData, browser, Tabs } from "webextension-polyfill-ts";

import { Cleaner } from "./cleaner";
import { CleanupType } from "../../shared/types";
import { Settings } from "../../shared/settings";
import { StoreUtils } from "../../shared/storeUtils";
import { TabWatcher } from "../tabWatcher";
import { SupportsInfo } from "../../shared/supportsInfo";
import { IncognitoWatcher } from "../incognitoWatcher";
import { DomainUtils } from "../../shared/domainUtils";
import { RuleManager } from "../../shared/ruleManager";

@singleton()
export class LocalStorageCleaner extends Cleaner {
    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly storeUtils: StoreUtils,
        private readonly domainUtils: DomainUtils,
        private readonly tabWatcher: TabWatcher,
        private readonly incognitoWatcher: IncognitoWatcher,
        private readonly supports: SupportsInfo
    ) {
        super();
    }

    public init(tabs: Tabs.Tab[]) {
        if (this.supports.removeLocalStorageByHostname) {
            const { defaultCookieStoreId } = this.storeUtils;
            for (const tab of tabs) {
                if (tab.url && tab.id && !tab.incognito) {
                    const hostname = this.domainUtils.getValidHostname(tab.url);
                    this.onDomainEnter(tab.cookieStoreId || defaultCookieStoreId, hostname);
                }
            }
            this.tabWatcher.domainEnterListeners.add(this.onDomainEnter);
        }
    }

    private onDomainEnter = (cookieStoreId: string, hostname: string) => {
        if (!this.incognitoWatcher.hasCookieStore(cookieStoreId)) {
            const domainsToClean = { ...this.settings.get("domainsToClean") };
            domainsToClean[hostname] = true;
            this.settings.set("domainsToClean", domainsToClean);
            this.settings.save();
        }
    };

    public async clean(typeSet: BrowsingData.DataTypeSet, startup: boolean) {
        if (typeSet.localStorage && this.supports.removeLocalStorageByHostname) {
            const protectOpenDomains = startup || this.settings.get("cleanAll.protectOpenDomains");
            if (this.settings.get(startup ? "startup.localStorage.applyRules" : "cleanAll.localStorage.applyRules")) {
                typeSet.localStorage = false;
                const ids = await this.storeUtils.getAllCookieStoreIds();
                const hostnames = this.getDomainsToClean(startup, protectOpenDomains);
                if (hostnames.length) {
                    await this.removeFromDomainsToClean(hostnames);
                    await Promise.all(ids.map((id) => this.cleanDomains(id, hostnames)));
                }
            } else {
                this.settings.set("domainsToClean", {});
                await this.settings.save();
            }
        }
    }

    public async cleanDomainOnLeave(storeId: string, domain: string) {
        if (
            this.settings.get("domainLeave.enabled") &&
            this.settings.get("domainLeave.localStorage") &&
            !this.isLocalStorageProtected(domain)
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
        const domainsToClean = { ...this.settings.get("domainsToClean") };
        for (const hostname of hostnames) {
            if (!this.tabWatcher.containsDomain(hostname)) delete domainsToClean[hostname];
        }
        this.settings.set("domainsToClean", domainsToClean);
        await this.settings.save();
    }

    private async cleanDomains(storeId: string, hostnames: string[]) {
        // Fixme: use cookieStoreId when it's supported by firefox
        if (this.supports.removeLocalStorageByHostname) {
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
        return this.ruleManager.isDomainProtected(domain, false, ignoreStartupType);
    }

    private getDomainsToClean(ignoreStartupType: boolean, protectOpenDomains: boolean) {
        const domainsToClean = this.settings.get("domainsToClean");
        const result = [];
        for (const domain in domainsToClean) {
            if (domain in domainsToClean && !this.isDomainProtected(domain, ignoreStartupType, protectOpenDomains))
                result.push(domain);
        }
        return result;
    }

    private isLocalStorageProtected(domain: string) {
        if (this.tabWatcher.containsDomain(domain)) return true;
        const type = this.ruleManager.getCleanupTypeFor(domain, false, false);
        return type === CleanupType.NEVER || type === CleanupType.STARTUP;
    }
}
