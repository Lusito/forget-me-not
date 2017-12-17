import { Events } from "./events";

// todo: check mdn compatibility
////////////////////
// Management
////////////////////
/**
 * The browser.management API provides ways to manage the list of extensions/apps that are installed and running. It is particularly useful for extensions that override the built-in New Tab page.
 * Permissions:  "management"
 */
export namespace Management {
    /** Information about an installed extension, app, or theme. */
    export interface ExtensionInfo {
        /**
         * Optional.
         * A reason the item is disabled.
         */
        disabledReason?: string;
        /** Optional. The launch url (only present for apps). */
        appLaunchUrl?: string;
        /**
         * The description of this extension, app, or theme.
         */
        description: string;
        /**
         * Returns a list of API based permissions.
         */
        permissions: string[];
        /**
         * Optional.
         * A list of icon information. Note that this just reflects what was declared in the manifest, and the actual image at that url may be larger or smaller than what was declared, so you might consider using explicit width and height attributes on img tags referencing these images. See the manifest documentation on icons for more details.
         */
        icons?: IconInfo[];
        /**
         * Returns a list of host based permissions.
         */
        hostPermissions: string[];
        /** Whether it is currently enabled or disabled. */
        enabled: boolean;
        /**
         * Optional.
         * The URL of the homepage of this extension, app, or theme.
         */
        homepageUrl?: string;
        /**
         * Whether this extension can be disabled or uninstalled by the user.
         */
        mayDisable: boolean;
        /**
         * How the extension was installed.
         */
        installType: string;
        /** The version of this extension, app, or theme. */
        version: string;
        /** The extension's unique identifier. */
        id: string;
        /**
         * Whether the extension, app, or theme declares that it supports offline.
         */
        offlineEnabled: boolean;
        /**
         * Optional.
         * The update URL of this extension, app, or theme.
         */
        updateUrl?: string;
        /**
         * The type of this extension, app, or theme.
         */
        type: string;
        /** The url for the item's options page, if it has one. */
        optionsUrl: string;
        /** The name of this extension, app, or theme. */
        name: string;
        /**
         * A short version of the name of this extension, app, or theme.
         */
        shortName: string;
        /**
         * Optional.
         * The app launch type (only present for apps).
         */
        launchType?: string;
        /**
         * Optional.
         * The currently available launch types (only present for apps).
         */
        availableLaunchTypes?: string[];
    }

    /** Information about an icon belonging to an extension, app, or theme. */
    export interface IconInfo {
        /** The URL for this icon image. To display a grayscale version of the icon (to indicate that an extension is disabled, for example), append ?grayscale=true to the URL. */
        url: string;
        /** A number representing the width and height of the icon. Likely values include (but are not limited to) 128, 48, 24, and 16. */
        size: number;
    }

    export interface UninstallOptions {
        /**
         * Optional.
         * Whether or not a confirm-uninstall dialog should prompt the user. Defaults to false for self uninstalls. If an extension uninstalls another extension, this parameter is ignored and the dialog is always shown.
         */
        showConfirmDialog?: boolean;
    }

    export interface ManagementDisabledEvent extends Events.Event<(info: ExtensionInfo) => void> { }

    export interface ManagementUninstalledEvent extends Events.Event<(id: string) => void> { }

    export interface ManagementInstalledEvent extends Events.Event<(info: ExtensionInfo) => void> { }

    export interface ManagementEnabledEvent extends Events.Event<(info: ExtensionInfo) => void> { }

    export interface Static {
        /**
         * Enables or disables an app or extension.
         * @param id This should be the id from an item of management.ExtensionInfo.
         * @param enabled Whether this item should be enabled or disabled.
         */
        setEnabled(id: string, enabled: boolean): Promise<void>;
        /**
         * Returns a list of permission warnings for the given extension id.
         * @param id The ID of an already installed extension.
         */
        getPermissionWarningsById(id: string): Promise<string[]>;
        /**
         * Returns information about the installed extension, app, or theme that has the given ID.
         * @param id The ID from an item of management.ExtensionInfo.
         */
        get(id: string): Promise<ExtensionInfo>;
        /**
         * Returns a list of information about installed extensions and apps.
         */
        getAll(): Promise<ExtensionInfo[]>;
        /**
         * Returns a list of permission warnings for the given extension manifest string. Note: This export function can be used without requesting the 'management' permission in the manifest.
         * @param manifestStr Extension manifest JSON string.
         */
        getPermissionWarningsByManifest(manifestStr: string): Promise<string[]>;
        /**
         * Launches an application.
         * @param id The extension id of the application.
         */
        launchApp(id: string): Promise<void>;
        /**
         * Uninstalls a currently installed app or extension.
         * @param id This should be the id from an item of management.ExtensionInfo.
         */
        uninstall(id: string, options?: UninstallOptions): Promise<void>;
        /**
         * Returns information about the calling extension, app, or theme. Note: This export function can be used without requesting the 'management' permission in the manifest.
         */
        getSelf(): Promise<ExtensionInfo>;
        /**
         * Uninstalls the calling extension.
         * Note: This export function can be used without requesting the 'management' permission in the manifest.
         */
        uninstallSelf(options?: UninstallOptions): Promise<void>;
        /**
         * Uninstalls the calling extension.
         * Note: This export function can be used without requesting the 'management' permission in the manifest.
         */
        uninstallSelf(): Promise<void>;
        /**
         * Display options to create shortcuts for an app. On Mac, only packaged app shortcuts can be created.
         */
        createAppShortcut(id: string): Promise<void>;
        /**
         * Set the launch type of an app.
         * @param id This should be the id from an app item of management.ExtensionInfo.
         * @param launchType The target launch type. Always check and make sure this launch type is in ExtensionInfo.availableLaunchTypes, because the available launch types export vary on different platforms and configurations.
         */
        setLaunchType(id: string, launchType: string): Promise<void>;
        /**
         * Generate an app for a URL. Returns the generated bookmark app.
         * @param url The URL of a web page. The scheme of the URL can only be "http" or "https".
         * @param title The title of the generated app.
         */
        generateAppForLink(url: string, title: string): Promise<ExtensionInfo>;

        /** Fired when an app or extension has been disabled. */
        onDisabled: ManagementDisabledEvent;
        /** Fired when an app or extension has been uninstalled. */
        onUninstalled: ManagementUninstalledEvent;
        /** Fired when an app or extension has been installed. */
        onInstalled: ManagementInstalledEvent;
        /** Fired when an app or extension has been enabled. */
        onEnabled: ManagementEnabledEvent;
    }
}