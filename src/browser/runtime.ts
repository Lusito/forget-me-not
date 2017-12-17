import { Events } from "./events";
import { Tabs } from "./tabs";

// todo: check mdn compatibility
////////////////////
// Runtime
////////////////////
/**
 * Use the browser.runtime API to retrieve the background page, return details about the manifest, and listen for and respond to events in the app or extension lifecycle. You can also use this API to convert the relative path of URLs to fully-qualified URLs.
 */
export namespace Runtime {
    export interface LastError {
        /** Optional. Details about the error which occurred.  */
        message?: string;
    }

    export interface ConnectInfo {
        name?: string;
    }

    export interface InstalledDetails {
        /**
         * The reason that this event is being dispatched.
         * One of: "install", "update", "chrome_update", or "shared_module_update"
         */
        reason: string;
        /**
         * Optional.
         * Indicates the previous version of the extension, which has just been updated. This is present only if 'reason' is 'update'.
         */
        previousVersion?: string;
        /**
         * Optional.
         * Indicates the ID of the imported shared module extension which updated. This is present only if 'reason' is 'shared_module_update'.
         */
        id?: string;
    }

    export interface MessageOptions {
        /** Whether the TLS channel ID will be passed into onMessageExternal for processes that are listening for the connection event. */
        includeTlsChannelId?: boolean;
    }

    /**
     * An object containing information about the script context that sent a message or request.
     */
    export interface MessageSender {
        /** The ID of the extension or app that opened the connection, if any. */
        id?: string;
        /** The tabs.Tab which opened the connection, if any. This property will only be present when the connection was opened from a tab (including content scripts), and only if the receiver is an extension, not an app. */
        tab?: Tabs.Tab;
        /**
         * The frame that opened the connection. 0 for top-level frames, positive for child frames. This will only be set when tab is set.
         */
        frameId?: number;
        /**
         * The URL of the page or frame that opened the connection. If the sender is in an iframe, it will be iframe's URL not the URL of the page which hosts it.
         */
        url?: string;
        /**
         * The TLS channel ID of the page or frame that opened the connection, if requested by the extension or app, and if available.
         */
        tlsChannelId?: string;
    }

    /**
     * An object containing information about the current platform.
     */
    export interface PlatformInfo {
        /**
         * The operating system browser is running on.
         * One of: "mac", "win", "android", "cros", "linux", or "openbsd"
         */
        os: string;
        /**
         * The machine's processor architecture.
         * One of: "arm", "x86-32", or "x86-64"
         */
        arch: string;
        /**
         * The native client architecture. This may be different from arch on some platforms.
         * One of: "arm", "x86-32", or "x86-64"
         */
        nacl_arch: string;
    }

    /**
     * An object which allows two way communication with other pages.
     */
    export interface Port {
        postMessage: (message: Object) => void;
        disconnect: () => void;
        /**
         * Optional.
         * This property will only be present on ports passed to onConnect/onConnectExternal listeners.
         */
        sender?: MessageSender;
        /** An object which allows the addition and removal of listeners for a Chrome event. */
        onDisconnect: PortDisconnectEvent;
        /** An object which allows the addition and removal of listeners for a Chrome event. */
        onMessage: PortMessageEvent;
        name: string;
    }

    export interface UpdateAvailableDetails {
        /** The version number of the available update. */
        version: string;
    }

    export interface UpdateCheckDetails {
        /** The version of the available update. */
        version: string;
    }

    export interface PortDisconnectEvent extends Events.Event<(port: Port) => void> { }

    export interface PortMessageEvent extends Events.Event<(message: Object, port: Port) => void> { }

    export interface ExtensionMessageEvent extends Events.Event<(message: any, sender: MessageSender, sendResponse: (response: any) => void) => void> { }

    export interface ExtensionConnectEvent extends Events.Event<(port: Port) => void> { }

    export interface RuntimeInstalledEvent extends Events.Event<(details: InstalledDetails) => void> { }

    export interface RuntimeEvent extends Events.Event<() => void> { }

