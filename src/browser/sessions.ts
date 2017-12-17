import { Tabs } from "./tabs";
import { Events } from "./events";
import { Windows } from "./windows";

// todo: check mdn compatibility
////////////////////
// Sessions
////////////////////
/**
 * Use the browser.sessions API to query and restore tabs and windows from a browsing session.
 * Permissions:  "sessions"
 */
export namespace Sessions {
    export interface Filter {
        /**
         * Optional.
         * The maximum number of entries to be fetched in the requested list. Omit this parameter to fetch the maximum number of entries (sessions.MAX_SESSION_RESULTS).
         */
        maxResults?: number;
    }

    export interface Session {
        /** The time when the window or tab was closed or modified, represented in milliseconds since the epoch. */
        lastModified: number;
        /**
         * Optional.
         * The tabs.Tab, if this entry describes a tab. Either this or sessions.Session.window will be set.
         */
        tab?: Tabs.Tab;
        /**
         * Optional.
         * The windows.Window, if this entry describes a window. Either this or sessions.Session.tab will be set.
         */
        window?: Windows.Window;
    }

    export interface Device {
        /** The name of the foreign device. */
        deviceName: string;
        /** A list of open window sessions for the foreign device, sorted from most recently to least recently modified session. */
        sessions: Session[];
    }

    export interface SessionChangedEvent extends Events.Event<() => void> { }

    export interface Static {
        /** The maximum number of sessions.Session that will be included in a requested list. */
        MAX_SESSION_RESULTS: number;

        /**
         * Gets the list of recently closed tabs and/or windows.
         */
        getRecentlyClosed(filter: Filter): Promise<Session[]>;
        /**
         * Gets the list of recently closed tabs and/or windows.
         */
        getRecentlyClosed(): Promise<Session[]>;
        /**
         * Retrieves all devices with synced sessions.
         */
        getDevices(filter: Filter): Promise<Device[]>;
        /**
         * Retrieves all devices with synced sessions.
         */
        getDevices(): Promise<Device[]>;
        /**
         * Reopens a windows.Window or tabs.Tab.
         * @param sessionId Optional.
         * The windows.Window.sessionId, or tabs.Tab.sessionId to restore. If this parameter is not specified, the most recently closed session is restored.
         */
        restore(sessionId?: string): Promise<Session>;

        /** Fired when recently closed tabs and/or windows are changed. This event does not monitor synced sessions changes. */
        onChanged: SessionChangedEvent;
    }
}