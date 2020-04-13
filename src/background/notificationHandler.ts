/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

import { settings } from "../lib/settings";
import DelayedExecution from "../lib/delayedExecution";
import { messageUtil } from "../lib/messageUtil";

const COOKIE_CLEANUP_NOTIFICATION_ID = "CookieCleanupNotification";

const CLEAR_NOTIFICATION_TIME = 3000;
const DELAY_NOTIFICATION_UPDATE_ON_START = 100;
const DELAY_NOTIFICATION = 500;

export class NotificationHandler {
    private enabled: boolean;

    private readonly delayNotification = new DelayedExecution(() => {
        this.showNotification();
    });

    private readonly delayClearNotification = new DelayedExecution(this.clearNotification.bind(this));

    private removalCountsByDomain: { [s: string]: number } = {};

    private starting = false;

    private updateOnStart = false;

    public constructor() {
        browser.notifications.onClosed.addListener(this.onNotificationClosed);

        this.enabled = settings.get("showCookieRemovalNotification");
        messageUtil.receive("settingsChanged", () => {
            this.enabled = settings.get("showCookieRemovalNotification");
        });
        messageUtil.receive("cookieRemoved", this.onCookieRemoved);
    }

    private onNotificationClosed = () => {
        this.starting = false;
        this.removalCountsByDomain = {};
        this.delayClearNotification.cancel();
    };

    private clearNotification() {
        browser.notifications.clear(COOKIE_CLEANUP_NOTIFICATION_ID);
        this.starting = false;
        this.removalCountsByDomain = {};
    }

    private async showNotification() {
        if (this.starting) {
            this.updateOnStart = true;
            return;
        }
        const lines = [];
        let totalCount = 0;
        for (const domain of Object.keys(this.removalCountsByDomain)) {
            const count = this.removalCountsByDomain[domain];
            lines.push(wetLayer.getMessage("cookie_cleanup_notification_line", [domain, count.toString()]));
            totalCount += count;
        }
        this.starting = true;
        this.updateOnStart = false;
        this.delayClearNotification.restart(CLEAR_NOTIFICATION_TIME);

        await browser.notifications.create(COOKIE_CLEANUP_NOTIFICATION_ID, {
            type: "basic",
            iconUrl: browser.extension.getURL("icons/icon96.png"),
            title: wetLayer.getMessage("cookie_cleanup_notification_title", totalCount.toString()),
            message: lines.join("\n"),
        });

        this.starting = false;
        if (this.updateOnStart) this.delayNotification.restart(DELAY_NOTIFICATION_UPDATE_ON_START);
    }

    private onCookieRemoved = (domain: string) => {
        if (this.enabled) {
            this.removalCountsByDomain[domain] = (this.removalCountsByDomain[domain] || 0) + 1;
            this.delayNotification.restart(DELAY_NOTIFICATION);
        }
    };
}