    export interface RuntimeRestartRequiredEvent extends Events.Event<(reason: string) => void> { }

    export interface RuntimeUpdateAvailableEvent extends Events.Event<(details: UpdateAvailableDetails) => void> { }

    export interface ManifestIcons {
        [size: number]: string;
    }

    export interface ManifestAction {
        default_icon?: ManifestIcons;
        default_title?: string;
        default_popup?: string;
    }

    export interface SearchProvider {
        name?: string;
        keyword?: string;
        favicon_url?: string;
        search_url: string;
        encoding?: string;
        suggest_url?: string;
        instant_url?: string;
        image_url?: string;
        search_url_post_params?: string;
        suggest_url_post_params?: string;
        instant_url_post_params?: string;
        image_url_post_params?: string;
        alternate_urls?: string[];
        prepopulated_id?: number;
        is_default?: boolean;
    }

    export interface PageStateUrlDetails {
        /** Optional. Matches if the host name of the URL contains a specified string. To test whether a host name component has a prefix 'foo', use hostContains: '.foo'. This matches 'www.foobar.com' and 'foo.com', because an implicit dot is added at the beginning of the host name. Similarly, hostContains can be used to match against component suffix ('foo.') and to exactly match against components ('.foo.'). Suffix- and exact-matching for the last components need to be done separately using hostSuffix, because no implicit dot is added at the end of the host name.  */
        hostContains?: string;
        /** Optional. Matches if the host name of the URL is equal to a specified string.  */
        hostEquals?: string;
        /** Optional. Matches if the host name of the URL starts with a specified string.  */
        hostPrefix?: string;
        /** Optional. Matches if the host name of the URL ends with a specified string.  */
        hostSuffix?: string;
        /** Optional. Matches if the path segment of the URL contains a specified string.  */
        pathContains?: string;
        /** Optional. Matches if the path segment of the URL is equal to a specified string.  */
        pathEquals?: string;
        /** Optional. Matches if the path segment of the URL starts with a specified string.  */
        pathPrefix?: string;
        /** Optional. Matches if the path segment of the URL ends with a specified string.  */
        pathSuffix?: string;
        /** Optional. Matches if the query segment of the URL contains a specified string.  */
        queryContains?: string;
        /** Optional. Matches if the query segment of the URL is equal to a specified string.  */
        queryEquals?: string;
        /** Optional. Matches if the query segment of the URL starts with a specified string.  */
        queryPrefix?: string;
        /** Optional. Matches if the query segment of the URL ends with a specified string.  */
        querySuffix?: string;
        /** Optional. Matches if the URL (without fragment identifier) contains a specified string. Port numbers are stripped from the URL if they match the default port number.  */
        urlContains?: string;
        /** Optional. Matches if the URL (without fragment identifier) is equal to a specified string. Port numbers are stripped from the URL if they match the default port number.  */
        urlEquals?: string;
        /** Optional. Matches if the URL (without fragment identifier) matches a specified regular expression. Port numbers are stripped from the URL if they match the default port number. The regular expressions use the RE2 syntax.  */
        urlMatches?: string;
        /** Optional. Matches if the URL without query segment and fragment identifier matches a specified regular expression. Port numbers are stripped from the URL if they match the default port number. The regular expressions use the RE2 syntax.  */
        originAndPathMatches?: string;
        /** Optional. Matches if the URL (without fragment identifier) starts with a specified string. Port numbers are stripped from the URL if they match the default port number.  */
        urlPrefix?: string;
        /** Optional. Matches if the URL (without fragment identifier) ends with a specified string. Port numbers are stripped from the URL if they match the default port number.  */
        urlSuffix?: string;
        /** Optional. Matches if the scheme of the URL is equal to any of the schemes specified in the array.  */
        schemes?: string[];
        /** Optional. Matches if the port of the URL is contained in any of the specified port lists. For example [80, 443, [1000, 1200]] matches all requests on port 80, 443 and in the range 1000-1200.  */
        ports?: (number | number[])[];
    }

