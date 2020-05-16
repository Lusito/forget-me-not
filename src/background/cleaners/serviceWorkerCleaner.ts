import { singleton } from "tsyringe";

import { Settings } from "../../shared/settings";
import { StoreUtils } from "../../shared/storeUtils";
import { TabWatcher } from "../tabWatcher";
import { SupportsInfo } from "../../shared/supportsInfo";
import { IncognitoWatcher } from "../incognitoWatcher";
import { RuleManager } from "../../shared/ruleManager";
import { AbstractStorageCleaner } from "./abstractStorageCleaner";

@singleton()
export class ServiceWorkerCleaner extends AbstractStorageCleaner {
    constructor(
        settings: Settings,
        ruleManager: RuleManager,
        storeUtils: StoreUtils,
        tabWatcher: TabWatcher,
        incognitoWatcher: IncognitoWatcher,
        supports: SupportsInfo
    ) {
        super(
            settings,
            ruleManager,
            storeUtils,
            tabWatcher,
            incognitoWatcher,
            supports.removeServiceWorkersByHostname,
            {
                dataType: "serviceWorkers",
                domainsToClean: "domainsToClean.serviceWorkers",
                startupApplyRules: "startup.serviceWorkers.applyRules",
                cleanAllApplyRules: "cleanAll.serviceWorkers.applyRules",
                domainLeave: "domainLeave.serviceWorkers",
            }
        );
    }
}
