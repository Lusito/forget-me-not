import { singleton } from "tsyringe";
import { browser, Tabs } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

import { getBadgeForCleanupType, badges } from "../shared/badges";
import { Settings } from "../shared/settings";
import { getValidHostname } from "../shared/domainUtils";
import { SnoozeManager } from "./snoozeManager";
import { MessageUtil } from "../shared/messageUtil";
import { someItemsMatch } from "./backgroundShared";
import { StoreUtils } from "../shared/storeUtils";
import { RuleManager } from "../shared/ruleManager";

const BADGE_SETTINGS_KEYS = ["rules", "fallbackRule", "whitelistNoTLD", "whitelistFileSystem", "showBadge"];

@singleton()
export class BadgeManager {
    private readonly defaultCookieStoreId: string;

    public constructor(
        private readonly settings: Settings,
        private readonly ruleManager: RuleManager,
        private readonly snoozeManager: SnoozeManager,
        private readonly messageUtil: MessageUtil,
        storeUtils: StoreUtils
    ) {
        this.defaultCookieStoreId = storeUtils.defaultCookieStoreId;
    }

    public async init() {
        await this.updateAllBadges();

        wetLayer.addListener(() => {
            this.updateAllBadges();
            this.updateBrowserAction(this.snoozeManager.isSnoozing());
        });
        this.snoozeManager.listeners.add((snoozing) => {
            this.updateBrowserAction(snoozing);
        });

        // listen for tab changes to update badge
        const updateByTabId = (tabId: number) => {
            browser.tabs.get(tabId).then((tab) => this.updateBadgeForTab(tab));
        };
        browser.tabs.onActivated.addListener((info) => updateByTabId(info.tabId));
        browser.tabs.onUpdated.addListener(updateByTabId);
        this.messageUtil.settingsChanged.receive((changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, BADGE_SETTINGS_KEYS)) this.updateAllBadges();
        });
    }

    private async updateAllBadges() {
        const tabs = await browser.tabs.query({ active: true });
        await Promise.all(tabs.map((tab) => this.updateBadgeForTab(tab)));
    }

    private async updateBadgeForTab(tab: Tabs.Tab) {
        if (tab?.url && !tab.incognito && tab.active) {
            const hostname = getValidHostname(tab.url);
            const badge = hostname
                ? getBadgeForCleanupType(
                      this.ruleManager.getCleanupTypeFor(
                          hostname,
                          tab.cookieStoreId || this.defaultCookieStoreId,
                          false
                      )
                  )
                : badges.none;
            let text = badge.i18nBadge ? wetLayer.getMessage(badge.i18nBadge) : "";
            if (!this.settings.get("showBadge")) text = "";
            if (browser.browserAction.setBadgeText) await browser.browserAction.setBadgeText({ text, tabId: tab.id });
            if (browser.browserAction.setBadgeBackgroundColor)
                await browser.browserAction.setBadgeBackgroundColor({ color: badge.color, tabId: tab.id });
            await browser.browserAction.enable(tab.id);
        } else {
            await browser.browserAction.disable(tab.id);
        }
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
