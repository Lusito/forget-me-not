/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData } from "webextension-polyfill-ts";

export abstract class Cleaner {
    protected snoozing = false;

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

    public async setSnoozing(snoozing: boolean) {
        this.snoozing = snoozing;
    }
}
