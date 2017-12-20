////////////////////
// Browsing Data
////////////////////
/**
 * Use the browser.browsingData API to remove browsing data from a user's local profile. * Permissions:  "browsingData"
 */
export namespace BrowsingData {
    export interface OriginTypes {
        /** Optional. Normal websites.  */
        unprotectedWeb?: boolean;
        /** Optional. Websites that have been installed as hosted applications (be careful!).  */
        protectedWeb?: boolean;
        /** Optional. Extensions and packaged applications a user has installed (be _really_ careful!).  */
        extension?: boolean;
    }

    /** Options that determine exactly what data will be removed. */
    export interface RemovalOptions {
        hostnames?: string[];
        /** Optional. An object whose properties specify which origin types ought to be cleared. If this object isn't specified, it defaults to clearing only "unprotected" origins. Please ensure that you really want to remove application data before adding 'protectedWeb' or 'extensions'. */
        originTypes?: OriginTypes;
        /** Optional. Remove data accumulated on or after this date, represented in milliseconds since the epoch (accessible via the getTime method of the JavaScript Date object). If absent, defaults to 0 (which would remove all browsing data).  */
        since?: number;
    }

    /**
     * A set of data types. Missing data types are interpreted as false.
     */
    export interface DataTypeSet {
        /** Optional. The browser's cache. Note: when removing data, this clears the entire cache: it is not limited to the range you specify.  */
        cache?: boolean;
        /** Optional. The browser's cookies.  */
        cookies?: boolean;
        /** Optional. The browser's download list.  */
        downloads?: boolean;
        /** Optional. The browser's stored form data.  */
        formData?: boolean;
        /** Optional. The browser's history.  */
        history?: boolean;
        /** Optional. Websites' IndexedDB data.  */
        indexedDB?: boolean;
        /** Optional. Websites' local storage data.  */
        localStorage?: boolean;
        /** Optional. Stored passwords.  */
        passwords?: boolean;
        /** Optional. Plugins' data.  */
        pluginData?: boolean;
        /** Optional. Server-bound certificates.  */
        serverBoundCertificates?: boolean;
        /** Optional. Service Workers. */
        serviceWorkers?: boolean;
    }

    export interface SettingsCallbackData {
        options: RemovalOptions;
        /** All of the types will be present in the result, with values of true if they are both selected to be removed and permitted to be removed, otherwise false. */
        dataToRemove: DataTypeSet;
        /** All of the types will be present in the result, with values of true if they are permitted to be removed (e.g., by enterprise policy) and false if not. */
        dataRemovalPermitted: DataTypeSet;
    }

    export interface Static {
        /**
         * Clears export various types of browsing data stored in a user's profile.
         * @param dataToRemove The set of data types to remove.
         */
        remove(options: RemovalOptions, dataToRemove: DataTypeSet): Promise<void>;
        /**
         * Clears the browser's cache.
         */
        removeCache(options: RemovalOptions): Promise<void>;
        /**
         * Clears the browser's cookies and server-bound certificates modified within a particular timeframe.
         */
        removeCookies(options: RemovalOptions): Promise<void>;
        /**
         * Clears the browser's list of downloaded files (not the downloaded files themselves).
         */
        removeDownloads(options: RemovalOptions): Promise<void>;
        /**
         * Clears the browser's stored form data (autofill).
         */
        removeFormData(options: RemovalOptions): Promise<void>;
        /**
         * Clears the browser's history.
         */
        removeHistory(options: RemovalOptions): Promise<void>;
        /**
         * Clears websites' local storage data.
         */
        removeLocalStorage(options: RemovalOptions): Promise<void>;
        /**
         * Clears the browser's stored passwords.
         */
        removePasswords(options: RemovalOptions): Promise<void>;
        /**
         * Clears plugins' data.
         */
        removePluginData(options: RemovalOptions): Promise<void>;
        /**
         * Reports which types of data are currently selected in the 'Clear browsing data' settings UI. Note: some of the data types included in this API are not available in the settings UI, and some UI settings control more than one data type listed here.
         */
        settings(): Promise<SettingsCallbackData>;
    }
}