// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // Cookies
    ////////////////////
    /**
     * Use the browser.cookies API to query and modify cookies, and to be notified when they change. * Permissions:  "cookies", host permissions
     */
    export namespace cookies {
        /** Represents information about an HTTP cookie. */
        export interface Cookie {
            /** The domain of the cookie (e.g. "www.google.com", "example.com"). */
            domain: string;
            /** The name of the cookie. */
            name: string;
            /** The ID of the cookie store containing this cookie, as provided in getAllCookieStores(). */
            storeId: string;
            /** The value of the cookie. */
            value: string;
            /** True if the cookie is a session cookie, as opposed to a persistent cookie with an expiration date. */
            session: boolean;
            /** True if the cookie is a host-only cookie (i.e. a request's host must exactly match the domain of the cookie). */
            hostOnly: boolean;
            /** Optional. The expiration date of the cookie as the number of seconds since the UNIX epoch. Not provided for session cookies.  */
            expirationDate?: number;
            /** The path of the cookie. */
            path: string;
            /** True if the cookie is marked as HttpOnly (i.e. the cookie is inaccessible to client-side scripts). */
            httpOnly: boolean;
            /** True if the cookie is marked as Secure (i.e. its scope is limited to secure channels, typically HTTPS). */
            secure: boolean;
        }

        /** Represents a cookie store in the browser. An incognito mode window, for instance, uses a separate cookie store from a non-incognito window. */
        export interface CookieStore {
            /** The unique identifier for the cookie store. */
            id: string;
            /** Identifiers of all the browser tabs that share this cookie store. */
            tabIds: number[];
        }

        export interface GetAllDetails {
            /** Optional. Restricts the retrieved cookies to those whose domains match or are subdomains of this one.  */
            domain?: string;
            /** Optional. Filters the cookies by name.  */
            name?: string;
            /** Optional. Restricts the retrieved cookies to those that would match the given URL.  */
            url?: string;
            /** Optional. The cookie store to retrieve cookies from. If omitted, the current execution context's cookie store will be used.  */
            storeId?: string;
            /** Optional. Filters out session vs. persistent cookies.  */
            session?: boolean;
            /** Optional. Restricts the retrieved cookies to those whose path exactly matches this string.  */
            path?: string;
            /** Optional. Filters the cookies by their Secure property.  */
            secure?: boolean;
        }

        export interface SetDetails {
            /** Optional. The domain of the cookie. If omitted, the cookie becomes a host-only cookie.  */
            domain?: string;
            /** Optional. The name of the cookie. Empty by default if omitted.  */
            name?: string;
            /** The request-URI to associate with the setting of the cookie. This value can affect the default domain and path values of the created cookie. If host permissions for this URL are not specified in the manifest file, the API call will fail. */
            url: string;
            /** Optional. The ID of the cookie store in which to set the cookie. By default, the cookie is set in the current execution context's cookie store.  */
            storeId?: string;
            /** Optional. The value of the cookie. Empty by default if omitted.  */
            value?: string;
            /** Optional. The expiration date of the cookie as the number of seconds since the UNIX epoch. If omitted, the cookie becomes a session cookie.  */
            expirationDate?: number;
            /** Optional. The path of the cookie. Defaults to the path portion of the url parameter.  */
            path?: string;
            /** Optional. Whether the cookie should be marked as HttpOnly. Defaults to false.  */
            httpOnly?: boolean;
            /** Optional. Whether the cookie should be marked as Secure. Defaults to false.  */
            secure?: boolean;
        }

        export interface Details {
            name: string;
            url: string;
            storeId?: string;
        }

        export interface CookieChangeInfo {
            /** Information about the cookie that was set or removed. */
            cookie: Cookie;
            /** True if a cookie was removed. */
            removed: boolean;
            /**
             * Since Chrome 12.
             * The underlying reason behind the cookie's change.
             */
            cause: string;
        }

        export interface CookieChangedEvent extends events.Event<(changeInfo: CookieChangeInfo) => void> { }

        /**
         * Lists all existing cookie stores.
         * Parameter cookieStores: All the existing cookie stores.
         */
        export function getAllCookieStores(): Promise<CookieStore[]>;
        /**
         * Retrieves all cookies from a single cookie store that match the given information. The cookies returned will be sorted, with those with the longest path first. If multiple cookies have the same path length, those with the earliest creation time will be first.
         * @param details Information to filter the cookies being retrieved.
         * Parameter cookies: All the existing, unexpired cookies that match the given cookie info.
         */
        export function getAll(details: GetAllDetails): Promise<Cookie[]>;
        /**
         * Sets a cookie with the given cookie data; may overwrite equivalent cookies if they exist.
         * @param details Details about the cookie being set.
         * Optional parameter cookie: Contains details about the cookie that's been set. If setting failed for any reason, this will be "null", and "browser.runtime.lastError" will be set.
         */
        export function set(details: SetDetails): Promise<Cookie | null>;
        /**
         * Deletes a cookie by name.
         * @param details Information to identify the cookie to remove.
         */
        export function remove(details: Details): Promise<Details>;
        /**
         * Retrieves information about a single cookie. If more than one cookie of the same name exists for the given URL, the one with the longest path will be returned. For cookies with the same path length, the cookie with the earliest creation time will be returned.
         * @param details Details to identify the cookie being retrieved.
         * Parameter cookie: Contains details about the cookie. This parameter is null if no such cookie was found.
         */
        export function get(details: Details): Promise<Cookie | null>;

        /** Fired when a cookie is set or removed. As a special case, note that updating a cookie's properties is implemented as a two step process: the cookie to be updated is first removed entirely, generating a notification with "cause" of "overwrite" . Afterwards, a new cookie is written with the updated values, generating a second notification with "cause" "explicit". */
        export var onChanged: CookieChangedEvent;
    }
}