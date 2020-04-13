/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser } from "webextension-polyfill-ts";

const DEFAULT_COOKIE_STORE_ID_FIREFOX = "firefox-default";
const DEFAULT_COOKIE_STORE_ID_OTHER = "0";

export class StoreUtils {
    public readonly defaultCookieStoreId: string;

    private isFirefox: boolean;

    public constructor(isFirefox: boolean) {
        this.isFirefox = isFirefox;
        this.defaultCookieStoreId = isFirefox ? DEFAULT_COOKIE_STORE_ID_FIREFOX : DEFAULT_COOKIE_STORE_ID_OTHER;
    }

    // Workaround for getAllCookieStores returning only active cookie stores.
    // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1486274
    public async getAllCookieStoreIds() {
        const ids: { [s: string]: boolean } = this.isFirefox
            ? {
                  "firefox-default": true,
                  "firefox-private": true,
              }
            : {};
        const cookieStores = await browser.cookies.getAllCookieStores();

        for (const store of cookieStores) ids[store.id] = true;

        if (browser.contextualIdentities) {
            const contextualIdentities = await browser.contextualIdentities.query({});
            for (const ci of contextualIdentities) ids[ci.cookieStoreId] = true;
        }
        return Object.keys(ids);
    }
}
