/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { HistoryCleaner } from "./historyCleaner";
import { TabWatcher } from "../tabWatcher";
import { settings } from "../../lib/settings";
import { CleanupType } from "../../lib/settingsSignature";
import { booleanContext } from "../../testUtils/testHelpers";
import { BrowsingData } from "webextension-polyfill-ts";

export{};

const COOKIE_STORE_ID = "mock";
const BLACKLISTED_DOMAIN = "instantly.com";
const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const UNKNOWN_DOMAIN = "unknown.com";
const OPEN_DOMAIN = "open.com";

describe("HistoryCleaner", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let cleaner: HistoryCleaner | null = null;
    let tabWatcher: TabWatcher | null = null;

    afterEach(async () => {
        tabWatcher = null;
        cleaner = null;
        await settings.restoreDefaults();
    });

    beforeEach(async () => {
        tabWatcher = new TabWatcher(tabWatcherListener);

        browserMock.tabs.create(`http://${OPEN_DOMAIN}`, COOKIE_STORE_ID);

        browserMock.cookies.cookieStores = [
            { id: COOKIE_STORE_ID, tabIds: [], incognito: false }
        ];
        settings.set("rules", [
            { rule: WHITELISTED_DOMAIN, type: CleanupType.NEVER },
            { rule: GRAYLISTED_DOMAIN, type: CleanupType.STARTUP },
            { rule: BLACKLISTED_DOMAIN, type: CleanupType.INSTANTLY }
        ]);
        await settings.save();
        cleaner = new HistoryCleaner(tabWatcher);
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
            history: true
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
            if (history && (startup && startupApplyRules || !startup && cleanAllApplyRules)) {
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
            it(`should protect whitelisted${startup ? "" : "and graylisted"} ${(startup || protectOpenDomains) ? "and open" : ""} domains`, async () => {
                await cleaner!.clean(typeSet, startup);
                expect(typeSet.history).toBe(false);
                const expectedCalls = [
                    [{ url: "https://www.google.de" }],
                    [{ url: `https://${BLACKLISTED_DOMAIN}` }]
                ];
                if (startup)
                    expectedCalls.push([{ url: `https://${GRAYLISTED_DOMAIN}` }]);
                if (!startup && !protectOpenDomains)
                    expectedCalls.push([{ url: `https://${OPEN_DOMAIN}` }]);
                expect(browserMock.history.deleteUrl.mock.calls).toEqual(expectedCalls);
                expect(browserMock.history.search.mock.calls).toEqual([[{ text: "" }]]);
                expect(typeSet.history).toBe(false);
            });
        });
    });
});
