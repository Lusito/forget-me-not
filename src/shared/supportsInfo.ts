import { BrowserInfo, BrowserType } from "./browserInfo";

export class SupportsInfo {
    public constructor(
        public readonly removeLocalStorageByHostname: boolean,
        public readonly firstPartyIsolation: boolean,
        public readonly requestFilterIncognito: boolean,
        public readonly removeIndexedDbByHostname: boolean,
        public readonly removeServiceWorkersByHostname: boolean,
    ) {}
}

export function getSupports(browserInfo: BrowserInfo) {
    switch (browserInfo.type) {
        case BrowserType.FIREFOX:
            return new SupportsInfo(
                browserInfo.versionAsNumber >= 58,
                browserInfo.versionAsNumber >= 59,
                browserInfo.versionAsNumber >= 68,
                browserInfo.versionAsNumber >= 77,
                browserInfo.versionAsNumber >= 77,
            );
        case BrowserType.FENNEC:
            return new SupportsInfo(
                false,
                browserInfo.versionAsNumber >= 59,
                false,
                false,
                false,
            );
    }
    return new SupportsInfo(false, false, false, false, false);
}
