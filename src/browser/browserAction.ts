import { Events } from "./events";
import { Tabs } from "./tabs";

////////////////////
// Browser Action
////////////////////
/**
 * Use browser actions to put icons in the main Google Chrome toolbar, to the right of the address bar. In addition to its icon, a browser action can also have a tooltip, a badge, and a popup. * Manifest:  "browser_action": {...}
 */
export namespace BrowserAction {
    export interface BadgeBackgroundColorDetails {
        /** An array of four integers in the range [0,255] that make up the RGBA color of the badge. For example, opaque red is [255, 0, 0, 255]. Can also be a string with a CSS value, with opaque red being #FF0000 or #F00. */
        color: string | ColorArray;
        /** Optional. Limits the change to when a particular tab is selected. Automatically resets when the tab is closed.  */
        tabId?: number;
    }

    export interface BadgeTextDetails {
        /** Any number of characters can be passed, but only about four can fit in the space. */
        text: string;
        /** Optional. Limits the change to when a particular tab is selected. Automatically resets when the tab is closed.  */
        tabId?: number;
    }

    type ColorArray = [number, number, number, number];

    export interface TitleDetails {
        /** The string the browser action should display when moused over. */
        title: string;
        /** Optional. Limits the change to when a particular tab is selected. Automatically resets when the tab is closed.  */
        tabId?: number;
    }

    export interface TabDetails {
        /** Optional. Specify the tab to get the information. If no tab is specified, the non-tab-specific information is returned.  */
        tabId?: number;
    }

    export interface TabIconDetails {
        /** Optional. Either an ImageData object or a dictionary {size -> ImageData} representing icon to be set. If the icon is specified as a dictionary, the actual image to be used is chosen depending on screen's pixel density. If the number of image pixels that fit into one screen space unit equals scale, then image with size scale * 19 will be selected. Initially only scales 1 and 2 will be supported. At least one image must be specified. Note that 'details.imageData = foo' is equivalent to 'details.imageData = {'19': foo}'  */
        imageData?: ImageData | {[s:string]:ImageData};
        /** Optional. Either a relative image path or a dictionary {size -> relative image path} pointing to icon to be set. If the icon is specified as a dictionary, the actual image to be used is chosen depending on screen's pixel density. If the number of image pixels that fit into one screen space unit equals scale, then image with size scale * 19 will be selected. Initially only scales 1 and 2 will be supported. At least one image must be specified. Note that 'details.path = foo' is equivalent to 'details.imageData = {'19': foo}'  */
        path?: string | {[s:string]:string};
        /** Optional. Limits the change to when a particular tab is selected. Automatically resets when the tab is closed.  */
        tabId?: number;
    }

    export interface PopupDetails {
        /** Optional. Limits the change to when a particular tab is selected. Automatically resets when the tab is closed.  */
        tabId?: number;
        /** The html file to show in a popup. If set to the empty string (''), no popup is shown. */
        popup: string;
    }

    export interface BrowserClickedEvent extends Events.Event<(tab: Tabs.Tab) => void> { }

    export interface Static {
        /**
         * Disables the browser action for a tab.
         * @param tabId The id of the tab for which you want to modify the browser action.
         */
        disable(tabId?: number): void;
        /**
         * Enables the browser action for a tab. By default, browser actions are enabled.
         * @param tabId The id of the tab for which you want to modify the browser action.
         */
        enable(tabId?: number): void;
        /**
         * Gets the background color of the browser action.
         */
        getBadgeBackgroundColor(details: TabDetails): Promise<ColorArray>;
        /** Sets the background color for the badge. */
        setBadgeBackgroundColor(details: BadgeBackgroundColorDetails): void;
        /**
         * Gets the badge text of the browser action. If no tab is specified, the non-tab-specific badge text is returned.
         */
        getBadgeText(details: TabDetails): Promise<string>;
        /** Sets the badge text for the browser action. The badge is displayed on top of the icon. */
        setBadgeText(details: BadgeTextDetails): void;
        /**
         * Gets the html document set as the popup for this browser action.
         */
        getPopup(details: TabDetails): Promise<string>;
        /**
         * Gets the title of the browser action.
         */
        getTitle(details: TabDetails): Promise<string>;
        /** Sets the title of the browser action. This shows up in the tooltip. */
        setTitle(details: TitleDetails): void;
        /** Sets the html document to be opened as a popup when the user clicks on the browser action's icon. */
        setPopup(details: PopupDetails): void;
        /**
         * Sets the icon for the browser action. The icon can be specified either as the path to an image file or as the pixel data from a canvas element, or as dictionary of either one of those. Either the path or the imageData property must be specified.
         */
        setIcon(details: TabIconDetails): Promise<void>;

        /** Fired when a browser action icon is clicked. This event will not fire if the browser action has a popup. */
        onClicked: BrowserClickedEvent;
    }
}