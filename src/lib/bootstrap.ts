import { browser } from "webextension-polyfill-ts";

import { Settings } from "./settings";
import { BrowserInfo, createBrowserInfo, isNodeTest } from "./browserInfo";
import { createDefaultSettings } from "./defaultSettings";
import { DomainUtils } from "../background/domainUtils";
import { StoreUtils } from "../background/storeUtils";

export interface ExtensionSupports {
    removeLocalStorageByHostname: boolean;
    firstPartyIsolation: boolean;
    requestFilterIncognito: boolean;
}

export interface ExtensionContextWithoutSettings {
    version: string;
    browserInfo: BrowserInfo & {
        firefox: boolean;
    };
    supports: ExtensionSupports;
}

export interface ExtensionContext extends ExtensionContextWithoutSettings {
    settings: Settings;
    storeUtils: StoreUtils;
    domainUtils: DomainUtils;
}

export interface ExtensionContextProps {
    context: ExtensionContext;
}

export default async function () {
    const browserInfo = { ...createBrowserInfo(), firefox: false };
    if (browser.runtime.getBrowserInfo) {
        const browserInfo2 = await browser.runtime.getBrowserInfo();
        browserInfo.name = browserInfo2.name;
        browserInfo.version = browserInfo2.version;
        browserInfo.versionAsNumber = parseFloat(browserInfo.version);
    }
    const lowerBrowserName = browserInfo.name.toLowerCase();
    browserInfo.firefox = lowerBrowserName === "firefox" || lowerBrowserName === "fennec";
    if (lowerBrowserName === "fennec") browserInfo.mobile = true;

    const supports = {
        removeLocalStorageByHostname: isNodeTest || (browserInfo.firefox && browserInfo.versionAsNumber >= 58),
        firstPartyIsolation: isNodeTest || (browserInfo.firefox && browserInfo.versionAsNumber >= 59),
        requestFilterIncognito: browserInfo.firefox && browserInfo.versionAsNumber >= 68,
    };

    const context: ExtensionContextWithoutSettings = {
        version: browser.runtime.getManifest().version,
        browserInfo,
        supports,
    };

    const settings = new Settings(createDefaultSettings(context));
    await settings.load();

    const storeUtils = new StoreUtils(browserInfo.firefox);
    const domainUtils = new DomainUtils();

    const combinedContext: ExtensionContext = {
        ...context,
        settings,
        storeUtils,
        domainUtils,
    };
    return combinedContext;
}
