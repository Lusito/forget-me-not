import { BrowsingData } from "webextension-polyfill-ts";

export abstract class Cleaner {
    /**
     * Manual cleanup or startup cleanup
     */
    public async clean(_typeSet: BrowsingData.DataTypeSet, _startup: boolean) {
        // Do nothing by default
    }

    /**
     * Clean domain on leave
     */
    public async cleanDomainOnLeave(_storeId: string, _domain: string) {
        // Do nothing by default
    }

    /**
     * Clean domain upon button press
     * Todo: maybe allow cleaning for all stores?
     */
    public async cleanDomain(_storeId: string, _domain: string) {
        // Do nothing by default
    }
}
