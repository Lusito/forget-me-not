/// <reference path="runtime.d.ts"/>

// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // Extension
    ////////////////////
    /**
     * The browser.extension API has utilities that can be used by any extension page. It includes support for exchanging messages between an extension and its content scripts or between extensions, as described in detail in Message Passing. */
    export namespace extension {
        export interface FetchProperties {
            /** Optional. The window to restrict the search to. If omitted, returns all views.  */
            windowId?: number;
            /** Optional. The type of view to get. If omitted, returns all views (including background pages and tabs). Valid values: 'tab', 'notification', 'popup'.  */
            type?: string;
        }

        export interface LastError {
            /** Description of the error that has taken place. */
            message: string;
        }

        export interface OnRequestEvent extends events.Event<((request: any, sender: runtime.MessageSender, sendResponse: (response: any) => void) => void) | ((sender: runtime.MessageSender, sendResponse: (response: any) => void) => void)> { }

        /**
         * Since Chrome 7.
         * True for content scripts running inside incognito tabs, and for extension pages running inside an incognito process. The latter only applies to extensions with 'split' incognito_behavior.
         */
        export var inIncognitoContext: boolean;
        /** Set for the lifetime of a callback if an ansychronous extension api has resulted in an error. If no error has occured lastError will be undefined. */
        export var lastError: LastError;

        /** Returns the JavaScript 'window' object for the background page running inside the current extension. Returns null if the extension has no background page. */
        export function getBackgroundPage(): Window | null;
        /**
         * Converts a relative path within an extension install directory to a fully-qualified URL.
         * @param path A path to a resource within an extension expressed relative to its install directory.
         */
        export function getURL(path: string): string;
        /**
         * Sets the value of the ap CGI parameter used in the extension's update URL. This value is ignored for extensions that are hosted in the Chrome Extension Gallery.
         * Since Chrome 9.
         */
        export function setUpdateUrlData(data: string): void;
        /** Returns an array of the JavaScript 'window' objects for each of the pages running inside the current extension. */
        export function getViews(fetchProperties?: FetchProperties): Window[];
        /**
         * Retrieves the state of the extension's access to the 'file://' scheme (as determined by the user-controlled 'Allow access to File URLs' checkbox.
         * Since Chrome 12.
         * Parameter isAllowedAccess: True if the extension can access the 'file://' scheme, false otherwise.
         */
        export function isAllowedFileSchemeAccess(): Promise<boolean>;
        /**
         * Retrieves the state of the extension's access to Incognito-mode (as determined by the user-controlled 'Allowed in Incognito' checkbox.
         * Since Chrome 12.
         * Parameter isAllowedAccess: True if the extension has access to Incognito mode, false otherwise.
         */
        export function isAllowedIncognitoAccess(): Promise<boolean>;
    }
}