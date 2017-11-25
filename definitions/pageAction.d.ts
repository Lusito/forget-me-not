declare module 'webextension-polyfill' {
    ////////////////////
    // Page Action
    ////////////////////
    /**
     * Use the browser.pageAction API to put icons inside the address bar. Page actions represent actions that can be taken on the current page, but that aren't applicable to all pages.
     * Manifest:  "page_action": {...}
     */
    export namespace pageAction {
        export interface PageActionClickedEvent extends events.Event<(tab: tabs.Tab) => void> { }

        export interface TitleDetails {
            /** The id of the tab for which you want to modify the page action. */
            tabId: number;
            /** The tooltip string. */
            title: string;
        }

        export interface GetDetails {
            /** Specify the tab to get the title from. */
            tabId: number;
        }

        export interface PopupDetails {
            /** The id of the tab for which you want to modify the page action. */
            tabId: number;
            /** The html file to show in a popup. If set to the empty string (''), no popup is shown. */
            popup: string;
        }

        export interface IconDetails {
            /**
             * Optional.
             * Either an ImageData object or a dictionary {size -> ImageData} representing icon to be set. If the icon is specified as a dictionary, the actual image to be used is chosen depending on screen's pixel density. If the number of image pixels that fit into one screen space unit equals scale, then image with size scale * 19 will be selected. Initially only scales 1 and 2 will be supported. At least one image must be specified. Note that 'details.imageData = foo' is equivalent to 'details.imageData = {'19': foo}'
             */
            imageData?: ImageData | {[s:string]:ImageData};
            /**
             * Optional.
             * Either a relative image path or a dictionary {size -> relative image path} pointing to icon to be set. If the icon is specified as a dictionary, the actual image to be used is chosen depending on screen's pixel density. If the number of image pixels that fit into one screen space unit equals scale, then image with size scale * 19 will be selected. Initially only scales 1 and 2 will be supported. At least one image must be specified. Note that 'details.path = foo' is equivalent to 'details.imageData = {'19': foo}'
             */
            path?: string | {[s:string]:string};
            /** The id of the tab for which you want to modify the page action. */
            tabId: number;
        }

        /**
         * Gets the html document set as the popup for this page action.
         */
        export function getPopup(details: GetDetails): Promise<string>;
        /**
         * Gets the title of the page action.
         */
        export function getTitle(details: GetDetails): Promise<string>;
        /**
         * Shows the page action. The page action is shown whenever the tab is selected.
         * @param tabId The id of the tab for which you want to modify the page action.
         */
        export function hide(tabId: number): void;
        /** Open the page action's popup. */
        export function openPopup(): void;
        /**
         * Sets the icon for the page action. The icon can be specified either as the path to an image file or as the pixel data from a canvas element, or as dictionary of either one of those. Either the path or the imageData property must be specified.
         */
        export function setIcon(details: IconDetails): Promise<void>;
        /** Sets the html document to be opened as a popup when the user clicks on the page action's icon. */
        export function setPopup(details: PopupDetails): void;
        /** Sets the title of the page action. This is displayed in a tooltip over the page action. */
        export function setTitle(details: TitleDetails): void;
        /**
         * Shows the page action. The page action is shown whenever the tab is selected.
         * @param tabId The id of the tab for which you want to modify the page action.
         */
        export function show(tabId: number): Promise<undefined>;

        /** Fired when a page action icon is clicked. This event will not fire if the page action has a popup. */
        export var onClicked: PageActionClickedEvent;
    }
}