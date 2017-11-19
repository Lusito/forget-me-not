declare module 'webextension-polyfill' {
    ////////////////////
    // Commands
    ////////////////////
    /**
     * Use the commands API to add keyboard shortcuts that trigger actions in your extension, for example, an action to open the browser action or send a command to the extension. * Manifest:  "commands": {...}
     */
    export namespace commands {
        export interface Command {
            /** Optional. The name of the Extension Command  */
            name?: string;
            /** Optional. The Extension Command description  */
            description?: string;
            /** Optional. The shortcut active for this command, or blank if not active.  */
            shortcut?: string;
        }

        export interface CommandEvent extends events.Event<(command: string) => void> { }

        /**
         * Returns all the registered extension commands for this extension and their shortcut (if active).
         */
        export function getAll(): Promise<Command[]>;

        /** Fired when a registered command is activated using a keyboard shortcut. */
        export var onCommand: CommandEvent;
    }
}