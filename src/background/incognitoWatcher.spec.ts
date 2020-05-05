import { container } from "tsyringe";
import { mockEvent, MockzillaEventOf } from "mockzilla-webextension";

import { IncognitoWatcher } from "./incognitoWatcher";
import { quickTab } from "../testUtils/quickHelpers";
import { booleanVariations } from "../testUtils/testHelpers";
import { mocks } from "../testUtils/mocks";

const COOKIE_STORE_ID = "mock";

describe("IncognitoWatcher", () => {
    let incognitoWatcher: IncognitoWatcher;
    let onRemoved: MockzillaEventOf<typeof mockBrowser.tabs.onRemoved>;
    let onCreated: MockzillaEventOf<typeof mockBrowser.tabs.onCreated>;

    beforeEach(() => {
        onRemoved = mockEvent(mockBrowser.tabs.onRemoved);
        onCreated = mockEvent(mockBrowser.tabs.onCreated);
        mocks.storeUtils.defaultCookieStoreId.mock(COOKIE_STORE_ID);
        incognitoWatcher = container.resolve(IncognitoWatcher);
    });

    describe("listeners", () => {
        it("should add listeners after init", () => {
            incognitoWatcher.init([]);
            expect(onRemoved.hasListener(incognitoWatcher["onTabRemoved"])).toBe(true);
            expect(onCreated.hasListener(incognitoWatcher["onTabCreated"])).toBe(true);
        });
    });

    describe("init", () => {
        it("should add existing incognito tabs", () => {
            const tab1 = quickTab("", COOKIE_STORE_ID, false);
            const tab2 = quickTab("", COOKIE_STORE_ID, true);
            incognitoWatcher.init([tab1, tab2]);
            expect(incognitoWatcher.hasTab(tab1.id)).toBe(false);
            expect(incognitoWatcher.hasTab(tab2.id)).toBe(true);
        });
    });

    describe("hasTab", () => {
        it("should return false for non-existing tab ids", () => {
            onCreated.emit(quickTab("", COOKIE_STORE_ID, true));
            expect(incognitoWatcher.hasTab(42)).toBe(false);
        });
        describe.each(booleanVariations(1))("with incognito = %s", (incognito) => {
            it(`should return ${incognito} for the tab when it exists`, () => {
                incognitoWatcher.init([]);
                const tab = quickTab("", COOKIE_STORE_ID, incognito);
                onCreated.emit(tab);
                expect(incognitoWatcher.hasTab(tab.id)).toBe(incognito);
                onRemoved.emit(tab.id, {} as any);
                expect(incognitoWatcher.hasTab(tab.id)).toBe(false);
            });
        });
    });

    describe("hasCookieStore", () => {
        it("should return false for non-existing cookie-stores", () => {
            incognitoWatcher.init([]);
            onCreated.emit(quickTab("", COOKIE_STORE_ID, true));
            expect(incognitoWatcher.hasCookieStore("not-existing")).toBe(false);
        });
        describe.each(booleanVariations(1))("with incognito = %s", (incognito) => {
            it(`should return ${incognito} for the cookie store, even after the tab was removed`, () => {
                incognitoWatcher.init([]);
                const tab = quickTab("", COOKIE_STORE_ID, incognito);
                onCreated.emit(tab);
                expect(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID)).toBe(incognito);
                onRemoved.emit(tab.id, {} as any);
                expect(incognitoWatcher.hasCookieStore(COOKIE_STORE_ID)).toBe(incognito);
            });
        });
    });
});
