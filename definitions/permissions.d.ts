// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // Permissions
    ////////////////////
    /**
     * Use the browser.permissions API to request declared optional permissions at run time rather than install time, so users understand why the permissions are needed and grant only those that are necessary.
     */
    export namespace permissions {
        export interface Permissions {
            /**
             * Optional.
             * List of named permissions (does not include hosts or origins). Anything listed here must appear in the optional_permissions list in the manifest.
             */
            origins?: string[];
            /**
             * Optional.
             * List of origin permissions. Anything listed here must be a subset of a host that appears in the optional_permissions list in the manifest. For example, if http://*.example.com/ or http://* appears in optional_permissions, you can request an origin of http://help.example.com/. Any path is ignored.
             */
            permissions?: string[];
        }

        export interface PermissionsRemovedEvent {
            /**
             * Parameter permissions: The permissions that have been removed.
             */
            addListener(): Promise<Permissions>;
        }

        export interface PermissionsAddedEvent {
            /**
             * Parameter permissions: The newly acquired permissions.
             */
            addListener(): Promise<Permissions>;
        }

        /**
         * Checks if the extension has the specified permissions.
         * Parameter result: True if the extension has the specified permissions.
         */
        export function contains(permissions: Permissions): Promise<boolean>;
        /**
         * Gets the extension's current set of permissions.
         * Parameter permissions: The extension's active permissions.
         */
        export function getAll(): Promise<Permissions>;
        /**
         * Requests access to the specified permissions. These permissions must be defined in the optional_permissions field of the manifest. If there are any problems requesting the permissions, runtime.lastError will be set.
         * Parameter granted: True if the user granted the specified permissions.
         */
        export function request(permissions: Permissions): Promise<boolean>;
        /**
         * Removes access to the specified permissions. If there are any problems removing the permissions, runtime.lastError will be set.
         * Parameter removed: True if the permissions were removed.
         */
        export function remove(permissions: Permissions): Promise<boolean>;

        /** Fired when access to permissions has been removed from the extension. */
        export var onRemoved: PermissionsRemovedEvent;
        /** Fired when the extension acquires new permissions. */
        export var onAdded: PermissionsAddedEvent;
    }
}