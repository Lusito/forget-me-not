import { singleton } from "tsyringe";

import { Settings } from "../../shared/settings";
import { StoreUtils } from "../../shared/storeUtils";
import { TabWatcher } from "../tabWatcher";
import { SupportsInfo } from "../../shared/supportsInfo";
import { IncognitoWatcher } from "../incognitoWatcher";
import { RuleManager } from "../../shared/ruleManager";
import { AbstractStorageCleaner } from "./abstractStorageCleaner";

@singleton()
export class CacheCleaner extends AbstractStorageCleaner {
    constructor(
        settings: Settings,
        ruleManager: RuleManager,
        storeUtils: StoreUtils,
        tabWatcher: TabWatcher,
        incognitoWatcher: IncognitoWatcher,
        supports: SupportsInfo
    ) {
        super(settings, ruleManager, storeUtils, tabWatcher, incognitoWatcher, supports.removeCacheByHostname, {
            dataType: "cache",
            domainsToClean: "domainsToClean",
            startupApplyRules: "startup.cache.applyRules",
            cleanAllApplyRules: "cleanAll.cache.applyRules",
            domainLeave: "domainLeave.cache",
        });
    }
}
