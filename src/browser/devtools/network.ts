import { Events } from "../events";

////////////////////
// Dev Tools - Network
////////////////////
/**
 * Use the browser.devtools.network API to retrieve the information about network requests displayed by the Developer Tools in the Network panel. */
export namespace DevtoolsNetwork {
    export interface NavigatedEvent extends Events.Event<(url: string) => void> { }
    export interface Static {
        /** Fired when the inspected window navigates to a new page. */
        onNavigated: NavigatedEvent;
    }
}