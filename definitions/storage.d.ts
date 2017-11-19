// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // Storage
    ////////////////////
    /**
     * Use the browser.storage API to store, retrieve, and track changes to user data.
     * Permissions:  "storage"
     */
    export namespace storage {
        // Non-firefox implementations don't accept all these types
        type StorageValue =
            string |
            number |
            boolean |
            null |
            undefined |
            RegExp |
            ArrayBuffer |
            Uint8ClampedArray |
            Uint8Array |
            Uint16Array |
            Uint32Array |
            Int8Array |
            Int16Array |
            Int32Array |
            Float32Array |
            Float64Array |
            DataView |
            StorageObject |
            StorageArray |
            StorageMap |
            StorageSet;
        // The Index signature makes casting to/from classes or export interfaces a pain.
        // Custom types are OK.
        export interface StorageObject {
            [key: string]: StorageValue;
        }
        // These have to be export interfaces rather than types to avoid a circular
        // definition of StorageValue
        export interface StorageArray extends Array<StorageValue> { }
        export interface StorageMap extends Map<StorageValue, StorageValue> { }
        export interface StorageSet extends Set<StorageValue> { }

        export interface StorageArea {
            /**
             * Gets the amount of space (in bytes) being used by one or more items.
             */
            getBytesInUse(): Promise<number>;
            /**
             * Gets the amount of space (in bytes) being used by one or more items.
             * @param keys A single key or list of keys to get the total usage for. An empty list will return 0. Pass in null to get the total usage of all of storage.
             */
            getBytesInUse(keys: string | string[] | null): Promise<number>;
            /**
             * Removes all items from storage.
             */
            clear(): Promise<void>;
            /**
             * Sets multiple items.
             * @param items An object which gives each key/value pair to update storage with. Any other key/value pairs in storage will not be affected.
             * Primitive values such as numbers will serialize as expected. Values with a typeof "object" and "export function" will typically serialize to {}, with the exception of Array (serializes as expected), Date, and Regex (serialize using their String representation).
             */
            set(items: Object): Promise<void>;
            /**
             * Removes one item from storage.
             * @param key A single key for items to remove.
             */
            remove(key: string): Promise<void>;
            /**
             * Removes items from storage.
             * @param keys A list of keys for items to remove.
             */
            remove(keys: string[]): Promise<void>;
            /**
             * Gets one or more items from storage.
             */
            // get(keys: string | string[] | null): Promise<StorageObject>;
            // get<T extends StorageObject>(keys: T): Promise<T>;
            /**
             * Gets one or more items from storage.
             * @param keys A single key to get, list of keys to get, or a dictionary specifying default values.
             * An empty list or object will return an empty result object. Pass in null to get the entire contents of storage.
             */
            get(keys: string | string[] | Object | null): Promise<{ [key: string]: any }>;
        }

        export interface StorageChange {
            /** Optional. The new value of the item, if there is a new value. */
            newValue?: any;
            /** Optional. The old value of the item, if there was an old value. */
            oldValue?: any;
        }

        export interface LocalStorageArea extends StorageArea {
            /** The maximum amount (in bytes) of data that can be stored in local storage, as measured by the JSON stringification of every value plus every key's length. This value will be ignored if the extension has the unlimitedStorage permission. Updates that would cause this limit to be exceeded fail immediately and set runtime.lastError. */
            QUOTA_BYTES: number;
        }

        export interface SyncStorageArea extends StorageArea {
            /** The maximum total amount (in bytes) of data that can be stored in sync storage, as measured by the JSON stringification of every value plus every key's length. Updates that would cause this limit to be exceeded fail immediately and set runtime.lastError. */
            QUOTA_BYTES: number;
            /** The maximum size (in bytes) of each individual item in sync storage, as measured by the JSON stringification of its value plus its key length. Updates containing items larger than this limit will fail immediately and set runtime.lastError. */
            QUOTA_BYTES_PER_ITEM: number;
            /** The maximum number of items that can be stored in sync storage. Updates that would cause this limit to be exceeded will fail immediately and set runtime.lastError. */
            MAX_ITEMS: number;
            /**
             * The maximum number of set, remove, or clear operations that can be performed each hour. This is 1 every 2 seconds, a lower ceiling than the short term higher writes-per-minute limit.
             * Updates that would cause this limit to be exceeded fail immediately and set runtime.lastError.
             */
            MAX_WRITE_OPERATIONS_PER_HOUR: number;
            /**
             * The maximum number of set, remove, or clear operations that can be performed each minute. This is 2 per second, providing higher throughput than writes-per-hour over a shorter period of time.
             * Updates that would cause this limit to be exceeded fail immediately and set runtime.lastError.
             */
            MAX_WRITE_OPERATIONS_PER_MINUTE: number;
        }

        export interface StorageChangedEvent extends events.Event<(changes: { [key: string]: StorageChange }, areaName: string) => void> { }

        /** Items in the local storage area are local to each machine. */
        export var local: LocalStorageArea;
        /** Items in the sync storage area are synced using Chrome Sync. */
        export var sync: SyncStorageArea;

        /**
         * Items in the managed storage area are set by the domain administrator, and are read-only for the extension; trying to modify this namespace results in an error.
         */
        export var managed: StorageArea;

        /** Fired when one or more items change. */
        export var onChanged: StorageChangedEvent;
    }
}