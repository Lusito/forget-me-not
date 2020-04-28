/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { container } from "tsyringe";
import { deepMock, mockAssimilate } from "mockzilla";

import { TabWatcher } from "./tabWatcher";
import { mocks } from "../testUtils/mocks";
import { quickTab } from "../testUtils/quickHelpers";
import { booleanVariations } from "../testUtils/testHelpers";
import { TabInfo } from "./tabInfo";

const COOKIE_STORE_ID = "mock";
const COOKIE_STORE_ID2 = "mock2";

describe("TabWatcher", () => {
    let tabWatcher: TabWatcher | null = null;
    beforeEach(() => {
        mocks.storeUtils.defaultCookieStoreId.mock("default-mock-store");
        mocks.domainUtils.mockAllow();
        tabWatcher = container.resolve(TabWatcher);
    });

    afterEach(() => {
        tabWatcher = null;
    });

    function prepareTab(url: string, domain: string, store: string) {
        const tab = quickTab(url, store, false);
        if (url) mocks.domainUtils.getValidHostname.expect(url).andReturn(domain);
        tabWatcher!["onTabCreated"](tab);
        return tab;
    }

    describe("init", () => {
        it("should add listeners", () => {
            mockAssimilate(tabWatcher!, "tabWatcher", {
                mock: ["onTabCreated", "onTabRemoved"],
                whitelist: ["init"]
            });
            mockBrowser.tabs.onCreated.addListener.expect(tabWatcher!["onTabCreated"]);
            mockBrowser.tabs.onRemoved.addListener.expect(tabWatcher!["onTabRemoved"]);
            tabWatcher!.init([]);
        });
        it("should initialize existing tabs", () => {
            const mock = mockAssimilate(tabWatcher!, "tabWatcher", {
                mock: ["onTabCreated", "onTabRemoved"],
                whitelist: ["init"]
            });
            mockBrowser.tabs.onCreated.addListener.expect(tabWatcher!["onTabCreated"]);
            mockBrowser.tabs.onRemoved.addListener.expect(tabWatcher!["onTabRemoved"]);
            const tab1 = quickTab("", COOKIE_STORE_ID, false);
            const tab2 = quickTab("", COOKIE_STORE_ID, true);
            mock.onTabCreated.expect(tab1);
            mock.onTabCreated.expect(tab2);
            tabWatcher!.init([tab1, tab2]);
        });
    });

    describe("listener", () => {
        const onDomainEnter = jest.fn();
        const onDomainLeave = jest.fn();
        beforeEach(() => {
            tabWatcher!.domainEnterListeners.add(onDomainEnter);
            tabWatcher!.domainLeaveListeners.add(onDomainLeave);
            onDomainEnter.mockClear();
            onDomainLeave.mockClear();
        });
        it("should not do anything with incognito tabs", () => {
            quickTab("http://www.google.com", COOKIE_STORE_ID, true);
            expect(onDomainEnter).not.toHaveBeenCalled();
            expect(onDomainLeave).not.toHaveBeenCalled();
        });
        it("should be called on tab create and remove", () => {
            const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);
            onDomainEnter.mockClear();

            const tab2 = prepareTab("http://www.google.de", "www.google.de", COOKIE_STORE_ID2);
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID2, "www.google.de"]]);

            tabWatcher!["onTabRemoved"](tab1.id!);
            expect(onDomainLeave.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);
            onDomainLeave.mockClear();

            tabWatcher!["onTabRemoved"](tab2.id!);
            expect(onDomainLeave.mock.calls).toEqual([[COOKIE_STORE_ID2, "www.google.de"]]);
        });
        it("should be called only for new domains tab create and remove", () => {
            const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);
            onDomainEnter.mockClear();

            const tab1b = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            expect(onDomainEnter).not.toHaveBeenCalled();

            const tab2 = prepareTab("http://www.google.de", "www.google.de", COOKIE_STORE_ID2);
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID2, "www.google.de"]]);
            onDomainEnter.mockClear();

            const tab2b = prepareTab("http://www.google.de", "www.google.de", COOKIE_STORE_ID2);
            expect(onDomainEnter).not.toHaveBeenCalled();

            tabWatcher!["onTabRemoved"](tab1.id!);
            expect(onDomainLeave).not.toHaveBeenCalled();
            tabWatcher!["onTabRemoved"](tab1b.id!);
            expect(onDomainLeave.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);
            onDomainLeave.mockClear();

            tabWatcher!["onTabRemoved"](tab2.id!);
            expect(onDomainLeave).not.toHaveBeenCalled();
            tabWatcher!["onTabRemoved"](tab2b.id!);
            expect(onDomainLeave.mock.calls).toEqual([[COOKIE_STORE_ID2, "www.google.de"]]);
        });
        it("should be called after web navigation commit", () => {
            const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);
            onDomainEnter.mockClear();
            tabWatcher!.prepareNavigation(tab1.id!, 0, "www.google.de");
            expect(onDomainEnter).not.toHaveBeenCalled();
            expect(onDomainLeave).not.toHaveBeenCalled();
            tabWatcher!.commitNavigation(tab1.id!, 0, "www.google.de");
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.de"]]);
            expect(onDomainLeave.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);
        });
        it("should be called when a navigation follows a navigation", () => {
            const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            tabWatcher!.prepareNavigation(tab1.id!, 0, "www.google.de");
            tabWatcher!.prepareNavigation(tab1.id!, 0, "www.google.jp");
            tabWatcher!.prepareNavigation(tab1.id!, 0, "www.amazon.com");
            tabWatcher!.prepareNavigation(tab1.id!, 0, "www.amazon.de");
            expect(onDomainLeave.mock.calls).toEqual([
                [COOKIE_STORE_ID, "www.google.de"],
                [COOKIE_STORE_ID, "www.google.jp"],
                [COOKIE_STORE_ID, "www.amazon.com"],
            ]);
        });
        it("should call scheduleDeadFramesCheck on tab if it exists", () => {
            const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            const [tabInfo, mockTabInfo] = deepMock<TabInfo>("tabInfo");
            tabWatcher!["tabInfos"][tab1.id!] = tabInfo;

            mockTabInfo.scheduleDeadFramesCheck.expect();
            tabWatcher!.completeNavigation(tab1.id!);
        });
        it("should be called for frames", () => {
            const tab1 = prepareTab("http://www.amazon.com", "www.amazon.com", COOKIE_STORE_ID);
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID, "www.amazon.com"]]);
            onDomainEnter.mockClear();
            tabWatcher!.prepareNavigation(tab1.id!, 1, "images.google.com");
            tabWatcher!.prepareNavigation(tab1.id!, 1, "www.google.com");
            expect(onDomainLeave.mock.calls).toEqual([[COOKIE_STORE_ID, "images.google.com"]]);
            expect(onDomainEnter).not.toHaveBeenCalled();
            onDomainLeave.mockClear();
            tabWatcher!.commitNavigation(tab1.id!, 1, "www.google.com");
            expect(onDomainEnter.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);
            onDomainEnter.mockClear();

            tabWatcher!.commitNavigation(tab1.id!, 1, "www.google.com");
            expect(onDomainEnter).not.toHaveBeenCalled();

            tabWatcher!.prepareNavigation(tab1.id!, 1, "");
            expect(onDomainLeave).not.toHaveBeenCalled();
            tabWatcher!.commitNavigation(tab1.id!, 1, "");
            expect(onDomainLeave.mock.calls).toEqual([[COOKIE_STORE_ID, "www.google.com"]]);

            expect(onDomainEnter).not.toHaveBeenCalled();
        });
    });
    describe("cookieStoreContainsDomain", () => {
        describe.each(booleanVariations(1))("with checkNext=%j", (checkNext) => {
            it("should return false for non-existing cookie stores", () => {
                prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
                expect(tabWatcher!.cookieStoreContainsDomain("non-existing", "www.google.com", checkNext)).toBe(false);
            });
            it("should return false for empty cookie stores", () => {
                const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
                tabWatcher!["onTabRemoved"](tab1.id!);
                expect(tabWatcher!.cookieStoreContainsDomain(COOKIE_STORE_ID, "www.google.com", checkNext)).toBe(false);
            });
            it("should forward request to tabInfo.contains", () => {
                const [tabInfo1, mockTabInfo1] = deepMock<TabInfo>("tabInfo1");
                const [tabInfo2, mockTabInfo2] = deepMock<TabInfo>("tabInfo2");
                tabWatcher!["tabInfosByCookieStore"][COOKIE_STORE_ID] = [tabInfo1, tabInfo2];
                mockTabInfo1.contains.expect("www.google.com", checkNext).andReturn(true);
                expect(tabWatcher!.cookieStoreContainsDomain(COOKIE_STORE_ID, "www.google.com", checkNext)).toBe(true);
                mockTabInfo1.contains.expect("www.google.com", checkNext).andReturn(false);
                mockTabInfo2.contains.expect("www.google.com", checkNext).andReturn(true);
                expect(tabWatcher!.cookieStoreContainsDomain(COOKIE_STORE_ID, "www.google.com", checkNext)).toBe(true);
                mockTabInfo1.contains.expect("www.google.com", checkNext).andReturn(false);
                mockTabInfo2.contains.expect("www.google.com", checkNext).andReturn(false);
                expect(tabWatcher!.cookieStoreContainsDomain(COOKIE_STORE_ID, "www.google.com", checkNext)).toBe(false);
            });
        });
    });
    describe("containsDomain", () => {
        it("should work with multiple cookie stores", () => {
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(false);

            const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(true);
            expect(tabWatcher!.containsDomain("www.google.de")).toBe(false);

            const tab2 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(true);

            tabWatcher!["onTabRemoved"](tab1.id!);
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(true);
            tabWatcher!["onTabRemoved"](tab2.id!);
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(false);
        });
        it("should work during navigation", () => {
            const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
            tabWatcher!.prepareNavigation(tab1.id!, 0, "www.google.de");
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(true);
            expect(tabWatcher!.containsDomain("www.google.de")).toBe(true);
            tabWatcher!.commitNavigation(tab1.id!, 0, "www.google.de");
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(false);
            expect(tabWatcher!.containsDomain("www.google.de")).toBe(true);
        });
        it("should work with frames", () => {
            const tab1 = prepareTab("", "", COOKIE_STORE_ID);
            tabWatcher!.commitNavigation(tab1.id!, 1, "www.google.com");
            tabWatcher!.prepareNavigation(tab1.id!, 1, "www.google.de");
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(true);
            expect(tabWatcher!.containsDomain("www.google.de")).toBe(true);
            tabWatcher!.commitNavigation(tab1.id!, 1, "www.google.de");
            expect(tabWatcher!.containsDomain("www.google.com")).toBe(false);
            expect(tabWatcher!.containsDomain("www.google.de")).toBe(true);
        });
    });

    // fixme: containsRuleFP

    describe("isThirdPartyCookieOnTab", () => {
        it("should return false for non-existing tabs", () => {
            expect(tabWatcher!.isThirdPartyCookieOnTab(1, "google.com")).toBe(false);
            expect(tabWatcher!.isThirdPartyCookieOnTab(1, "www.google.com")).toBe(false);
            expect(tabWatcher!.isThirdPartyCookieOnTab(1, "google.de")).toBe(false);
        });
        it("should forward request to tabInfo.matchHostnameFP", () => {
            const [tabInfo, mockTabInfo] = deepMock<TabInfo>("tabInfo");
            tabWatcher!["tabInfos"]["42"] = tabInfo;
            mockTabInfo.matchHostnameFP.expect("outgoing.com").andReturn(true);
            mocks.domainUtils.getFirstPartyCookieDomain.expect(".incoming.com").andReturn("outgoing.com");
            expect(tabWatcher!.isThirdPartyCookieOnTab(42, ".incoming.com")).toBe(false);
            mockTabInfo.matchHostnameFP.expect("outgoing.com").andReturn(false);
            mocks.domainUtils.getFirstPartyCookieDomain.expect(".incoming.com").andReturn("outgoing.com");
            expect(tabWatcher!.isThirdPartyCookieOnTab(42, ".incoming.com")).toBe(true);
        });
    });
    describe("cookieStoreContainsDomainFP", () => {
        describe.each(booleanVariations(1))("with deep=%j", (deep) => {
            it("should return false for non-existing cookie stores", () => {
                prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
                expect(tabWatcher!.cookieStoreContainsDomainFP("non-existing", "google.com", deep)).toBe(false);
            });
            it("should return false for empty cookie stores", () => {
                const tab1 = prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
                tabWatcher!["onTabRemoved"](tab1.id!);
                expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "google.com", deep)).toBe(false);
            });
            it("should return true for a cookie store with said fp domain", () => {
                prepareTab("http://www.google.com", "www.google.com", COOKIE_STORE_ID);
                expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "google.com", deep)).toBe(true);
            });
        });
        it("should forward request to tabInfo.containsHostnameFP if deep=true", () => {
            const [tabInfo1, mockTabInfo1] = deepMock<TabInfo>("tabInfo1");
            const [tabInfo2, mockTabInfo2] = deepMock<TabInfo>("tabInfo2");
            tabWatcher!["tabInfosByCookieStore"][COOKIE_STORE_ID] = [tabInfo1, tabInfo2];
            mockTabInfo1.containsHostnameFP.expect("firstparty.com").andReturn(true);
            expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "firstparty.com", true)).toBe(true);
            mockTabInfo1.containsHostnameFP.expect("firstparty.com").andReturn(false);
            mockTabInfo2.containsHostnameFP.expect("firstparty.com").andReturn(true);
            expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "firstparty.com", true)).toBe(true);
            mockTabInfo1.containsHostnameFP.expect("firstparty.com").andReturn(false);
            mockTabInfo2.containsHostnameFP.expect("firstparty.com").andReturn(false);
            expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "firstparty.com", true)).toBe(false);
        });
        it("should forward request to tabInfo.matchHostnameFP if deep=false", () => {
            const [tabInfo1, mockTabInfo1] = deepMock<TabInfo>("tabInfo1");
            const [tabInfo2, mockTabInfo2] = deepMock<TabInfo>("tabInfo2");
            tabWatcher!["tabInfosByCookieStore"][COOKIE_STORE_ID] = [tabInfo1, tabInfo2];
            mockTabInfo1.matchHostnameFP.expect("firstparty.com").andReturn(true);
            expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "firstparty.com", false)).toBe(true);
            mockTabInfo1.matchHostnameFP.expect("firstparty.com").andReturn(false);
            mockTabInfo2.matchHostnameFP.expect("firstparty.com").andReturn(true);
            expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "firstparty.com", false)).toBe(true);
            mockTabInfo1.matchHostnameFP.expect("firstparty.com").andReturn(false);
            mockTabInfo2.matchHostnameFP.expect("firstparty.com").andReturn(false);
            expect(tabWatcher!.cookieStoreContainsDomainFP(COOKIE_STORE_ID, "firstparty.com", false)).toBe(false);
        });
    });
});
