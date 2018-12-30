/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browserMock } from "./browserMock";
import { ensureNotNull } from "./testHelpers";
import { describe } from "mocha";
import { IncognitoWatcher } from "../src/background/incognitoWatcher";
import { assert } from "chai";

const COOKIE_STORE_ID = "mock";
const COOKIE_STORE_ID_2 = "mock2";

describe("Incognito Watcher", () => {
    let incognitoWatcher: IncognitoWatcher | null = null;

    afterEach(() => {
        incognitoWatcher = null;
    });

    beforeEach(() => {
        browserMock.reset();
        incognitoWatcher = new IncognitoWatcher();
    });

    describe("listeners", () => {
        it("should add listeners on creation", () => {
            browserMock.tabs.onRemoved.mock.addListener.assertCalls([[(incognitoWatcher as any).onRemoved]]);
            browserMock.tabs.onCreated.mock.addListener.assertCalls([[(incognitoWatcher as any).onCreated]]);
        });
    });

    describe("hasTab", () => {
        context("incognito = true", () => {
            it("should return false for non-existing tab ids and true for existing ones", () => {
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, true);
                assert.isFalse(incognitoWatcher.hasTab(42));
                assert.isTrue(incognitoWatcher.hasTab(tabId));
                browserMock.tabs.remove(tabId);
                assert.isFalse(incognitoWatcher.hasTab(tabId));
            });
            it("should return true for pre-existing incognito tabs", () => {
                const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, true);
                const tabId2 = browserMock.tabs.create("", COOKIE_STORE_ID_2, false);
                incognitoWatcher = new IncognitoWatcher();
                assert.isTrue(incognitoWatcher.hasTab(tabId));
                assert.isFalse(incognitoWatcher.hasTab(tabId2));
            });
        });
        context("incognito = false", () => {
            it("should return false for non-existing tab ids and for existing ones", () => {
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, false);
                assert.isFalse(incognitoWatcher.hasTab(42));
                assert.isFalse(incognitoWatcher.hasTab(tabId));
                browserMock.tabs.remove(tabId);
                assert.isFalse(incognitoWatcher.hasTab(tabId));
            });
        });
    });

    describe("hasCookieStore", () => {
        it("should return false for non-existing cookie stores and true for existing ones that are incognito", () => {
            incognitoWatcher = ensureNotNull(incognitoWatcher);
            const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, true);
            browserMock.tabs.create("", COOKIE_STORE_ID_2, false);
            assert.isFalse(incognitoWatcher.hasCookieStore("woot"));
            assert.isTrue(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID));
            assert.isFalse(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID_2));
            browserMock.tabs.remove(tabId);
            assert.isTrue(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID));
            assert.isFalse(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID_2));
        });
        it("should return true for pre-existing incognito cookie stores", () => {
            browserMock.tabs.create("", COOKIE_STORE_ID, true);
            browserMock.tabs.create("", COOKIE_STORE_ID_2, false);
            incognitoWatcher = new IncognitoWatcher();
            assert.isTrue(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID));
            assert.isFalse(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID_2));
        });
    });
});
