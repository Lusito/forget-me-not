declare module 'webextension-polyfill' {
    ////////////////////
    // Dev Tools - Network
    ////////////////////
    /**
     * Use the browser.devtools.network API to retrieve the information about network requests displayed by the Developer Tools in the Network panel. */
    export namespace devtools.network {
        export interface NavigatedEvent extends events.Event<(url: string) => void> { }
        /** Fired when the inspected window navigates to a new page. */
        export var onNavigated: NavigatedEvent;
    }
}