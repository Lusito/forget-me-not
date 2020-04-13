/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

import { messageUtil } from "./lib/messageUtil";
import { settings } from "./lib/settings";
import { loadJSONFile } from "./lib/fileHelper";
import { Background, CleanUrlNowConfig } from "./background/background";
import { someItemsMatch } from "./background/backgroundShared";
import { manifestVersion } from "./lib/settingsMigrations";

const UPDATE_NOTIFICATION_ID = "UpdateNotification";
const BADGE_SETTINGS_KEYS = ["rules", "fallbackRule", "whitelistNoTLD", "whitelistFileSystem", "showBadge"];

wetLayer.reset();

settings.onReady(() => {
    const background = new Background();
    messageUtil.receive("cleanAllNow", () => background.cleanAllNow());
    messageUtil.receive("cleanUrlNow", (config: CleanUrlNowConfig) => background.cleanUrlNow(config));
    messageUtil.receive("toggleSnoozingState", () => background.toggleSnoozingState());
    messageUtil.receive("getSnoozingState", () => background.sendSnoozingState());

    // listen for tab changes to update badge
    const badgeUpdater = () => {
        background.updateBadge();
    };
    browser.tabs.onActivated.addListener(badgeUpdater);
    browser.tabs.onUpdated.addListener(badgeUpdater);
    messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
        if (someItemsMatch(changedKeys, BADGE_SETTINGS_KEYS)) background.updateBadge();
    });

    // for firefox compatibility, we need to show the open file dialog from background, as the browserAction popup will be hidden, stopping the script.
    messageUtil.receive("import", () => {
        loadJSONFile((json) => {
            json && settings.setAll(json);
        });
    });

    browser.notifications.onClicked.addListener((id: string) => {
        if (id === UPDATE_NOTIFICATION_ID) {
            browser.tabs.create({
                active: true,
                url: `${browser.runtime.getURL("dist/readme.html")}#changelog`,
            });
        }
    });

    function showUpdateNotification() {
        browser.notifications.create(UPDATE_NOTIFICATION_ID, {
            type: "basic",
            iconUrl: browser.extension.getURL("icons/icon96.png"),
            title: wetLayer.getMessage("update_notification_title"),
            message: wetLayer.getMessage("update_notification_message"),
        });
    }
    wetLayer.addListener(showUpdateNotification);

    const startup = async () => {
        const previousVersion = settings.get("version");
        if (previousVersion !== manifestVersion) {
            settings.set("version", manifestVersion);
            settings.performUpgrade(previousVersion);
            settings.rebuildRules();
            settings.save();

            if (settings.get("showUpdateNotification")) showUpdateNotification();
        }
        await background.onStartup();
    };
    setTimeout(() => {
        startup();
    }, 1000);
});
