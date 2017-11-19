declare module 'webextension-polyfill' {
    ////////////////////
    // Omnibox
    ////////////////////
    /**
     * The omnibox API allows you to register a keyword with Google Chrome's address bar, which is also known as the omnibox.
     * Manifest:  "omnibox": {...}
     */
    export namespace omnibox {
        export type OnInputEnteredDisposition = "currentTab" | "newForegroundTab" | "newBackgroundTab";

        /** A suggest result. */
        export interface SuggestResult {
            /** The text that is put into the URL bar, and that is sent to the extension when the user chooses this entry. */
            content: string;
            /** The text that is displayed in the URL dropdown. Can contain XML-style markup for styling. The supported tags are 'url' (for a literal URL), 'match' (for highlighting text that matched what the user's query), and 'dim' (for dim helper text). The styles can be nested, eg. dimmed match. You must escape the five predefined entities to display them as text: stackoverflow.com/a/1091953/89484 */
            description: string;
        }

        export interface Suggestion {
            /** The text that is displayed in the URL dropdown. Can contain XML-style markup for styling. The supported tags are 'url' (for a literal URL), 'match' (for highlighting text that matched what the user's query), and 'dim' (for dim helper text). The styles can be nested, eg. dimmed match. */
            description: string;
        }

        export interface OmniboxInputEnteredEvent extends events.Event<(text: string, disposition: OnInputEnteredDisposition) => void> { }

        export interface OmniboxInputChangedEvent extends events.Event<(text: string, suggest: (suggestResults: SuggestResult[]) => void) => void> { }

        export interface OmniboxInputStartedEvent extends events.Event<() => void> { }

        export interface OmniboxInputCancelledEvent extends events.Event<() => void> { }

        /**
         * Sets the description and styling for the default suggestion. The default suggestion is the text that is displayed in the first suggestion row underneath the URL bar.
         * @param suggestion A partial SuggestResult object, without the 'content' parameter.
         */
        export function setDefaultSuggestion(suggestion: Suggestion): void;

        /** User has accepted what is typed into the omnibox. */
        export var onInputEntered: OmniboxInputEnteredEvent;
        /** User has changed what is typed into the omnibox. */
        export var onInputChanged: OmniboxInputChangedEvent;
        /** User has started a keyword input session by typing the extension's keyword. This is guaranteed to be sent exactly once per input session, and before any onInputChanged events. */
        export var onInputStarted: OmniboxInputStartedEvent;
        /** User has ended the keyword input session without accepting the input. */
        export var onInputCancelled: OmniboxInputCancelledEvent;
    }
}