/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { Cookies, browser } from "webextension-polyfill-ts";
import { isFirefox, browserInfo, isNodeTest } from "../lib/browserInfo";
import { settings } from "../lib/settings";
import DelayedExecution from "../lib/delayedExecution";
import { messageUtil, ReceiverHandle } from "../lib/messageUtil";
import { destroyAndNull } from "../shared";

const supportsFirstPartyIsolation = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 59;

const COOKIE_CLEANUP_NOTIFICATION_ID = "CookieCleanupNotification";

const CLEAR_NOTIFICATION_TIME = 3000;
const DELAY_NOTIFICATION_UPDATE_ON_START = 100;
const DELAY_NOTIFICATION = 500;

export class CookieRemover {
    private shouldShowNotification: boolean;
    private settingsReceiver: ReceiverHandle | null;
    private readonly delayNotification = new DelayedExecution(this.showNotification.bind(this));
    private readonly delayClearNotification = new DelayedExecution(this.clearNotification.bind(this));
    private removalCountsByDomain: { [s: string]: number } = {};
    private startingNotification = false;
    private updateNotificationOnStart = false;

    public constructor() {
        this.onNotificationClosed = this.onNotificationClosed.bind(this);
        browser.notifications.onClosed.addListener(this.onNotificationClosed);

        this.shouldShowNotification = settings.get("showCookieRemovalNotification");
        this.settingsReceiver = messageUtil.receive("settingsChanged", () => {
            this.shouldShowNotification = settings.get("showCookieRemovalNotification");
        });
    }

    public destroy() {
        this.settingsReceiver = destroyAndNull(this.settingsReceiver);
        browser.notifications.onClosed.removeListener(this.onNotificationClosed);
    }

    private onNotificationClosed(id: string) {
        this.startingNotification = false;
        this.removalCountsByDomain = {};
        this.delayClearNotification.cancel();
    }

    private clearNotification() {
        browser.notifications.clear(COOKIE_CLEANUP_NOTIFICATION_ID);
        this.startingNotification = false;
        this.removalCountsByDomain = {};
    }

    private showNotification() {
        if (this.startingNotification) {
            this.updateNotificationOnStart = true;
            return;
        }
        const lines = [];
        let totalCount = 0;
        for (const domain in this.removalCountsByDomain) {
            const count = this.removalCountsByDomain[domain];
            lines.push(browser.i18n.getMessage("cookie_cleanup_notification_line", [domain, count]));
            totalCount += count;
        }
        this.startingNotification = true;
        this.updateNotificationOnStart = false;
        browser.notifications.create(COOKIE_CLEANUP_NOTIFICATION_ID, {
            priority: -2,
            type: "basic",
            iconUrl: browser.extension.getURL("icons/icon96.png"),
            title: browser.i18n.getMessage("cookie_cleanup_notification_title", totalCount),
            message: lines.join("\n")
        }).then((s) => {
            this.startingNotification = false;
            if (this.updateNotificationOnStart)
                this.delayNotification.restart(DELAY_NOTIFICATION_UPDATE_ON_START);
        });
        this.delayClearNotification.restart(CLEAR_NOTIFICATION_TIME);
    }

    public remove(cookie: Cookies.Cookie) {
        const allowSubDomains = cookie.domain.startsWith(".");
        const rawDomain = allowSubDomains ? cookie.domain.substr(1) : cookie.domain;
        const details: Cookies.RemoveDetailsType = {
            name: cookie.name,
            url: (cookie.secure ? "https://" : "http://") + rawDomain + cookie.path,
            storeId: cookie.storeId
        };
        if (supportsFirstPartyIsolation)
            details.firstPartyDomain = cookie.firstPartyDomain;

        browser.cookies.remove(details);
        if (this.shouldShowNotification) {
            this.removalCountsByDomain[rawDomain] = (this.removalCountsByDomain[rawDomain] || 0) + 1;
            this.delayNotification.restart(DELAY_NOTIFICATION);
        }
    }
}
