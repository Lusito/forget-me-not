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
                      "startup.indexedDB",
                      "cleanAll.pluginData",
                      "startup.pluginData",
                      "cleanAll.serviceWorkers",
                      "startup.serviceWorkers",
                  ]
                : [];

        if (!supports.removeLocalStorageByHostname) {
            this.unsupported.push("cleanAll.localStorage.applyRules");
            this.unsupported.push("domainLeave.localStorage");
            this.unsupported.push("startup.localStorage.applyRules");
        }
    }

    public get() {
        return this.unsupported;
    }
}
