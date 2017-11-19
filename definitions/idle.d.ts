declare module 'webextension-polyfill' {
    ////////////////////
    // Idle
    ////////////////////
    /**
     * Use the browser.idle API to detect when the machine's idle state changes.
     * Permissions:  "idle"
     */
    export namespace idle {
        export type IdleState = "active" | "idle" | "locked";
        export interface IdleStateChangedEvent extends events.Event<(newState: IdleState) => void> { }

        /**
         * Returns "locked" if the system is locked, "idle" if the user has not generated any input for a specified number of seconds, or "active" otherwise.
         * @param detectionIntervalInSeconds The system is considered idle if detectionIntervalInSeconds seconds have elapsed since the last user input detected.
         * Since Chrome 25.
         */
        export function queryState(detectionIntervalInSeconds: number): Promise<IdleState>;
        /**
         * Sets the interval, in seconds, used to determine when the system is in an idle state for onStateChanged events. The default interval is 60 seconds.
         * @param intervalInSeconds Threshold, in seconds, used to determine when the system is in an idle state.
         */
        export function setDetectionInterval(intervalInSeconds: number): void;

        /** Fired when the system changes to an active, idle or locked state. The event fires with "locked" if the screen is locked or the screensaver activates, "idle" if the system is unlocked and the user has not generated any input for a specified number of seconds, and "active" when the user generates input on an idle system. */
        export var onStateChanged: IdleStateChangedEvent;
    }
}