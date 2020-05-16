import { BrowserInfo, BrowserType } from "./browserInfo";

export interface SupportsInfoProps {
    removeLocalStorageByHostname: boolean;
    firstPartyIsolation: boolean;
    requestFilterIncognito: boolean;
    removeIndexedDbByHostname: boolean;
    removeServiceWorkersByHostname: boolean;
}

export class SupportsInfo {
    public readonly removeLocalStorageByHostname: boolean;

    public readonly firstPartyIsolation: boolean;

    public readonly requestFilterIncognito: boolean;

    public readonly removeIndexedDbByHostname: boolean;

    public readonly removeServiceWorkersByHostname: boolean;

    public constructor(props: Partial<SupportsInfoProps>) {
        this.removeLocalStorageByHostname = props.removeLocalStorageByHostname || false;
        this.firstPartyIsolation = props.firstPartyIsolation || false;
        this.requestFilterIncognito = props.requestFilterIncognito || false;
        this.removeIndexedDbByHostname = props.removeIndexedDbByHostname || false;
        this.removeServiceWorkersByHostname = props.removeServiceWorkersByHostname || false;
    }
}

export function getSupports(browserInfo: BrowserInfo) {
    switch (browserInfo.type) {
        case BrowserType.FIREFOX:
            return new SupportsInfo({
                removeLocalStorageByHostname: browserInfo.versionAsNumber >= 58,
                firstPartyIsolation: browserInfo.versionAsNumber >= 59,
                requestFilterIncognito: browserInfo.versionAsNumber >= 68,
                removeIndexedDbByHostname: browserInfo.versionAsNumber >= 77,
                removeServiceWorkersByHostname: browserInfo.versionAsNumber >= 77,
            });
        case BrowserType.FENNEC:
            return new SupportsInfo({
                firstPartyIsolation: browserInfo.versionAsNumber >= 59,
            });
    }
    return new SupportsInfo({});
}
