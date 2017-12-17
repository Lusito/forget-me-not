import { Runtime } from "./runtime";
import { Tabs } from "./tabs";
import { Alarms } from "./alarms";
import { Bookmarks } from "./bookmarks";
import { BrowserAction } from "./browserAction";
import { BrowsingData } from "./browsingData";
import { Commands } from "./commands";
import { ContextMenus } from "./contextMenus";
import { Cookies } from "./cookies";
import { Downloads } from "./downloads";
import { Extension } from "./extension";
import { History } from "./history";
import { I18n } from "./i18n";
import { Identity } from "./identity";
import { Idle } from "./idle";
import { Management } from "./management";
import { Notifications } from "./notifications";
import { Omnibox } from "./omnibox";
import { PageAction } from "./pageAction";
import { Permissions } from "./permissions";
import { Privacy } from "./privacy";
import { Proxy } from "./proxy";
import { Sessions } from "./sessions";
import { Storage } from "./storage";
import { WebNavigation } from "./webNavigation";
import { WebRequest } from "./webRequest";
import { Windows } from "./windows";
import { DevtoolsInspectedWindow } from "./devtools/inspectedWindow";
import { DevtoolsNetwork } from "./devtools/network";
import { DevtoolsPanels } from "./devtools/panels";

export interface Browser {
    alarms: Alarms.Static;
    bookmarks: Bookmarks.Static;
    browserAction: BrowserAction.Static;
    browsingData: BrowsingData.Static;
    commands: Commands.Static;
    contextMenus: ContextMenus.Static;
    cookies: Cookies.Static;
    devtools: {
        inspectedWindow: DevtoolsInspectedWindow.Static;
        network: DevtoolsNetwork.Static;
        panels: DevtoolsPanels.Static;
    };
    downloads: Downloads.Static;
    extension: Extension.Static;
    history: History.Static;
    i18n: I18n.Static;
    identity: Identity.Static;
    idle: Idle.Static;
    management: Management.Static;
    notifications: Notifications.Static;
    omnibox: Omnibox.Static;
    pageAction: PageAction.Static;
    permissions: Permissions.Static;
    privacy: Privacy.Static;
    proxy: Proxy.Static;
    runtime: Runtime.Static;
    sessions: Sessions.Static;
    storage: Storage.Static;
    tabs: Tabs.Static;
    webNavigation: WebNavigation.Static;
    webRequest: WebRequest.Static;
    windows: Windows.Static;
}

function getBrowser(): Browser {
    //@ts-ignore
    if (global && typeof global.it === 'function') {
        //@ts-ignore
        return {};
    }
    //@ts-ignore
    return require('webextension-polyfill');
}
export const browser = getBrowser();
