/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import "@abraham/reflection";
import { container } from "tsyringe";
import { browser } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

import bootstrap from "./shared/bootstrap";
import { BadgeManager } from "./background/badgeManager";
import { Settings } from "./shared/settings";
import { SnoozeManager } from "./background/snoozeManager";
import { CleanupManager } from "./background/cleanupManager";
import { NotificationHandler } from "./background/notificationHandler";
import { HeaderFilter } from "./background/headerFilter";
import { RequestWatcher } from "./background/requestWatcher";
import { RecentlyAccessedDomains } from "./background/recentlyAccessedDomains";
import { TabWatcher } from "./background/tabWatcher";
import { IncognitoWatcher } from "./background/incognitoWatcher";
import { ExtensionInfo } from "./shared/extensionInfo";

wetLayer.reset();

bootstrap().then(async () => {
    // fixme: handle exceptions in here
    const { version } = container.resolve(ExtensionInfo);
    const settings = container.resolve(Settings);
    const notificationHandler = container.resolve(NotificationHandler);
    const previousVersion = settings.get("version");
    if (previousVersion !== version) {
        settings.set("version", version);
        settings.performUpgrade(previousVersion);
        settings.rebuildRules();
        await settings.save();

        if (settings.get("showUpdateNotification")) await notificationHandler.showUpdateNotification();
    }

    container.resolve(BadgeManager);

    const tabs = await browser.tabs.query({});
    container.resolve(TabWatcher).init(tabs);
    container.resolve(IncognitoWatcher).init(tabs);

    container.resolve(RecentlyAccessedDomains);
    container.resolve(SnoozeManager);
    container.resolve(HeaderFilter).init();
    container.resolve(RequestWatcher);

    await container.resolve(CleanupManager).init(tabs);
});
