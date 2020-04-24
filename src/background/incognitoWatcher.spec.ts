/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { IncognitoWatcher } from "./incognitoWatcher";
import { mockEvent, EventMockOf } from "../testUtils/mockBrowser";
import { quickTab } from "../testUtils/quickHelpers";
import { booleanVariations } from "../testUtils/testHelpers";
import { mockContext, testContext } from "../testUtils/mockContext";

const COOKIE_STORE_ID = "mock";

describe("Incognito Watcher", () => {
    let incognitoWatcher: IncognitoWatcher | null = null;
    let onRemoved: EventMockOf<typeof mockBrowser.tabs.onRemoved>;
    let onCreated: EventMockOf<typeof mockBrowser.tabs.onCreated>;

    afterEach(() => {
        incognitoWatcher = null;
    });

    beforeEach(() => {
        onRemoved = mockEvent(mockBrowser.tabs.onRemoved);
        onCreated = mockEvent(mockBrowser.tabs.onCreated);
        mockContext.storeUtils.defaultCookieStoreId.mock(COOKIE_STORE_ID);
        incognitoWatcher = new IncognitoWatcher(testContext);
    });

    describe("listeners", () => {
        it("should add listeners on creation", () => {
            expect(onRemoved.hasListener(incognitoWatcher!["onRemoved"])).toBe(true);
            expect(onCreated.hasListener(incognitoWatcher!["onCreated"])).toBe(true);
        });
    });

    describe("initializeExistingTabs", () => {
        it("should query for and add existing incognito tabs", async () => {
            const tab1 = quickTab("", COOKIE_STORE_ID, false);
            const tab2 = quickTab("", COOKIE_STORE_ID, true);
            mockBrowser.tabs.query.expect({}).andResolve([tab1, tab2]);
            await incognitoWatcher!.initializeExistingTabs();
            expect(incognitoWatcher!.hasTab(tab1.id!)).toBe(false);
            expect(incognitoWatcher!.hasTab(tab2.id!)).toBe(true);
        });
    });

    describe("hasTab", () => {
        it("should return false for non-existing tab ids", () => {
            onCreated.emit(quickTab("", COOKIE_STORE_ID, true));
            expect(incognitoWatcher!.hasTab(42)).toBe(false);
        });
        describe.each(booleanVariations(1))("with incognito = %s", (incognito) => {
            it(`should return ${incognito} for the tab when it exists`, () => {
                const tab = quickTab("", COOKIE_STORE_ID, incognito);
                onCreated.emit(tab);
                expect(incognitoWatcher!.hasTab(tab.id!)).toBe(incognito);
                onRemoved.emit(tab.id!, {} as any);
                expect(incognitoWatcher!.hasTab(tab.id!)).toBe(false);
            });
        });
    });

    describe("hasCookieStore", () => {
        it("should return false for non-existing cookie-stores", () => {
            onCreated.emit(quickTab("", COOKIE_STORE_ID, true));
            expect(incognitoWatcher!.hasCookieStore("not-existing")).toBe(false);
        });
        describe.each(booleanVariations(1))("with incognito = %s", (incognito) => {
            it(`should return ${incognito} for the cookie store, even after the tab was removed`, () => {
                const tab = quickTab("", COOKIE_STORE_ID, incognito);
                onCreated.emit(tab);
                expect(incognitoWatcher!.hasCookieStore(COOKIE_STORE_ID)).toBe(incognito);
                onRemoved.emit(tab.id!, {} as any);
                expect(incognitoWatcher!.hasCookieStore(COOKIE_STORE_ID)).toBe(incognito);
            });
        });
    });
});
