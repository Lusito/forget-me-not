/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData } from "webextension-polyfill-ts";

import { HistoryCleaner } from "./historyCleaner";
import { TabWatcher } from "../tabWatcher";
import { CleanupType } from "../../lib/shared";
import { booleanContext } from "../../testUtils/testHelpers";
import { quickSettings } from "../../testUtils/quickHelpers";
import { StoreUtils } from "../storeUtils";
import { DomainUtils } from "../domainUtils";
import { RequestWatcher } from "../requestWatcher";

const COOKIE_STORE_ID = "mock";
const BLACKLISTED_DOMAIN = "instantly.com";
const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const UNKNOWN_DOMAIN = "unknown.com";
const OPEN_DOMAIN = "open.com";

describe("HistoryCleaner", () => {
    const settings = quickSettings({
        version: "2.0.0",
        // fixme: mobile: true?
        mobile: false,
        // fixme: removeLocalStorageByHostname: false?
        removeLocalStorageByHostname: true,
    });
    // fixme: isFirefox: false
    const storeUtils = new StoreUtils(true);
    const domainUtils = new DomainUtils();
    const tabWatcherContext = {
        storeUtils,
        domainUtils,
    } as any;
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined,
    };
    let cleaner: HistoryCleaner | null = null;
    let tabWatcher: TabWatcher | null = null;

    afterEach(async () => {
        tabWatcher = null;
        cleaner = null;
        await settings.restoreDefaults();
    });

    beforeEach(async () => {
        tabWatcher = new TabWatcher(tabWatcherListener, tabWatcherContext);
        await tabWatcher.initializeExistingTabs();
        // eslint-disable-next-line no-new
        new RequestWatcher(tabWatcher, { domainUtils } as any);

        browserMock.tabs.create(`http://${OPEN_DOMAIN}`, COOKIE_STORE_ID);

        browserMock.cookies.cookieStores = [{ id: COOKIE_STORE_ID, tabIds: [], incognito: false }];
        settings.set("rules", [
            { rule: WHITELISTED_DOMAIN, type: CleanupType.NEVER },
            { rule: GRAYLISTED_DOMAIN, type: CleanupType.STARTUP },
            { rule: BLACKLISTED_DOMAIN, type: CleanupType.INSTANTLY },
        ]);
        await settings.save();
        cleaner = new HistoryCleaner({
            settings,
            domainUtils,
            tabWatcher,
        } as any);
    });

    describe("onVisited", () => {
        booleanContext((instantlyEnabled, instantlyHistory, applyRules, blacklisted) => {
            const domain = blacklisted ? BLACKLISTED_DOMAIN : UNKNOWN_DOMAIN;
            const url = `https://${domain}/some/path.html`;

            beforeEach(async () => {
                settings.set("instantly.enabled", instantlyEnabled);
                settings.set("instantly.history", instantlyHistory);
                settings.set("instantly.history.applyRules", applyRules);
                await settings.save();
            });

            if (instantlyEnabled && instantlyHistory && (!applyRules || blacklisted)) {
                it("should delete the history url", () => {
                    browserMock.history.onVisited.emit({ id: "mock", url });
                    expect(browserMock.history.deleteUrl.mock.calls).toEqual([[{ url }]]);
                });
            } else {
                it("should not delete the history url", () => {
                    browserMock.history.onVisited.emit({ id: "mock", url });
                    expect(browserMock.history.deleteUrl).not.toHaveBeenCalled();
                });
            }
        });
    });

    describe("clean", () => {
        const typeSet: BrowsingData.DataTypeSet = {
            history: true,
        };
        beforeEach(() => {
            typeSet.history = true;
        });
        booleanContext((history, startup, startupApplyRules, cleanAllApplyRules) => {
            beforeEach(async () => {
                typeSet.history = history;
                settings.set("startup.history.applyRules", startupApplyRules);
                settings.set("cleanAll.history.applyRules", cleanAllApplyRules);
                await settings.save();
            });
            if (history && ((startup && startupApplyRules) || (!startup && cleanAllApplyRules))) {
                it("should clean up", async () => {
                    await cleaner!.clean(typeSet, startup);
                    expect(browserMock.history.search.mock.calls).toEqual([[{ text: "" }]]);
                    expect(typeSet.history).toBe(false);
                });
            } else {
                it("should not do anything", async () => {
                    await cleaner!.clean(typeSet, startup);
                    expect(browserMock.history.search).not.toHaveBeenCalled();
                    expect(typeSet.history).toBe(history);
                });
            }
        });

        booleanContext((startup, protectOpenDomains) => {
            beforeEach(async () => {
                settings.set("cleanAll.protectOpenDomains", protectOpenDomains);
                await settings.save();
                browserMock.history.items.push({ id: "1", url: "https://www.google.de" });
                browserMock.history.items.push({ id: "2", url: `https://${BLACKLISTED_DOMAIN}` });
                browserMock.history.items.push({ id: "3", url: `https://${WHITELISTED_DOMAIN}` });
                browserMock.history.items.push({ id: "4", url: `https://${GRAYLISTED_DOMAIN}` });
                browserMock.history.items.push({ id: "5", url: `https://${OPEN_DOMAIN}` });
            });
            it(`should protect whitelisted${startup ? "" : "and graylisted"} ${
                startup || protectOpenDomains ? "and open" : ""
            } domains`, async () => {
                await cleaner!.clean(typeSet, startup);
                expect(typeSet.history).toBe(false);
                const expectedCalls = [[{ url: "https://www.google.de" }], [{ url: `https://${BLACKLISTED_DOMAIN}` }]];
                if (startup) expectedCalls.push([{ url: `https://${GRAYLISTED_DOMAIN}` }]);
                if (!startup && !protectOpenDomains) expectedCalls.push([{ url: `https://${OPEN_DOMAIN}` }]);
                expect(browserMock.history.deleteUrl.mock.calls).toEqual(expectedCalls);
                expect(browserMock.history.search.mock.calls).toEqual([[{ text: "" }]]);
                expect(typeSet.history).toBe(false);
            });
        });
    });
});
