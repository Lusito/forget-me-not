/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { booleanVariations, ensureNotNull, sleep } from "../testHelpers";
import { browserMock } from "../browserMock";
import { settings } from "../../src/lib/settings";
import { CleanupType } from "../../src/lib/settingsSignature";
import { HistoryCleaner } from "../../src/background/cleaners/historyCleaner";
import { BrowsingData } from "webextension-polyfill-ts";

const COOKIE_STORE_ID = "mock";
const BLACKLISTED_DOMAIN = "instantly.com";
const WHITELISTED_DOMAIN = "never.com";
const GRAYLISTED_DOMAIN = "startup.com";
const UNKNOWN_DOMAIN = "unknown.com";

describe("HistoryCleaner", () => {
    let cleaner: HistoryCleaner | null = null;

    beforeEach(() => {
        browserMock.reset();

        browserMock.cookies.cookieStores = [
            { id: COOKIE_STORE_ID, tabIds: [], incognito: false }
        ];
        settings.set("rules", [
            { rule: WHITELISTED_DOMAIN, type: CleanupType.NEVER },
            { rule: GRAYLISTED_DOMAIN, type: CleanupType.STARTUP },
            { rule: BLACKLISTED_DOMAIN, type: CleanupType.INSTANTLY }
        ]);
        settings.save();
        cleaner = new HistoryCleaner();
    });

    describe("onVisited", () => {
        booleanVariations(4).forEach(([instantly, instantlyHistory, applyRules, blacklisted]) => {
            context(`instantly.enabled = ${instantly}, instantly.history = ${instantlyHistory}, instantly.history.applyRules=${applyRules}`, () => {
                const domain = blacklisted ? BLACKLISTED_DOMAIN : UNKNOWN_DOMAIN;
                const url = `https://${domain}/some/path.html`;

                beforeEach(() => {
                    settings.set("instantly.enabled", instantly);
                    settings.set("instantly.history", instantlyHistory);
                    settings.set("instantly.history.applyRules", applyRules);
                    settings.save();
                });

                if (instantly && instantlyHistory && (!applyRules || blacklisted)) {
                    it("should delete the history url", () => {
                        browserMock.history.onVisited.emit({ id: "mock", url });
                        browserMock.history.deleteUrl.assertCalls([[{ url }]]);
                    });
                } else {
                    it("should not delete the history url", () => {
                        browserMock.history.onVisited.emit({ id: "mock", url });
                        browserMock.history.deleteUrl.assertNoCall();
                    });
                }
            });
        });
    });

    describe("clean", () => {
        const typeSet: BrowsingData.DataTypeSet = {
            history: true
        };
        beforeEach(() => {
            typeSet.history = true;
        });
        booleanVariations(4).forEach(([history, startup, startupApplyRules, cleanAllApplyRules]) => {
            context(`history=${history}, startup = ${startup}, startupApplyRules = ${startupApplyRules}, startupApplyRules = ${cleanAllApplyRules}`, () => {
                beforeEach(() => {
                    typeSet.history = history;
                    settings.set("startup.history.applyRules", startupApplyRules);
                    settings.set("cleanAll.history.applyRules", cleanAllApplyRules);
                    settings.save();
                });
                if (history && (startup && startupApplyRules || !startup && cleanAllApplyRules)) {
                    it("should clean up", () => {
                        cleaner = ensureNotNull(cleaner);
                        cleaner.clean(typeSet, startup);
                        browserMock.history.search.assertCalls([[{ text: "" }]]);
                        assert.isFalse(typeSet.history);
                    });
                } else {
                    it("should not do anything", () => {
                        cleaner = ensureNotNull(cleaner);
                        cleaner.clean(typeSet, startup);
                        browserMock.history.search.assertNoCall();
                        assert.strictEqual(typeSet.history, history);
                    });
                }
            });
        });

        booleanVariations(2).forEach(([startup, protectOpenDomains]) => {
            context(`startup = ${startup}, protectOpenDomains = ${protectOpenDomains}`, () => {
                beforeEach(() => {
                    settings.set("cleanAll.protectOpenDomains", protectOpenDomains);
                    settings.save();
                    browserMock.history.items.push({ id: "1", url: "https://www.google.de" });
                    browserMock.history.items.push({ id: "2", url: `https://${BLACKLISTED_DOMAIN}` });
                    browserMock.history.items.push({ id: "3", url: `https://${WHITELISTED_DOMAIN}` });
                    browserMock.history.items.push({ id: "4", url: `https://${GRAYLISTED_DOMAIN}` });
                });
                it(`should protect whitelisted${startup ? "" : "and graylisted"} domains`, async () => {
                    cleaner = ensureNotNull(cleaner);
                    cleaner.clean(typeSet, startup);
                    assert.isFalse(typeSet.history);
                    await sleep(10);
                    const expectedCalls = [
                        [{ url: "https://www.google.de" }],
                        [{ url: `https://${BLACKLISTED_DOMAIN}` }]
                    ];
                    if (startup)
                        expectedCalls.push([{ url: `https://${GRAYLISTED_DOMAIN}` }]);
                    browserMock.history.deleteUrl.assertCalls(expectedCalls);
                    browserMock.history.search.assertCalls([[{ text: "" }]]);
                    assert.isFalse(typeSet.history);
                });
            });
        });
    });
});
