/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowserInfo, BrowserType } from "./browserInfo";

export class SupportsInfo {
    public constructor(
        public readonly removeLocalStorageByHostname: boolean,
        public readonly firstPartyIsolation: boolean,
        public readonly requestFilterIncognito: boolean
    ) {}
}

export function getSupports(browserInfo: BrowserInfo) {
    switch (browserInfo.type) {
        case BrowserType.NODE:
            return new SupportsInfo(true, true, true);
        case BrowserType.FIREFOX:
        case BrowserType.FENNEC:
            return new SupportsInfo(
                browserInfo.versionAsNumber >= 58,
                browserInfo.versionAsNumber >= 59,
                browserInfo.versionAsNumber >= 68
            );
    }
    return new SupportsInfo(false, false, false);
}
