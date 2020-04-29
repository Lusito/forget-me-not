import { singleton } from "tsyringe";
import { browser } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

import { getBadgeForCleanupType, badges } from "../shared/badges";
import { Settings } from "../shared/settings";
import { DomainUtils } from "../shared/domainUtils";
import { SnoozeManager } from "./snoozeManager";
import { MessageUtil } from "../shared/messageUtil";
import { someItemsMatch } from "./backgroundShared";

// fixme: make this file unit-testable and add tests

const BADGE_SETTINGS_KEYS = ["rules", "fallbackRule", "whitelistNoTLD", "whitelistFileSystem", "showBadge"];

@singleton()
export class BadgeManager {
    public constructor(
        private readonly settings: Settings,
        private readonly domainUtils: DomainUtils,
        snoozeManager: SnoozeManager,
        messageUtil: MessageUtil
    ) {
        this.updateBadge();
        wetLayer.addListener(() => {
            this.updateBadge();
            this.updateBrowserAction(snoozeManager.isSnoozing());
        });
        snoozeManager.listeners.add((snoozing) => {
            this.updateBrowserAction(snoozing);
        });

        // listen for tab changes to update badge
        const badgeUpdater = () => {
            this.updateBadge();
        };
        browser.tabs.onActivated.addListener(badgeUpdater);
        browser.tabs.onUpdated.addListener(badgeUpdater);
        messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, BADGE_SETTINGS_KEYS)) this.updateBadge();
        });
    }

    private async updateBadge() {
        const tabs = await browser.tabs.query({ active: true });
        await Promise.all(
            tabs.map(async (tab) => {
                if (tab?.url && !tab.incognito) {
                    let badge = badges.none;
                    const hostname = this.domainUtils.getValidHostname(tab.url);
                    if (hostname) badge = getBadgeForCleanupType(this.settings.getCleanupTypeForDomain(hostname));
                    let text = badge.i18nBadge ? wetLayer.getMessage(badge.i18nBadge) : "";
                    if (!this.settings.get("showBadge")) text = "";
                    if (browser.browserAction.setBadgeText)
                        await browser.browserAction.setBadgeText({ text, tabId: tab.id });
                    if (browser.browserAction.setBadgeBackgroundColor)
                        await browser.browserAction.setBadgeBackgroundColor({ color: badge.color, tabId: tab.id });
                    await browser.browserAction.enable(tab.id);
                } else {
                    await browser.browserAction.disable(tab.id);
                }
            })
        );
    }

    private async updateBrowserAction(snoozing: boolean) {
        const path: { [s: string]: string } = {};
        const suffix = snoozing ? "z" : "";
        for (const size of [16, 32, 48, 64, 96, 128]) path[size] = `icons/icon${size}${suffix}.png`;

        if (browser.browserAction.setIcon) await browser.browserAction.setIcon({ path });

        await browser.browserAction.setTitle({
            title: wetLayer.getMessage(snoozing ? "actionTitleSnooze" : "actionTitle"),
        });
    }
}
