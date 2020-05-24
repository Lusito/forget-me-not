import { singleton } from "tsyringe";

import { BrowserInfo, BrowserType } from "./browserInfo";
import { SupportsInfo } from "./supportsInfo";
import type { SettingsKey } from "./defaultSettings";

@singleton()
export class UnsupportedSettings {
    private unsupported: SettingsKey[];

    public constructor(browserInfo: BrowserInfo, supports: SupportsInfo) {
        // Only boolean values currently supported. See defaultSettings
        this.unsupported =
            browserInfo.type === BrowserType.FENNEC
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
                      "cleanAll.indexedDB.applyRules",
                      "startup.indexedDB",
                      "startup.indexedDB.applyRules",
                      "domainLeave.indexedDB",
                      "cleanAll.pluginData",
                      "startup.pluginData",
                      "cleanAll.serviceWorkers",
                      "cleanAll.serviceWorkers.applyRules",
                      "startup.serviceWorkers",
                      "startup.serviceWorkers.applyRules",
                      "domainLeave.serviceWorkers",
                  ]
                : [];

        if (!supports.removeLocalStorageByHostname) {
            this.unsupported.push("cleanAll.localStorage.applyRules");
            this.unsupported.push("domainLeave.localStorage");
            this.unsupported.push("startup.localStorage.applyRules");
        }
        if (!supports.removeIndexedDbByHostname) {
            this.unsupported.push("cleanAll.indexedDB.applyRules");
            this.unsupported.push("domainLeave.indexedDB");
            this.unsupported.push("startup.indexedDB.applyRules");
        }
        if (!supports.removeServiceWorkersByHostname) {
            this.unsupported.push("cleanAll.serviceWorkers.applyRules");
            this.unsupported.push("domainLeave.serviceWorkers");
            this.unsupported.push("startup.serviceWorkers.applyRules");
        }
        if (!supports.removeCacheByHostname) {
            this.unsupported.push("cleanAll.cache.applyRules");
            this.unsupported.push("domainLeave.cache");
            this.unsupported.push("startup.cache.applyRules");
        }
        if (!supports.removePluginDataByHostname) {
            this.unsupported.push("cleanAll.pluginData.applyRules");
            this.unsupported.push("domainLeave.pluginData");
            this.unsupported.push("startup.pluginData.applyRules");
        }
    }

    public get() {
        return this.unsupported;
    }
}
