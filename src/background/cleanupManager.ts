import { singleton } from "tsyringe";
import { browser, BrowsingData, Tabs } from "webextension-polyfill-ts";

import { CleanupScheduler } from "./cleanupScheduler";
import { DownloadCleaner } from "./cleaners/downloadCleaner";
import { LocalStorageCleaner } from "./cleaners/localStorageCleaner";
import { IndexedDbCleaner } from "./cleaners/indexedDbCleaner";
import { ServiceWorkerCleaner } from "./cleaners/serviceWorkerCleaner";
import { CookieCleaner } from "./cleaners/cookieCleaner";
import { Cleaner } from "./cleaners/cleaner";
import { HistoryCleaner } from "./cleaners/historyCleaner";
import { TemporaryRuleCleaner } from "./cleaners/temporaryRuleCleaner";
import { Settings } from "../shared/settings";
import { StoreUtils } from "../shared/storeUtils";
import { CleanupSchedulerFactory } from "./cleanupSchedulerFactory";
import { TabWatcher } from "./tabWatcher";
import { MessageUtil } from "../shared/messageUtil";

// fixme: make this file unit-testable and add tests

export interface CleanUrlNowConfig {
    hostname: string;
    cookieStoreId: string;
}

@singleton()
export class CleanupManager {
    private readonly cleanupScheduler: { [s: string]: CleanupScheduler } = {};

    private readonly cleaners: Cleaner[] = [];

    private readonly defaultCookieStoreId: string;

    public constructor(
        private readonly settings: Settings,
        private readonly cleanupSchedulerFactory: CleanupSchedulerFactory,
        private readonly localStorageCleaner: LocalStorageCleaner,
        private readonly indexedDbCleaner: IndexedDbCleaner,
        private readonly serviceWorkerCleaner: ServiceWorkerCleaner,
        storeUtils: StoreUtils,
        temporaryRuleCleaner: TemporaryRuleCleaner,
        downloadCleaner: DownloadCleaner,
        cookieCleaner: CookieCleaner,
        historyCleaner: HistoryCleaner,
        tabWatcher: TabWatcher,
        messageUtil: MessageUtil
    ) {
        this.defaultCookieStoreId = storeUtils.defaultCookieStoreId;
        this.cleaners.push(temporaryRuleCleaner);
        browser.history && this.cleaners.push(historyCleaner);
        this.cleaners.push(downloadCleaner);
        this.cleaners.push(cookieCleaner);
        this.cleaners.push(localStorageCleaner);
        this.cleaners.push(indexedDbCleaner);
        this.cleaners.push(serviceWorkerCleaner);

        tabWatcher.domainLeaveListeners.add((cookieStoreId, hostname) => {
            this.getCleanupScheduler(cookieStoreId).schedule(hostname);
        });
        messageUtil.receive("cleanAllNow", () => this.cleanAllNow());
        messageUtil.receive("cleanUrlNow", (config: CleanUrlNowConfig) => this.cleanUrlNow(config));
    }

    public async init(tabs: Tabs.Tab[]) {
        await this.settings.removeTemporaryRules();
        this.localStorageCleaner.init(tabs);
        this.indexedDbCleaner.init(tabs);
        this.serviceWorkerCleaner.init(tabs);

        if (this.settings.get("startup.enabled")) {
            setTimeout(() => {
                this.runCleanup(true);
            }, 1000);
        }
    }

    public async cleanUrlNow(config: CleanUrlNowConfig) {
        await Promise.all(this.cleaners.map((cleaner) => cleaner.cleanDomain(config.cookieStoreId, config.hostname)));
    }

    public async cleanAllNow() {
        await this.runCleanup(false);
    }

    private async runCleanup(startup: boolean) {
        const typeSet: BrowsingData.DataTypeSet = {
            localStorage: this.settings.get(startup ? "startup.localStorage" : "cleanAll.localStorage"),
            cookies: this.settings.get(startup ? "startup.cookies" : "cleanAll.cookies"),
            history: this.settings.get(startup ? "startup.history" : "cleanAll.history"),
            downloads: this.settings.get(startup ? "startup.downloads" : "cleanAll.downloads"),
            formData: this.settings.get(startup ? "startup.formData" : "cleanAll.formData"),
            passwords: this.settings.get(startup ? "startup.passwords" : "cleanAll.passwords"),
            indexedDB: this.settings.get(startup ? "startup.indexedDB" : "cleanAll.indexedDB"),
            pluginData: this.settings.get(startup ? "startup.pluginData" : "cleanAll.pluginData"),
            serverBoundCertificates: this.settings.get(
                startup ? "startup.serverBoundCertificates" : "cleanAll.serverBoundCertificates"
            ),
            serviceWorkers: this.settings.get(startup ? "startup.serviceWorkers" : "cleanAll.serviceWorkers"),
            cache: this.settings.get(startup ? "startup.cache" : "cleanAll.cache"),
        };

        await Promise.all(this.cleaners.map((cleaner) => cleaner.clean(typeSet, startup)));
        await browser.browsingData.remove({ originTypes: { unprotectedWeb: true } }, typeSet);
    }

    private getCleanupScheduler(cookieStoreId?: string) {
        if (!cookieStoreId) cookieStoreId = this.defaultCookieStoreId;
        let scheduler = this.cleanupScheduler[cookieStoreId];
        if (!scheduler) {
            const storeId = cookieStoreId;
            scheduler = this.cleanupSchedulerFactory.create();
            scheduler.init(async (domain) => {
                await Promise.all(this.cleaners.map((cleaner) => cleaner.cleanDomainOnLeave(storeId, domain)));
            });
            this.cleanupScheduler[cookieStoreId] = scheduler;
        }
        return scheduler;
    }
}
