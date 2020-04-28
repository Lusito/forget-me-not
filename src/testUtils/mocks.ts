import { container } from "tsyringe";
import { constructor } from "tsyringe/dist/typings/types";
import { deepMock, MockzillaDeep } from "mockzilla";

import { MessageUtil } from "../shared/messageUtil";
import { DefaultSettingsProvider } from "../shared/defaultSettings";
import { SupportsInfo } from "../shared/supportsInfo";
import { IncognitoWatcher } from "../background/incognitoWatcher";
import { TabWatcher } from "../background/tabWatcher";
import { Settings } from "../shared/settings";
import { DomainUtils } from "../shared/domainUtils";
import { CookieUtils } from "../background/cookieUtils";
import { StoreUtils } from "../shared/storeUtils";
import { SnoozeManager } from "../background/snoozeManager";
import { BrowserInfo } from "../shared/browserInfo";

const ucFirst = (t: string) => t[0].toLowerCase() + t.substr(1);

function prepareMock<T>(token: constructor<T>): MockzillaDeep<T> {
    const [proxy, mock, rootNode] = deepMock<T>(ucFirst((token as any).name), false);
    rootNode.disable();

    afterEach(() => rootNode.verifyAndDisable());

    return new Proxy({} as any, {
        get(target: any, prop: string) {
            if (rootNode.isDisabled()) {
                rootNode.enable();
                container.register(token, { useValue: proxy });
            }
            return (mock as any)[prop];
        },
    });
}

export const mocks = {
    messageUtil: prepareMock(MessageUtil),
    defaultSettings: prepareMock(DefaultSettingsProvider),
    supports: prepareMock(SupportsInfo),
    incognitoWatcher: prepareMock(IncognitoWatcher),
    tabWatcher: prepareMock(TabWatcher),
    settings: prepareMock(Settings),
    domainUtils: prepareMock(DomainUtils),
    cookieUtils: prepareMock(CookieUtils),
    storeUtils: prepareMock(StoreUtils),
    snoozeManager: prepareMock(SnoozeManager),
    browserInfo: prepareMock(BrowserInfo),
};