    class PageStateMatcherProperties {
        /** Optional. Filters URLs for export various criteria. See event filtering. All criteria are case sensitive.  */
        pageUrl?: PageStateUrlDetails;
        /** Optional. Matches if all of the CSS selectors in the array match displayed elements in a frame with the same origin as the page's main frame. All selectors in this array must be compound selectors to speed up matching. Note that listing hundreds of CSS selectors or CSS selectors that match hundreds of times per page can still slow down web sites.  */
        css?: string[];
        /**
         * Optional.
         * Warning: this is the current Beta channel. More information available on the API documentation pages.
        * Matches if the bookmarked state of the page is equal to the specified value. Requres the bookmarks permission.
        */
        isBookmarked?: boolean;
    }

    export interface Manifest {
        // Required
        manifest_version: number;
        name: string;
        version: string;

        // Recommended
        default_locale?: string;
        description?: string;
        icons?: ManifestIcons;

        // Pick one (or none)
        browser_action?: ManifestAction;
        page_action?: ManifestAction;

        // Optional
        author?: any;
        automation?: any;
        background?: {
            scripts?: string[];
            page?: string;
            persistent?: boolean;
        };
        background_page?: string;
        chrome_settings_overrides?: {
            homepage?: string;
            search_provider?: SearchProvider;
            startup_pages?: string[];
        };
        chrome_ui_overrides?: {
            bookmarks_ui?: {
                remove_bookmark_shortcut?: boolean;
                remove_button?: boolean;
            }
        };
        chrome_url_overrides?: {
            bookmarks?: string;
            history?: string;
            newtab?: string;
        };
        commands?: {
            [name: string]: {
                suggested_key?: {
                    default?: string;
                    windows?: string;
                    mac?: string;
                    chromeos?: string;
                    linux?: string;
                };
                description?: string;
                global?: boolean
            }
        };
        content_capabilities?: {
            matches?: string[];
            permissions?: string[];
        };
        content_scripts?: {
            matches?: string[];
            exclude_matches?: string[];
            css?: string[];
            js?: string[];
            run_at?: string;
            all_frames?: boolean;
            include_globs?: string[];
            exclude_globs?: string[];
        }[];
        content_security_policy?: string;
        converted_from_user_script?: boolean;
        copresence?: any;
        current_locale?: string;
        devtools_page?: string;
        event_rules?: {
            event?: string;
            actions?: {
                type: string;
            }[];
            conditions?: PageStateMatcherProperties[]
        }[];
        externally_connectable?: {
            ids?: string[];
            matches?: string[];
            accepts_tls_channel_id?: boolean;
        };
        file_browser_handlers?: {
            id?: string;
            default_title?: string;
            file_filters?: string[];
        }[];
        file_system_provider_capabilities?: {
            configurable?: boolean;
            watchable?: boolean;
            multiple_mounts?: boolean;
            source?: string;
        };
        homepage_url?: string;
        import?: {
            id: string;
            minimum_version?: string
        }[];
        export?: {
            whitelist?: string[]
        };
        incognito?: string;
        input_components?: {
            name?: string;
            type?: string;
            id?: string;
            description?: string;
            language?: string;
            layouts?: any[];
        }[];
        key?: string;
        minimum_chrome_version?: string;
        nacl_modules?: {
            path: string;
            mime_type: string;
        }[];
        oauth2?: {
            client_id: string;
            scopes?: string[];
        };
        offline_enabled?: boolean;
        omnibox?: {
            keyword: string;
        };
        optional_permissions?: string[];
        options_page?: string;
        options_ui?: {
            page?: string;
            chrome_style?: boolean;
            open_in_tab?: boolean;
        };
        permissions?: string[];
        platforms?: {
            nacl_arch?: string;
            sub_package_path: string;
        }[];
        plugins?: {
            path: string;
        }[];
        requirements?: {
            '3D'?: {
                features?: string[]
            };
            plugins?: {
                npapi?: boolean;
            }
        };
        sandbox?: {
            pages: string[];
            content_security_policy?: string;
        };
        short_name?: string;
        signature?: any;
        spellcheck?: {
            dictionary_language?: string;
            dictionary_locale?: string;
            dictionary_format?: string;
            dictionary_path?: string;
        };
        storage?: {
            managed_schema: string
        };
        system_indicator?: any;
        tts_engine?: {
            voices: {
                voice_name: string;
                lang?: string;
                gender?: string;
                event_types?: string[];
            }[]
        };
        update_url?: string;
        version_name?: string;
        web_accessible_resources?: string[];
        [key: string]: any;
    }
    export interface Static {
        /** This will be defined during an API method callback if there was an error */
        lastError: LastError | undefined;
        /** The ID of the extension/app. */
        id: string;

