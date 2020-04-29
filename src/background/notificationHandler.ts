import { singleton } from "tsyringe";
import { browser } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

import DelayedExecution from "../shared/delayedExecution";
import { Settings } from "../shared/settings";
import { MessageUtil } from "../shared/messageUtil";

const COOKIE_CLEANUP_NOTIFICATION_ID = "CookieCleanupNotification";
const UPDATE_NOTIFICATION_ID = "UpdateNotification";

const CLEAR_NOTIFICATION_TIME = 3000;
const DELAY_NOTIFICATION_UPDATE_ON_START = 100;
const DELAY_NOTIFICATION = 500;

@singleton()
export class NotificationHandler {
    private enabled: boolean;

    private readonly delayNotification = new DelayedExecution(() => {
        this.showNotification();
    });

    private readonly delayClearNotification = new DelayedExecution(this.clearNotification.bind(this));

    private removalCountsByDomain: { [s: string]: number } = {};

    private starting = false;

    private updateOnStart = false;

    public constructor(settings: Settings, messageUtil: MessageUtil) {
        browser.notifications.onClosed.addListener(this.onNotificationClosed);

        this.enabled = settings.get("showCookieRemovalNotification");
        messageUtil.receive("settingsChanged", () => {
            this.enabled = settings.get("showCookieRemovalNotification");
        });
        messageUtil.receive("cookieRemoved", this.onCookieRemoved);

        wetLayer.addListener(() => {
            this.showUpdateNotification();
        });

        browser.notifications.onClicked.addListener((id: string) => {
            this.onClick(id);
        });
    }

    private async onClick(id: string) {
        if (id === UPDATE_NOTIFICATION_ID) {
            await browser.tabs.create({
                active: true,
                url: `${browser.runtime.getURL("dist/readme.html")}#changelog`,
            });
        }
    }

    public async showUpdateNotification() {
        await browser.notifications.create(UPDATE_NOTIFICATION_ID, {
            type: "basic",
            iconUrl: browser.extension.getURL("icons/icon96.png"),
            title: wetLayer.getMessage("update_notification_title"),
            message: wetLayer.getMessage("update_notification_message"),
        });
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
