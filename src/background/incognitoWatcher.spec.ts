/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { IncognitoWatcher } from "./incognitoWatcher";

const COOKIE_STORE_ID = "mock";
const COOKIE_STORE_ID_2 = "mock2";

describe("Incognito Watcher", () => {
    let incognitoWatcher: IncognitoWatcher | null = null;

    afterEach(() => {
        incognitoWatcher = null;
    });

    beforeEach(() => {
        incognitoWatcher = new IncognitoWatcher();
    });

    describe("listeners", () => {
        it("should add listeners on creation", () => {
            expect(browserMock.tabs.onRemoved.mock.addListener.mock.calls).toEqual([
                [(incognitoWatcher as any).onRemoved],
            ]);
            expect(browserMock.tabs.onCreated.mock.addListener.mock.calls).toEqual([
                [(incognitoWatcher as any).onCreated],
            ]);
        });
    });

    describe("hasTab", () => {
        describe("incognito = true", () => {
            it("should return false for non-existing tab ids and true for existing ones", () => {
                const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, true);
                expect(incognitoWatcher!.hasTab(42)).toBe(false);
                expect(incognitoWatcher!.hasTab(tabId)).toBe(true);
                browserMock.tabs.remove(tabId);
                expect(incognitoWatcher!.hasTab(tabId)).toBe(false);
            });
            it("should return true for pre-existing incognito tabs", () => {
                const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, true);
                const tabId2 = browserMock.tabs.create("", COOKIE_STORE_ID_2, false);
                incognitoWatcher = new IncognitoWatcher();
                expect(incognitoWatcher.hasTab(tabId)).toBe(true);
                expect(incognitoWatcher.hasTab(tabId2)).toBe(false);
            });
        });
        describe("incognito = false", () => {
            it("should return false for non-existing tab ids and for existing ones", () => {
                const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, false);
                expect(incognitoWatcher!.hasTab(42)).toBe(false);
                expect(incognitoWatcher!.hasTab(tabId)).toBe(false);
                browserMock.tabs.remove(tabId);
                expect(incognitoWatcher!.hasTab(tabId)).toBe(false);
            });
        });
    });

    describe("hasCookieStore", () => {
        it("should return false for non-existing cookie stores and true for existing ones that are incognito", () => {
            const tabId = browserMock.tabs.create("", COOKIE_STORE_ID, true);
            browserMock.tabs.create("", COOKIE_STORE_ID_2, false);
            expect(incognitoWatcher!.hasCookieStore("woot")).toBe(false);
            expect(incognitoWatcher!.hasCookieStore(COOKIE_STORE_ID)).toBe(true);
            expect(incognitoWatcher!.hasCookieStore(COOKIE_STORE_ID_2)).toBe(false);
            browserMock.tabs.remove(tabId);
            expect(incognitoWatcher!.hasCookieStore(COOKIE_STORE_ID)).toBe(true);
            expect(incognitoWatcher!.hasCookieStore(COOKIE_STORE_ID_2)).toBe(false);
        });
        it("should return true for pre-existing incognito cookie stores", () => {
            browserMock.tabs.create("", COOKIE_STORE_ID, true);
            browserMock.tabs.create("", COOKIE_STORE_ID_2, false);
            incognitoWatcher = new IncognitoWatcher();
            expect(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID)).toBe(true);
            expect(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID_2)).toBe(false);
        });
    });
});
