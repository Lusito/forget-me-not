/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser } from "webextension-polyfill-ts";
import { settings } from "../lib/settings";
import DelayedExecution from "../lib/delayedExecution";
import { messageUtil, ReceiverHandle } from "../lib/messageUtil";
import { destroyAllAndEmpty } from "../shared";

const COOKIE_CLEANUP_NOTIFICATION_ID = "CookieCleanupNotification";

const CLEAR_NOTIFICATION_TIME = 3000;
const DELAY_NOTIFICATION_UPDATE_ON_START = 100;
const DELAY_NOTIFICATION = 500;

export class NotificationHandler {
    private enabled: boolean;
    private receivers: ReceiverHandle[] = [];
    private readonly delayNotification = new DelayedExecution(this.showNotification.bind(this));
    private readonly delayClearNotification = new DelayedExecution(this.clearNotification.bind(this));
    private removalCountsByDomain: { [s: string]: number } = {};
    private starting = false;
    private updateOnStart = false;

    public constructor() {
        this.onNotificationClosed = this.onNotificationClosed.bind(this);
        browser.notifications.onClosed.addListener(this.onNotificationClosed);

        this.enabled = settings.get("showCookieRemovalNotification");
        this.receivers = [
            messageUtil.receive("settingsChanged", () => {
                this.enabled = settings.get("showCookieRemovalNotification");
            }),
            messageUtil.receive("cookieRemoved", this.onCookieRemoved.bind(this))
        ];
    }

    public destroy() {
        destroyAllAndEmpty(this.receivers);
        browser.notifications.onClosed.removeListener(this.onNotificationClosed);
    }

    private onNotificationClosed(id: string) {
        this.starting = false;
        this.removalCountsByDomain = {};
        this.delayClearNotification.cancel();
    }

    private clearNotification() {
        browser.notifications.clear(COOKIE_CLEANUP_NOTIFICATION_ID);
        this.starting = false;
        this.removalCountsByDomain = {};
    }

    private showNotification() {
        if (this.starting) {
            this.updateOnStart = true;
            return;
        }
        const lines = [];
        let totalCount = 0;
        for (const domain in this.removalCountsByDomain) {
            const count = this.removalCountsByDomain[domain];
            lines.push(browser.i18n.getMessage("cookie_cleanup_notification_line", [domain, count]));
            totalCount += count;
        }
        this.starting = true;
        this.updateOnStart = false;
        browser.notifications.create(COOKIE_CLEANUP_NOTIFICATION_ID, {
            priority: -2,
            type: "basic",
            iconUrl: browser.extension.getURL("icons/icon96.png"),
            title: browser.i18n.getMessage("cookie_cleanup_notification_title", totalCount),
            message: lines.join("\n")
        }).then((s) => {
            this.starting = false;
            if (this.updateOnStart)
                this.delayNotification.restart(DELAY_NOTIFICATION_UPDATE_ON_START);
        });
        this.delayClearNotification.restart(CLEAR_NOTIFICATION_TIME);
    }

    private onCookieRemoved(domain: string) {
        if (this.enabled) {
            this.removalCountsByDomain[domain] = (this.removalCountsByDomain[domain] || 0) + 1;
            this.delayNotification.restart(DELAY_NOTIFICATION);
        }
    }
}
