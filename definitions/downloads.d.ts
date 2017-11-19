// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // Dev Tools - Downloads
    ////////////////////
    /**
     * Use the browser.downloads API to programmatically initiate, monitor, manipulate, and search for downloads. * Permissions:  "downloads"
     */
    export namespace downloads {
        export interface HeaderNameValuePair {
            /** Name of the HTTP header. */
            name: string;
            /** Value of the HTTP header. */
            value: string;
        }

        export interface DownloadOptions {
            /** Optional. Post body.  */
            body?: string;
            /** Optional. Use a file-chooser to allow the user to select a filename regardless of whether filename is set or already exists.  */
            saveAs?: boolean;
            /** The URL to download. */
            url: string;
            /** Optional. A file path relative to the Downloads directory to contain the downloaded file, possibly containing subdirectories. Absolute paths, empty paths, and paths containing back-references ".." will cause an error. onDeterminingFilename allows suggesting a filename after the file's MIME type and a tentative filename have been determined.  */
            filename?: string;
            /** Optional. Extra HTTP headers to send with the request if the URL uses the HTTP[s] protocol. Each header is represented as a dictionary containing the keys name and either value or binaryValue, restricted to those allowed by XMLHttpRequest.  */
            headers?: HeaderNameValuePair[];
            /** Optional. The HTTP method to use if the URL uses the HTTP[S] protocol.  */
            method?: string;
            /** Optional. The action to take if filename already exists.  */
            conflictAction?: string;
        }

        export interface DownloadDelta {
            /** Optional. The change in danger, if any.  */
            danger?: StringDelta;
            /** Optional. The change in url, if any.  */
            url?: StringDelta;
            /** Optional. The change in totalBytes, if any.  */
            totalBytes?: DoubleDelta;
            /** Optional. The change in filename, if any.  */
            filename?: StringDelta;
            /** Optional. The change in paused, if any.  */
            paused?: BooleanDelta;
            /** Optional. The change in state, if any.  */
            state?: StringDelta;
            /** Optional. The change in mime, if any.  */
            mime?: StringDelta;
            /** Optional. The change in fileSize, if any.  */
            fileSize?: DoubleDelta;
            /** Optional. The change in startTime, if any.  */
            startTime?: DoubleDelta;
            /** Optional. The change in error, if any.  */
            error?: StringDelta;
            /** Optional. The change in endTime, if any.  */
            endTime?: DoubleDelta;
            /** The id of the DownloadItem that changed. */
            id: number;
            /** Optional. The change in canResume, if any.  */
            canResume?: BooleanDelta;
            /** Optional. The change in exists, if any.  */
            exists?: BooleanDelta;
        }

        export interface BooleanDelta {
            current?: boolean;
            previous?: boolean;
        }

        /** Since Chrome 34. */
        export interface DoubleDelta {
            current?: number;
            previous?: number;
        }

        export interface StringDelta {
            current?: string;
            previous?: string;
        }

        export interface DownloadItem {
            /** Number of bytes received so far from the host, without considering file compression. */
            bytesReceived: number;
            /** Indication of whether this download is thought to be safe or known to be suspicious. */
            danger: string;
            /** Absolute URL. */
            url: string;
            /** Number of bytes in the whole file, without considering file compression, or -1 if unknown. */
            totalBytes: number;
            /** Absolute local path. */
            filename: string;
            /** True if the download has stopped reading data from the host, but kept the connection open. */
            paused: boolean;
            /** Indicates whether the download is progressing, interrupted, or complete. */
            state: string;
            /** The file's MIME type. */
            mime: string;
            /** Number of bytes in the whole file post-decompression, or -1 if unknown. */
            fileSize: number;
            /** The time when the download began in ISO 8601 format. May be passed directly to the Date constructor: browser.downloads.search({}, export function(items){items.forEach(export function(item){console.log(new Date(item.startTime))})}) */
            startTime: string;
            /** Optional. Why the download was interrupted. Several kinds of HTTP errors may be grouped under one of the errors beginning with SERVER_. Errors relating to the network begin with NETWORK_, errors relating to the process of writing the file to the file system begin with FILE_, and interruptions initiated by the user begin with USER_.  */
            error?: string;
            /** Optional. The time when the download ended in ISO 8601 format. May be passed directly to the Date constructor: browser.downloads.search({}, export function(items){items.forEach(export function(item){if (item.endTime) console.log(new Date(item.endTime))})})  */
            endTime?: string;
            /** An identifier that is persistent across browser sessions. */
            id: number;
            /** False if this download is recorded in the history, true if it is not recorded. */
            incognito: boolean;
            /** Absolute URL. */
            referrer: string;
            /** Optional. Estimated time when the download will complete in ISO 8601 format. May be passed directly to the Date constructor: browser.downloads.search({}, export function(items){items.forEach(export function(item){if (item.estimatedEndTime) console.log(new Date(item.estimatedEndTime))})})  */
            estimatedEndTime?: string;
            /** True if the download is in progress and paused, or else if it is interrupted and can be resumed starting from where it was interrupted. */
            canResume: boolean;
            /** Whether the downloaded file still exists. This information may be out of date because Chrome does not automatically watch for file removal. Call search() in order to trigger the check for file existence. When the existence check completes, if the file has been deleted, then an onChanged event will fire. Note that search() does not wait for the existence check to finish before returning, so results from search() may not accurately reflect the file system. Also, search() may be called as often as necessary, but will not check for file existence any more frequently than once every 10 seconds. */
            exists: boolean;
            /** Optional. The identifier for the extension that initiated this download if this download was initiated by an extension. Does not change once it is set.  */
            byExtensionId?: string;
            /** Optional. The localized name of the extension that initiated this download if this download was initiated by an extension. May change if the extension changes its name or if the user changes their locale.  */
            byExtensionName?: string;
        }

        export interface GetFileIconOptions {
            /** Optional. * The size of the returned icon. The icon will be square with dimensions size * size pixels. The default and largest size for the icon is 32x32 pixels. The only supported sizes are 16 and 32. It is an error to specify any other size.
     */
            size?: number;
        }

        export interface DownloadQuery {
            /** Optional. Set elements of this array to DownloadItem properties in order to sort search results. For example, setting orderBy=['startTime'] sorts the DownloadItem by their start time in ascending order. To specify descending order, prefix with a hyphen: '-startTime'.  */
            orderBy?: string[];
            /** Optional. Limits results to DownloadItem whose url matches the given regular expression.  */
            urlRegex?: string;
            /** Optional. Limits results to DownloadItem that ended before the given ms since the epoch.  */
            endedBefore?: number;
            /** Optional. Limits results to DownloadItem whose totalBytes is greater than the given integer.  */
            totalBytesGreater?: number;
            /** Optional. Indication of whether this download is thought to be safe or known to be suspicious.  */
            danger?: string;
            /** Optional. Number of bytes in the whole file, without considering file compression, or -1 if unknown.  */
            totalBytes?: number;
            /** Optional. True if the download has stopped reading data from the host, but kept the connection open.  */
            paused?: boolean;
            /** Optional. Limits results to DownloadItem whose filename matches the given regular expression.  */
            filenameRegex?: string;
            /** Optional. This array of search terms limits results to DownloadItem whose filename or url contain all of the search terms that do not begin with a dash '-' and none of the search terms that do begin with a dash.  */
            query?: string[];
            /** Optional. Limits results to DownloadItem whose totalBytes is less than the given integer.  */
            totalBytesLess?: number;
            /** Optional. The id of the DownloadItem to query.  */
            id?: number;
            /** Optional. Number of bytes received so far from the host, without considering file compression.  */
            bytesReceived?: number;
            /** Optional. Limits results to DownloadItem that ended after the given ms since the epoch.  */
            endedAfter?: number;
            /** Optional. Absolute local path.  */
            filename?: string;
            /** Optional. Indicates whether the download is progressing, interrupted, or complete.  */
            state?: string;
            /** Optional. Limits results to DownloadItem that started after the given ms since the epoch.  */
            startedAfter?: number;
            /** Optional. The file's MIME type.  */
            mime?: string;
            /** Optional. Number of bytes in the whole file post-decompression, or -1 if unknown.  */
            fileSize?: number;
            /** Optional. The time when the download began in ISO 8601 format.  */
            startTime?: number;
            /** Optional. Absolute URL.  */
            url?: string;
            /** Optional. Limits results to DownloadItem that started before the given ms since the epoch.  */
            startedBefore?: number;
            /** Optional. The maximum number of matching DownloadItem returned. Defaults to 1000. Set to 0 in order to return all matching DownloadItem. See search for how to page through results.  */
            limit?: number;
            /** Optional. Why a download was interrupted.  */
            error?: number;
            /** Optional. The time when the download ended in ISO 8601 format.  */
            endTime?: number;
            /** Optional. Whether the downloaded file exists;  */
            exists?: boolean;
        }

        export interface DownloadFilenameSuggestion {
            /** The DownloadItem's new target DownloadItem.filename, as a path relative to the user's default Downloads directory, possibly containing subdirectories. Absolute paths, empty paths, and paths containing back-references ".." will be ignored. */
            filename: string;
            /** Optional. The action to take if filename already exists.  */
            conflictAction?: string;
        }

        export interface DownloadChangedEvent extends events.Event<(downloadDelta: DownloadDelta) => void> { }

        export interface DownloadCreatedEvent extends events.Event<(downloadItem: DownloadItem) => void> { }

        export interface DownloadErasedEvent extends events.Event<(downloadId: number) => void> { }

        export interface DownloadDeterminingFilenameEvent extends events.Event<(downloadItem: DownloadItem, suggest: (suggestion?: DownloadFilenameSuggestion) => void) => void> { }

        /**
         * Find DownloadItem. Set query to the empty object to get all DownloadItem. To get a specific DownloadItem, set only the id field. To page through a large number of items, set orderBy: ['-startTime'], set limit to the number of items per page, and set startedAfter to the startTime of the last item from the last page.
         */
        export function search(query: DownloadQuery): Promise<DownloadItem[]>;
        /**
         * Pause the download. If the request was successful the download is in a paused state. Otherwise runtime.lastError contains an error message. The request will fail if the download is not active.
         * @param downloadId The id of the download to pause.
         */
        export function pause(downloadId: number): Promise<void>;
        /**
         * Retrieve an icon for the specified download. For new downloads, file icons are available after the onCreated event has been received. The image returned by this export function while a download is in progress may be different from the image returned after the download is complete. Icon retrieval is done by querying the underlying operating system or toolkit depending on the platform. The icon that is returned will therefore depend on a number of factors including state of the download, platform, registered file types and visual theme. If a file icon cannot be determined, runtime.lastError will contain an error message.
         * @param downloadId The identifier for the download.
         */
        export function getFileIcon(downloadId: number): Promise<string>;
        /**
         * Retrieve an icon for the specified download. For new downloads, file icons are available after the onCreated event has been received. The image returned by this export function while a download is in progress may be different from the image returned after the download is complete. Icon retrieval is done by querying the underlying operating system or toolkit depending on the platform. The icon that is returned will therefore depend on a number of factors including state of the download, platform, registered file types and visual theme. If a file icon cannot be determined, runtime.lastError will contain an error message.
         * @param downloadId The identifier for the download.
         */
        export function getFileIcon(downloadId: number, options: GetFileIconOptions): Promise<string>;
        /**
         * Resume a paused download. If the request was successful the download is in progress and unpaused. Otherwise runtime.lastError contains an error message. The request will fail if the download is not active.
         * @param downloadId The id of the download to resume.
         */
        export function resume(downloadId: number): Promise<void>;
        /**
         * Cancel a download. When callback is run, the download is cancelled, completed, interrupted or doesn't exist anymore.
         * @param downloadId The id of the download to cancel.
         */
        export function cancel(downloadId: number): Promise<void>;
        /**
         * Download a URL. If the URL uses the HTTP[S] protocol, then the request will include all cookies currently set for its hostname. If both filename and saveAs are specified, then the Save As dialog will be displayed, pre-populated with the specified filename. If the download started successfully, callback will be called with the new DownloadItem's downloadId. If there was an error starting the download, then callback will be called with downloadId=undefined and runtime.lastError will contain a descriptive string. The error strings are not guaranteed to remain backwards compatible between releases. Extensions must not parse it.
         * @param options What to download and how.
         */
        export function download(options: DownloadOptions): Promise<number>;
        /**
         * Open the downloaded file now if the DownloadItem is complete; otherwise returns an error through runtime.lastError. Requires the "downloads.open" permission in addition to the "downloads" permission. An onChanged event will fire when the item is opened for the first time.
         * @param downloadId The identifier for the downloaded file.
         */
        export function open(downloadId: number): void;
        /**
         * Show the downloaded file in its folder in a file manager.
         * @param downloadId The identifier for the downloaded file.
         */
        export function show(downloadId: number): void;
        /** Show the default Downloads folder in a file manager. */
        export function showDefaultFolder(): void;
        /**
         * Erase matching DownloadItem from history without deleting the downloaded file. An onErased event will fire for each DownloadItem that matches query, then callback will be called.
         */
        export function erase(query: DownloadQuery): Promise<number[]>;
        /**
         * Remove the downloaded file if it exists and the DownloadItem is complete; otherwise return an error through runtime.lastError.
         */
        export function removeFile(downloadId: number): Promise<void>;
        /**
         * Prompt the user to accept a dangerous download. Can only be called from a visible context (tab, window, or page/browser action popup). Does not automatically accept dangerous downloads. If the download is accepted, then an onChanged event will fire, otherwise nothing will happen. When all the data is fetched into a temporary file and either the download is not dangerous or the danger has been accepted, then the temporary file is renamed to the target filename, the |state| changes to 'complete', and onChanged fires.
         * @param downloadId The identifier for the DownloadItem.
         */
        export function acceptDanger(downloadId: number): Promise<void>;
        /** Initiate dragging the downloaded file to another application. Call in a javascript ondragstart handler. */
        export function drag(downloadId: number): void;
        /** Enable or disable the gray shelf at the bottom of every window associated with the current browser profile. The shelf will be disabled as long as at least one extension has disabled it. Enabling the shelf while at least one other extension has disabled it will return an error through runtime.lastError. Requires the "downloads.shelf" permission in addition to the "downloads" permission. */
        export function setShelfEnabled(enabled: boolean): void;

        /** When any of a DownloadItem's properties except bytesReceived and estimatedEndTime changes, this event fires with the downloadId and an object containing the properties that changed. */
        export var onChanged: DownloadChangedEvent;
        /** This event fires with the DownloadItem object when a download begins. */
        export var onCreated: DownloadCreatedEvent;
        /** Fires with the downloadId when a download is erased from history. */
        export var onErased: DownloadErasedEvent;
        /** During the filename determination process, extensions will be given the opportunity to override the target DownloadItem.filename. Each extension may not register more than one listener for this event. Each listener must call suggest exactly once, either synchronously or asynchronously. If the listener calls suggest asynchronously, then it must return true. If the listener neither calls suggest synchronously nor returns true, then suggest will be called automatically. The DownloadItem will not complete until all listeners have called suggest. Listeners may call suggest without any arguments in order to allow the download to use downloadItem.filename for its filename, or pass a suggestion object to suggest in order to override the target filename. If more than one extension overrides the filename, then the last extension installed whose listener passes a suggestion object to suggest wins. In order to avoid confusion regarding which extension will win, users should not install extensions that may conflict. If the download is initiated by download and the target filename is known before the MIME type and tentative filename have been determined, pass filename to download instead. */
        export var onDeterminingFilename: DownloadDeterminingFilenameEvent;
    }
}