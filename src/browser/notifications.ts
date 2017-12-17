import { Events } from "./events";

// todo: check mdn compatibility
////////////////////
// Notifications
// https://developer.browser.com/extensions/notifications
////////////////////
/**
 * Use the browser.notifications API to create rich notifications using templates and show these notifications to users in the system tray.
 * Permissions:  "notifications"
 */
export namespace Notifications {
    export interface ButtonOptions {
        title: string;
        iconUrl?: string;
    }

    export interface ItemOptions {
        /** Title of one item of a list notification. */
        title: string;
        /** Additional details about this item. */
        message: string;
    }

    export interface NotificationOptions {
        /** Optional. Which type of notification to display. Required for notifications.create method. */
        type?: string;
        /**
         * Optional.
         * A URL to the sender's avatar, app icon, or a thumbnail for image notifications.
         * URLs can be a data URL, a blob URL, or a URL relative to a resource within this extension's .crx file Required for notifications.create method.
         */
        iconUrl?: string;
        /** Optional. Title of the notification (e.g. sender name for email). Required for notifications.create method. */
        title?: string;
        /** Optional. Main notification content. Required for notifications.create method. */
        message?: string;
        /**
         * Optional.
         * Alternate notification content with a lower-weight font.
         */
        contextMessage?: string;
        /** Optional. Priority ranges from -2 to 2. -2 is lowest priority. 2 is highest. Zero is default. */
        priority?: number;
        /** Optional. A timestamp associated with the notification, in milliseconds past the epoch (e.g. Date.now() + n). */
        eventTime?: number;
        /** Optional. Text and icons for up to two notification action buttons. */
        buttons?: ButtonOptions[];
        /** Optional. Items for multi-item notifications. */
        items?: ItemOptions[];
        /**
         * Optional.
         * Current progress ranges from 0 to 100.
         */
        progress?: number;
        /**
         * Optional.
         * Whether to show UI indicating that the app will visibly respond to clicks on the body of a notification.
         */
        isClickable?: boolean;
        /**
         * Optional.
         * A URL to the app icon mask. URLs have the same restrictions as iconUrl. The app icon mask should be in alpha channel, as only the alpha channel of the image will be considered.
         */
        appIconMaskUrl?: string;
        /** Optional. A URL to the image thumbnail for image-type notifications. URLs have the same restrictions as iconUrl. */
        imageUrl?: string;
        /**
         * Indicates that the notification should remain visible on screen until the user activates or dismisses the notification.
         * This defaults to false.
         */
        requireInteraction?: boolean;
    }

    export interface NotificationClosedEvent extends Events.Event<(notificationId: string, byUser: boolean) => void> { }

    export interface NotificationClickedEvent extends Events.Event<(notificationId: string) => void> { }

    export interface NotificationButtonClickedEvent extends Events.Event<(notificationId: string, buttonIndex: number) => void> { }

    export interface NotificationPermissionLevelChangedEvent extends Events.Event<(level: string) => void> { }

    export interface NotificationShowSettingsEvent extends Events.Event<() => void> { }

    export interface Static {
        /** The notification closed, either by the system or by user action. */
        onClosed: NotificationClosedEvent;
        /** The user clicked in a non-button area of the notification. */
        onClicked: NotificationClickedEvent;
        /** The user pressed a button in the notification. */
        onButtonClicked: NotificationButtonClickedEvent;
        /**
         * The user changes the permission level.
         */
        onPermissionLevelChanged: NotificationPermissionLevelChangedEvent;
        /**
         * The user clicked on a link for the app's notification settings.
         */
        onShowSettings: NotificationShowSettingsEvent;

        /**
         * Creates and displays a notification.
         * @param notificationId Identifier of the notification. If not set or empty, an ID will automatically be generated. If it matches an existing notification, this method first clears that notification before proceeding with the create operation.
         * The notificationId parameter is required before Chrome 42.
         * @param options Contents of the notification.
         */
        create(notificationId: string, options: NotificationOptions): Promise<string>;
        /**
         * Creates and displays a notification.
         * @param notificationId Identifier of the notification. If not set or empty, an ID will automatically be generated. If it matches an existing notification, this method first clears that notification before proceeding with the create operation.
         * The notificationId parameter is required before Chrome 42.
         * @param options Contents of the notification.
         */
        create(options: NotificationOptions): Promise<string>;
        /**
         * Updates an existing notification.
         * @param notificationId The id of the notification to be updated. This is returned by notifications.create method.
         * @param options Contents of the notification to update to.
         */
        update(notificationId: string, options: NotificationOptions): Promise<boolean>;
        /**
         * Clears the specified notification.
         * @param notificationId The id of the notification to be cleared. This is returned by notifications.create method.
         */
        clear(notificationId: string): Promise<boolean>;
        /**
         * Retrieves all the notifications.
         */
        getAll(): Promise<Object>;
        /**
         * Retrieves whether the user has enabled notifications from this app or extension.
         */
        getPermissionLevel(): Promise<string>;
    }
}