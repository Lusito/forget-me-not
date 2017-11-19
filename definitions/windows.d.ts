// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // Windows
    ////////////////////
    /**
     * Use the windows API to interact with browser windows. You can use this API to create, modify, and rearrange windows in the browser.
     * Permissions: The windows API can be used without declaring any permission. However, the "tabs" permission is required in order to populate the url, title, and favIconUrl properties of Tab objects.
     */
    export namespace windows {
        export interface Window {
            /** Array of tabs.Tab objects representing the current tabs in the window. */
            tabs?: tabs.Tab[];
            /** Optional. The offset of the window from the top edge of the screen in pixels. Under some circumstances a Window may not be assigned top property, for example when querying closed windows from the sessions API. */
            top?: number;
            /** Optional. The height of the window, including the frame, in pixels. Under some circumstances a Window may not be assigned height property, for example when querying closed windows from the sessions API. */
            height?: number;
            /** Optional. The width of the window, including the frame, in pixels. Under some circumstances a Window may not be assigned width property, for example when querying closed windows from the sessions API. */
            width?: number;
            /**
             * The state of this browser window.
             * One of: "normal", "minimized", "maximized", "fullscreen", or "docked"
             */
            state: string;
            /** Whether the window is currently the focused window. */
            focused: boolean;
            /**
             * Whether the window is set to be always on top.
             */
            alwaysOnTop: boolean;
            /** Whether the window is incognito. */
            incognito: boolean;
            /**
             * The type of browser window this is.
             * One of: "normal", "popup", "panel", "app", or "devtools"
             */
            type: string;
            /** Optional. The ID of the window. Window IDs are unique within a browser session. Under some circumstances a Window may not be assigned an ID, for example when querying windows using the sessions API, in which case a session ID may be present. */
            id: number;
            /** Optional. The offset of the window from the left edge of the screen in pixels. Under some circumstances a Window may not be assigned left property, for example when querying closed windows from the sessions API. */
            left?: number;
            /**
             * The session ID used to uniquely identify a Window obtained from the sessions API.
             */
            sessionId?: string;
        }

        export interface GetInfo {
            /**
             * Optional.
             * If true, the windows.Window object will have a tabs property that contains a list of the tabs.Tab objects. The Tab objects only contain the url, title and favIconUrl properties if the extension's manifest file includes the "tabs" permission.
             */
            populate?: boolean;
            /**
             * If set, the windows.Window returned will be filtered based on its type. If unset the default filter is set to ['app', 'normal', 'panel', 'popup'], with 'app' and 'panel' window types limited to the extension's own windows.
             * Each one of: "normal", "popup", "panel", "app", or "devtools"
             */
            windowTypes?: string[];
        }

        export interface CreateData {
            /**
             * Optional. The id of the tab for which you want to adopt to the new window.
             */
            tabId?: number;
            /**
             * Optional.
             * A URL or array of URLs to open as tabs in the window. Fully-qualified URLs must include a scheme (i.e. 'http://www.google.com', not 'www.google.com'). Relative URLs will be relative to the current page within the extension. Defaults to the New Tab Page.
             */
            url?: string | string[];
            /**
             * Optional.
             * The number of pixels to position the new window from the top edge of the screen. If not specified, the new window is offset naturally from the last focused window. This value is ignored for panels.
             */
            top?: number;
            /**
             * Optional.
             * The height in pixels of the new window, including the frame. If not specified defaults to a natural height.
             */
            height?: number;
            /**
             * Optional.
             * The width in pixels of the new window, including the frame. If not specified defaults to a natural width.
             */
            width?: number;
            /**
             * Optional. If true, opens an active window. If false, opens an inactive window.
             */
            focused?: boolean;
            /** Optional. Whether the new window should be an incognito window. */
            incognito?: boolean;
            /**
             * Optional. Specifies what type of browser window to create. The 'panel' and 'detached_panel' types create a popup unless the '--enable-panels' flag is set.
             * One of: "normal", "popup", "panel", or "detached_panel"
             */
            type?: string;
            /**
             * Optional.
             * The number of pixels to position the new window from the left edge of the screen. If not specified, the new window is offset naturally from the last focused window. This value is ignored for panels.
             */
            left?: number;
            /**
             * Optional. The initial state of the window. The 'minimized', 'maximized' and 'fullscreen' states cannot be combined with 'left', 'top', 'width' or 'height'.
             * One of: "normal", "minimized", "maximized", "fullscreen", or "docked"
             */
            state?: string;
        }

        export interface UpdateInfo {
            /** Optional. The offset from the top edge of the screen to move the window to in pixels. This value is ignored for panels. */
            top?: number;
            /**
             * Optional. If true, causes the window to be displayed in a manner that draws the user's attention to the window, without changing the focused window. The effect lasts until the user changes focus to the window. This option has no effect if the window already has focus. Set to false to cancel a previous draw attention request.
             */
            drawAttention?: boolean;
            /** Optional. The height to resize the window to in pixels. This value is ignored for panels. */
            height?: number;
            /** Optional. The width to resize the window to in pixels. This value is ignored for panels. */
            width?: number;
            /**
             * Optional. The new state of the window. The 'minimized', 'maximized' and 'fullscreen' states cannot be combined with 'left', 'top', 'width' or 'height'.
             * One of: "normal", "minimized", "maximized", "fullscreen", or "docked"
             */
            state?: string;
            /**
             * Optional. If true, brings the window to the front. If false, brings the next window in the z-order to the front.
             */
            focused?: boolean;
            /** Optional. The offset from the left edge of the screen to move the window to in pixels. This value is ignored for panels. */
            left?: number;
        }

        export interface WindowEventFilter {
            /**
             * Conditions that the window's type being created must satisfy. By default it will satisfy ['app', 'normal', 'panel', 'popup'], with 'app' and 'panel' window types limited to the extension's own windows.
             * Each one of: "normal", "popup", "panel", "app", or "devtools"
             */
            windowTypes: string[];
        }

        export interface WindowIdEvent extends events.Event<(windowId: number, filters?: WindowEventFilter) => void> { }

        export interface WindowReferenceEvent extends events.Event<(window: Window, filters?: WindowEventFilter) => void> { }

        /**
         * The windowId value that represents the current window.
         */
        export var WINDOW_ID_CURRENT: number;
        /**
         * The windowId value that represents the absence of a browser browser window.
         */
        export var WINDOW_ID_NONE: number;

        /** Gets details about a window. */
        export function get(windowId: number): Promise<windows.Window>;
        /**
         * Gets details about a window.
         */
        export function get(windowId: number, getInfo: GetInfo): Promise<windows.Window>;
        /**
         * Gets the current window.
         */
        export function getCurrent(): Promise<windows.Window>;
        /**
         * Gets the current window.
         */
        export function getCurrent(getInfo: GetInfo): Promise<windows.Window>;
        /**
         * Creates (opens) a new browser with any optional sizing, position or default URL provided.
         */
        export function create(): Promise<windows.Window>;
        /**
         * Creates (opens) a new browser with any optional sizing, position or default URL provided.
         */
        export function create(createData: CreateData): Promise<windows.Window>;
        /**
         * Gets all windows.
         */
        export function getAll(): Promise<windows.Window[]>;
        /**
         * Gets all windows.
         */
        export function getAll(getInfo: GetInfo): Promise<windows.Window[]>;
        /** Updates the properties of a window. Specify only the properties that you want to change; unspecified properties will be left unchanged. */
        export function update(windowId: number, updateInfo: UpdateInfo): Promise<windows.Window>;
        /** Removes (closes) a window, and all the tabs inside it. */
        export function remove(windowId: number): Promise<void>;
        /**
         * Gets the window that was most recently focused — typically the window 'on top'.
         */
        export function getLastFocused(): Promise<windows.Window>;
        /**
         * Gets the window that was most recently focused — typically the window 'on top'.
         */
        export function getLastFocused(getInfo: GetInfo): Promise<windows.Window>;

        /** Fired when a window is removed (closed). */
        export var onRemoved: WindowIdEvent;
        /** Fired when a window is created. */
        export var onCreated: WindowReferenceEvent;
        /**
         * Fired when the currently focused window changes. Will be windows.WINDOW_ID_NONE if all browser windows have lost focus.
         * Note: On some Linux window managers, WINDOW_ID_NONE will always be sent immediately preceding a switch from one browser window to another.
         */
        export var onFocusChanged: WindowIdEvent;
    }
}