        /**
         * Attempts to connect to connect listeners within an extension/app (such as the background page), or other extensions/apps. This is useful for content scripts connecting to their extension processes, inter-app/extension communication, and web messaging. Note that this does not connect to any listeners in a content script. Extensions may connect to content scripts embedded in tabs via tabs.connect.
         */
        connect(connectInfo?: ConnectInfo): Port;
        /**
         * Attempts to connect to connect listeners within an extension/app (such as the background page), or other extensions/apps. This is useful for content scripts connecting to their extension processes, inter-app/extension communication, and web messaging. Note that this does not connect to any listeners in a content script. Extensions may connect to content scripts embedded in tabs via tabs.connect.
         * @param extensionId Optional.
         * The ID of the extension or app to connect to. If omitted, a connection will be attempted with your own extension. Required if sending messages from a web page for web messaging.
         */
        connect(extensionId: string, connectInfo?: ConnectInfo): Port;
        /**
         * Connects to a native application in the host machine.
         * @param application The name of the registered application to connect to.
         */
        connectNative(application: string): Port;
        /** Retrieves the JavaScript 'window' object for the background page running inside the current extension/app. If the background page is an event page, the system will ensure it is loaded before calling the callback. If there is no background page, an error is set. */
        getBackgroundPage(): Promise<Window>;
        /**
         * Returns details about the app or extension from the manifest. The object returned is a serialization of the full manifest file.
         * @returns The manifest details.
         */
        getManifest(): Manifest;
        /**
         * Returns a DirectoryEntry for the package directory.
         */
        // getPackageDirectoryEntry(): Promise<DirectoryEntry>;
        /**
         * Returns information about the current platform.
         */
        getPlatformInfo(): Promise<PlatformInfo>;
        /**
         * Converts a relative path within an app/extension install directory to a fully-qualified URL.
         * @param path A path to a resource within an app/extension expressed relative to its install directory.
         */
        getURL(path: string): string;
        /**
         * Reloads the app or extension.
         */
        reload(): void;
        /**
         * Requests an update check for this app/extension.
         */
        requestUpdateCheck(): Promise<UpdateCheckDetails>;
        /**
         * Restart the ChromeOS device when the app runs in kiosk mode. Otherwise, it's no-op.
         */
        restart(): void;
        /**
         * Sends a single message to event listeners within your extension/app or a different extension/app. Similar to runtime.connect but only sends a single message, with an optional response. If sending to your extension, the runtime.onMessage event will be fired in each page, or runtime.onMessageExternal, if a different extension. Note that extensions cannot send messages to content scripts using this method. To send messages to content scripts, use tabs.sendMessage.
         */
        sendMessage(message: any): Promise<any>;
        /**
         * Sends a single message to event listeners within your extension/app or a different extension/app. Similar to runtime.connect but only sends a single message, with an optional response. If sending to your extension, the runtime.onMessage event will be fired in each page, or runtime.onMessageExternal, if a different extension. Note that extensions cannot send messages to content scripts using this method. To send messages to content scripts, use tabs.sendMessage.
         */
        sendMessage(message: any, options: MessageOptions): Promise<any>;
        /**
         * Sends a single message to event listeners within your extension/app or a different extension/app. Similar to runtime.connect but only sends a single message, with an optional response. If sending to your extension, the runtime.onMessage event will be fired in each page, or runtime.onMessageExternal, if a different extension. Note that extensions cannot send messages to content scripts using this method. To send messages to content scripts, use tabs.sendMessage.
         * @param extensionId The ID of the extension/app to send the message to. If omitted, the message will be sent to your own extension/app. Required if sending messages from a web page for web messaging.
         */
        sendMessage(extensionId: string, message: any): Promise<any>;
        /**
         * Sends a single message to event listeners within your extension/app or a different extension/app. Similar to runtime.connect but only sends a single message, with an optional response. If sending to your extension, the runtime.onMessage event will be fired in each page, or runtime.onMessageExternal, if a different extension. Note that extensions cannot send messages to content scripts using this method. To send messages to content scripts, use tabs.sendMessage.
         * @param extensionId The ID of the extension/app to send the message to. If omitted, the message will be sent to your own extension/app. Required if sending messages from a web page for web messaging.
         */
        sendMessage(extensionId: string, message: any, options: MessageOptions): Promise<any>;
        /**
         * Send a single message to a native application.
         * @param application The of the native messaging host.
         * @param message The message that will be passed to the native messaging host.
         */
        sendNativeMessage(application: string, message: Object): Promise<any>;
        /**
         * Sets the URL to be visited upon uninstallation. This may be used to clean up server-side data, do analytics, and implement surveys. Maximum 255 characters.
         * @param url 
         * URL to be opened after the extension is uninstalled. This URL must have an http: or https: scheme. Set an empty string to not open a new tab upon uninstallation.
         */
        setUninstallURL(url: string): Promise<void>;
        /**
         * Open your Extension's options page, if possible.
         * The precise behavior may depend on your manifest's options_ui or options_page key, or what Chrome happens to support at the time. For example, the page may be opened in a new tab, within browser://extensions, within an App, or it may just focus an open options page. It will never cause the caller page to reload.
         * If your Extension does not declare an options page, or Chrome failed to create one for some other reason, the callback will set lastError.
         */
        openOptionsPage(): Promise<void>;

