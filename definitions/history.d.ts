// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // History
    ////////////////////
    /**
     * Use the browser.history API to interact with the browser's record of visited pages. You can add, remove, and query for URLs in the browser's history. To override the history page with your own version, see Override Pages. * Permissions:  "history"
     */
    export namespace history {
        /** An object encapsulating one visit to a URL. */
        export interface VisitItem {
            /** The transition type for this visit from its referrer. */
            transition: string;
            /** Optional. When this visit occurred, represented in milliseconds since the epoch. */
            visitTime?: number;
            /** The unique identifier for this visit. */
            visitId: string;
            /** The visit ID of the referrer. */
            referringVisitId: string;
            /** The unique identifier for the item. */
            id: string;
        }

        /** An object encapsulating one result of a history query. */
        export interface HistoryItem {
            /** Optional. The number of times the user has navigated to this page by typing in the address. */
            typedCount?: number;
            /** Optional. The title of the page when it was last loaded. */
            title?: string;
            /** Optional. The URL navigated to by a user. */
            url?: string;
            /** Optional. When this page was last loaded, represented in milliseconds since the epoch. */
            lastVisitTime?: number;
            /** Optional. The number of times the user has navigated to this page. */
            visitCount?: number;
            /** The unique identifier for the item. */
            id: string;
        }

        export interface HistoryQuery {
            /** A free-text query to the history service. Leave empty to retrieve all pages. */
            text: string;
            /** Optional. The maximum number of results to retrieve. Defaults to 100. */
            maxResults?: number;
            /** Optional. Limit results to those visited after this date, represented in milliseconds since the epoch. */
            startTime?: number;
            /** Optional. Limit results to those visited before this date, represented in milliseconds since the epoch. */
            endTime?: number;
        }

        export interface Url {
            /** The URL for the operation. It must be in the format as returned from a call to history.search. */
            url: string;
        }

        export interface Range {
            /** Items added to history before this date, represented in milliseconds since the epoch. */
            endTime: number;
            /** Items added to history after this date, represented in milliseconds since the epoch. */
            startTime: number;
        }

        export interface RemovedResult {
            /** True if all history was removed. If true, then urls will be empty. */
            allHistory: boolean;
            /** Optional. */
            urls?: string[];
        }

        export interface HistoryVisitedEvent extends events.Event<(result: HistoryItem) => void> { }

        export interface HistoryVisitRemovedEvent extends events.Event<(removed: RemovedResult) => void> { }

        /**
         * Searches the history for the last visit time of each page matching the query.
         */
        export function search(query: HistoryQuery): Promise<HistoryItem[]>;
        /**
         * Adds a URL to the history at the current time with a transition type of "link".
         */
        export function addUrl(details: Url): Promise<void>;
        /**
         * Removes all items within the specified date range from the history. Pages will not be removed from the history unless all visits fall within the range.
         */
        export function deleteRange(range: Range): Promise<void>;
        /**
         * Deletes all items from the history.
         */
        export function deleteAll(): Promise<void>;
        /**
         * Retrieves information about visits to a URL.
         */
        export function getVisits(details: Url): Promise<VisitItem[]>;
        /**
         * Removes all occurrences of the given URL from the history.
         */
        export function deleteUrl(details: Url): Promise<void>;

        /** Fired when a URL is visited, providing the HistoryItem data for that URL. This event fires before the page has loaded. */
        export var onVisited: HistoryVisitedEvent;
        /** Fired when one or more URLs are removed from the history service. When all visits have been removed the URL is purged from history. */
        export var onVisitRemoved: HistoryVisitRemovedEvent;
    }
}