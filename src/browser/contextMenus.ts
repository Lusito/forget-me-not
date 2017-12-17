import { Events } from "./events";
import { Tabs } from "./tabs";

// todo: check mdn compatibility
////////////////////
// Context Menus
////////////////////
/**
 * Use the browser.contextMenus API to add items to Google Chrome's context menu. You can choose what types of objects your context menu additions apply to, such as images, hyperlinks, and pages. * Permissions:  "contextMenus"
 */
export namespace ContextMenus {
    export interface OnClickData {
        /**
         * Optional.
        * The text for the context selection, if any.
        */
        selectionText?: string;
        /**
         * Optional.
        * A flag indicating the state of a checkbox or radio item after it is clicked.
        */
        checked?: boolean;
        /**
         * The ID of the menu item that was clicked.
         */
        menuItemId: any;
        /**
         * Optional.
        * The URL of the frame of the element where the context menu was clicked, if it was in a frame.
        */
        frameUrl?: string;
        /**
         * A flag indicating whether the element is editable (text input, textarea, etc.).
         */
        editable: boolean;
        /**
         * Optional.
        * One of 'image', 'video', or 'audio' if the context menu was activated on one of these types of elements.
        */
        mediaType?: string;
        /**
         * Optional.
        * A flag indicating the state of a checkbox or radio item before it was clicked.
        */
        wasChecked?: boolean;
        /**
         * The URL of the page where the menu item was clicked. This property is not set if the click occured in a context where there is no current page, such as in a launcher context menu.
         */
        pageUrl: string;
        /**
         * Optional.
        * If the element is a link, the URL it points to.
        */
        linkUrl?: string;
        /**
         * Optional.
        * The parent ID, if any, for the item clicked.
        */
        parentMenuItemId?: any;
        /**
         * Optional.
        * Will be present for elements with a 'src' URL.
        */
        srcUrl?: string;
    }

    export interface CreateProperties {
        /** Optional. Lets you restrict the item to apply only to documents whose URL matches one of the given patterns. (This applies to frames as well.) For details on the format of a pattern, see Match Patterns.  */
        documentUrlPatterns?: string[];
        /** Optional. The initial state of a checkbox or radio item: true for selected and false for unselected. Only one radio item can be selected at a time in a given group of radio items.  */
        checked?: boolean;
        /** Optional. The text to be displayed in the item; this is required unless type is 'separator'. When the context is 'selection', you can use %s within the string to show the selected text. For example, if this parameter's value is "Translate '%s' to Pig Latin" and the user selects the word "cool", the context menu item for the selection is "Translate 'cool' to Pig Latin".  */
        title?: string;
        /** Optional. List of contexts this menu item will appear in. Defaults to ['page'] if not specified.  */
        contexts?: string[];
        /**
         * Optional.
        * Whether this context menu item is enabled or disabled. Defaults to true.
        */
        enabled?: boolean;
        /** Optional. Similar to documentUrlPatterns, but lets you filter based on the src attribute of img/audio/video tags and the href of anchor tags.  */
        targetUrlPatterns?: string[];
        /**
         * Optional.
         * A export function that will be called back when the menu item is clicked. Event pages cannot use this; instead, they should register a listener for browser.contextMenus.onClicked.
        * @param info Information sent when a context menu item is clicked.
        * @param tab The details of the tab where the click took place. Note: this parameter only present for extensions.
        */
        onclick?: (info: OnClickData, tab: Tabs.Tab) => void;
        /** Optional. The ID of a parent menu item; this makes the item a child of a previously added item.  */
        parentId?: any;
        /** Optional. The type of menu item. Defaults to 'normal' if not specified.  */
        type?: string;
        /**
         * Optional.
        * The unique ID to assign to this item. Mandatory for event pages. Cannot be the same as another ID for this extension.
        */
        id?: string;
    }

    export interface UpdateProperties {
        documentUrlPatterns?: string[];
        checked?: boolean;
        title?: string;
        contexts?: string[];
        /** Optional. */
        enabled?: boolean;
        targetUrlPatterns?: string[];
        onclick?: Function;
        /** Optional. Note: You cannot change an item to be a child of one of its own descendants.  */
        parentId?: any;
        type?: string;
    }

    export interface MenuClickedEvent extends Events.Event<(info: OnClickData, tab?: Tabs.Tab) => void> { }

    export interface Static {
        /**
         * The maximum number of top level extension items that can be added to an extension action context menu. Any items beyond this limit will be ignored.
         */
        ACTION_MENU_TOP_LEVEL_LIMIT: number;

        /**
         * Removes all context menu items added by this extension.
         */
        removeAll(): Promise<void>;
        /**
         * Creates a new context menu item. Note that if an error occurs during creation, you may not find out until the creation callback fires (the details will be in browser.runtime.lastError).
         */
        create(createProperties: CreateProperties): Promise<void>;
        /**
         * Updates a previously created context menu item.
         * @param id The ID of the item to update.
         * @param updateProperties The properties to update. Accepts the same values as the create export function.
         */
        update(id: string, updateProperties: UpdateProperties): Promise<void>;
        /**
         * Updates a previously created context menu item.
         * @param id The ID of the item to update.
         * @param updateProperties The properties to update. Accepts the same values as the create export function.
         */
        update(id: number, updateProperties: UpdateProperties): Promise<void>;
        /**
         * Removes a context menu item.
         * @param menuItemId The ID of the context menu item to remove.
         */
        remove(menuItemId: string): Promise<void>;
        /**
         * Removes a context menu item.
         * @param menuItemId The ID of the context menu item to remove.
         */
        remove(menuItemId: number): Promise<void>;

        /**
         * Fired when a context menu item is clicked.
         */
        onClicked: MenuClickedEvent;
    }
}