        /**
         * Fired when a connection is made from either an extension process or a content script.
         */
        onConnect: ExtensionConnectEvent;
        /**
         * Fired when a connection is made from another extension.
         */
        onConnectExternal: ExtensionConnectEvent;
        /** Sent to the event page just before it is unloaded. This gives the extension opportunity to do some clean up. Note that since the page is unloading, any asynchronous operations started while handling this event are not guaranteed to complete. If more activity for the event page occurs before it gets unloaded the onSuspendCanceled event will be sent and the page won't be unloaded. */
        onSuspend: RuntimeEvent;
        /**
         * Fired when a profile that has this extension installed first starts up. This event is not fired when an incognito profile is started, even if this extension is operating in 'split' incognito mode.
         */
        onStartup: RuntimeEvent;
        /** Fired when the extension is first installed, when the extension is updated to a new version, and when Chrome is updated to a new version. */
        onInstalled: RuntimeInstalledEvent;
        /** Sent after onSuspend to indicate that the app won't be unloaded after all. */
        onSuspendCanceled: RuntimeEvent;
        /**
         * Fired when a message is sent from either an extension process or a content script.
         */
        onMessage: ExtensionMessageEvent;
        /**
         * Fired when a message is sent from another extension/app. Cannot be used in a content script.
         */
        onMessageExternal: ExtensionMessageEvent;
        /**
         * Fired when an update is available, but isn't installed immediately because the app is currently running. If you do nothing, the update will be installed the next time the background page gets unloaded, if you want it to be installed sooner you can explicitly call browser.runtime.reload(). If your extension is using a persistent background page, the background page of course never gets unloaded, so unless you call browser.runtime.reload() manually in response to this event the update will not get installed until the next time browser itself restarts. If no handlers are listening for this event, and your extension has a persistent background page, it behaves as if browser.runtime.reload() is called in response to this event.
         */
        onUpdateAvailable: RuntimeUpdateAvailableEvent;
    }
}