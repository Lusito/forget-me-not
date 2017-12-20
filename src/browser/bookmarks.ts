import { Events } from "./events";

// todo: check mdn compatibility
////////////////////
// Bookmarks
////////////////////
/**
 * Use the browser.bookmarks API to create, organize, and otherwise manipulate bookmarks. Also see Override Pages, which you can use to create a custom Bookmark Manager page.
 * Permissions:  "bookmarks"
 */
export namespace Bookmarks {
    /** A node (either a bookmark or a folder) in the bookmark tree. Child nodes are ordered within their parent folder. */
    export interface BookmarkTreeNode {
        /** Optional. The 0-based position of this node within its parent folder.  */
        index?: number;
        /** Optional. When this node was created, in milliseconds since the epoch (new Date(dateAdded)).  */
        dateAdded?: number;
        /** The text displayed for the node. */
        title: string;
        /** Optional. The URL navigated to when a user clicks the bookmark. Omitted for folders.   */
        url?: string;
        /** Optional. When the contents of this folder last changed, in milliseconds since the epoch.   */
        dateGroupModified?: number;
        /** The unique identifier for the node. IDs are unique within the current profile, and they remain valid even after the browser is restarted.  */
        id: string;
        /** Optional. The id of the parent folder. Omitted for the root node.   */
        parentId?: string;
        /** Optional. An ordered list of children of this node.  */
        children?: BookmarkTreeNode[];
        /**
         * Optional.
        * Indicates the reason why this node is unmodifiable. The managed value indicates that this node was configured by the system administrator or by the custodian of a supervised user. Omitted if the node can be modified by the user and the extension (default).
        */
        unmodifiable?: any;
    }

    export interface BookmarkRemoveInfo {
        index: number;
        parentId: string;
    }

    export interface BookmarkMoveInfo {
        index: number;
        oldIndex: number;
        parentId: string;
        oldParentId: string;
    }

    export interface BookmarkChangeInfo {
        url?: string;
        title: string;
    }

    export interface BookmarkReorderInfo {
        childIds: string[];
    }

    export interface BookmarkRemovedEvent extends Events.Event<(id: string, removeInfo: BookmarkRemoveInfo) => void> { }

    export interface BookmarkImportEndedEvent extends Events.Event<() => void> { }

    export interface BookmarkMovedEvent extends Events.Event<(id: string, moveInfo: BookmarkMoveInfo) => void> { }

    export interface BookmarkImportBeganEvent extends Events.Event<() => void> { }

    export interface BookmarkChangedEvent extends Events.Event<(id: string, changeInfo: BookmarkChangeInfo) => void> { }

    export interface BookmarkCreatedEvent extends Events.Event<(id: string, bookmark: BookmarkTreeNode) => void> { }

    export interface BookmarkChildrenReordered extends Events.Event<(id: string, reorderInfo: BookmarkReorderInfo) => void> { }

    export interface BookmarkSearchQuery {
        query?: string;
        url?: string;
        title?: string;
    }

    export interface BookmarkCreateArg {
        /** Optional. Defaults to the Other Bookmarks folder.  */
        parentId?: string;
        index?: number;
        title?: string;
        url?: string;
    }

    export interface BookmarkDestinationArg {
        parentId?: string;
        index?: number;
    }

    export interface BookmarkChangesArg {
        title?: string;
        url?: string;
    }

    export interface Static {
        /**
         * Searches for BookmarkTreeNodes matching the given query. Queries specified with an object produce BookmarkTreeNodes matching all specified properties.
         * @param query A string of words and quoted phrases that are matched against bookmark URLs and titles.
         */
        search(query: string): Promise<BookmarkTreeNode[]>;
        /**
         * Searches for BookmarkTreeNodes matching the given query. Queries specified with an object produce BookmarkTreeNodes matching all specified properties.
         * @param query An object with one or more of the properties query, url, and title specified. Bookmarks matching all specified properties will be produced.
         */
        search(query: BookmarkSearchQuery): Promise<BookmarkTreeNode[]>;
        /**
         * Retrieves the entire Bookmarks hierarchy.
         */
        getTree(): Promise<BookmarkTreeNode[]>;
        /**
         * Retrieves the recently added bookmarks.
         * @param numberOfItems The maximum number of items to return.
         */
        getRecent(numberOfItems: number): Promise<BookmarkTreeNode[]>;
        /**
         * Retrieves the specified BookmarkTreeNode.
         * @param id A single string-valued id
         */
        get(id: string): Promise<BookmarkTreeNode[]>;
        /**
         * Retrieves the specified BookmarkTreeNode.
         * @param idList An array of string-valued ids
         */
        get(idList: string[]): Promise<BookmarkTreeNode[]>;
        /**
         * Creates a bookmark or folder under the specified parentId. If url is NULL or missing, it will be a folder.
         */
        create(bookmark: BookmarkCreateArg): Promise<BookmarkTreeNode>;
        /**
         * Moves the specified BookmarkTreeNode to the provided location.
         */
        move(id: string, destination: BookmarkDestinationArg): Promise<BookmarkTreeNode>;
        /**
         * Updates the properties of a bookmark or folder. Specify only the properties that you want to change; unspecified properties will be left unchanged. Note: Currently, only 'title' and 'url' are supported.
         */
        update(id: string, changes: BookmarkChangesArg): Promise<BookmarkTreeNode>;
        /**
         * Removes a bookmark or an empty bookmark folder.
         */
        remove(id: string): Promise<void>;
        /**
         * Retrieves the children of the specified BookmarkTreeNode id.
         */
        getChildren(id: string): Promise<BookmarkTreeNode[]>;
        /**
         * Retrieves part of the Bookmarks hierarchy, starting at the specified node.
         * @param id The ID of the root of the subtree to retrieve.
         */
        getSubTree(id: string): Promise<BookmarkTreeNode[]>;
        /**
         * Recursively removes a bookmark folder.
         */
        removeTree(id: string): Promise<void>;

        /** Fired when a bookmark or folder is removed. When a folder is removed recursively, a single notification is fired for the folder, and none for its contents. */
        onRemoved: BookmarkRemovedEvent;
        /** Fired when a bookmark import session is ended. */
        onImportEnded: BookmarkImportEndedEvent;
        /** Fired when a bookmark import session is begun. Expensive observers should ignore onCreated updates until onImportEnded is fired. Observers should still handle other notifications immediately. */
        onImportBegan: BookmarkImportBeganEvent;
        /** Fired when a bookmark or folder changes. Note: Currently, only title and url changes trigger this. */
        onChanged: BookmarkChangedEvent;
        /** Fired when a bookmark or folder is moved to a different parent folder. */
        onMoved: BookmarkMovedEvent;
        /** Fired when a bookmark or folder is created. */
        onCreated: BookmarkCreatedEvent;
        /** Fired when the children of a folder have changed their order due to the order being sorted in the UI. This is not called as a result of a move(). */
        onChildrenReordered: BookmarkChildrenReordered;
    }
}