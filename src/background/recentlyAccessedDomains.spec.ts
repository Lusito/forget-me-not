import { container } from "tsyringe";
import { whitelistPropertyAccess, mockAssimilate, denyPropertyAccess } from "mockzilla";
import { mockEvent, MockzillaEventOf } from "mockzilla-webextension";

import { RecentlyAccessedDomains } from "./recentlyAccessedDomains";
import { quickCookie, quickHeadersReceivedDetails } from "../testUtils/quickHelpers";
import { mocks } from "../testUtils/mocks";

const COOKIE_STORE_ID = "mock";

describe("RecentlyAccessedDomains", () => {
    let recentlyAccessedDomains: RecentlyAccessedDomains;
    let onHeadersReceived: MockzillaEventOf<typeof mockBrowser.webRequest.onHeadersReceived>;
    let onCookieChanged: MockzillaEventOf<typeof mockBrowser.cookies.onChanged>;

    beforeEach(() => {
        onHeadersReceived = mockEvent(mockBrowser.webRequest.onHeadersReceived);
        onCookieChanged = mockEvent(mockBrowser.cookies.onChanged);
    });

    function prepareApplySettings(enabled: boolean, limit = 5) {
        mocks.settings.get.expect("logRAD.enabled").andReturn(enabled);
        mocks.settings.get.expect("logRAD.limit").andReturn(limit);
    }
    function createRAD(enabled: boolean, limit = 5) {
        prepareApplySettings(enabled, limit);

        mocks.messageUtil.receive.expect("getRecentlyAccessedDomains", expect.anything());
        mocks.messageUtil.receive.expect("settingsChanged", expect.anything());
        mocks.messageUtil.mockAllow();
        mocks.incognitoWatcher.mockAllow();
        mocks.domainUtils.mockAllow();
        mocks.storeUtils.defaultCookieStoreId.mock(COOKIE_STORE_ID);
        recentlyAccessedDomains = container.resolve(RecentlyAccessedDomains);
    }

    // fixme: messageUtil listeners and events
    // fixme: get()

    describe("listeners", () => {
        it("should add listeners on creation if logRAD.enabled = true", () => {
            createRAD(true);
            expect(onHeadersReceived.addListener.mock.calls).toEqual([
                [
                    recentlyAccessedDomains["onHeadersReceived"],
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
            ]);
            expect(onCookieChanged.addListener.mock.calls).toEqual([[recentlyAccessedDomains["onCookieChanged"]]]);
        });
        it("should neither add nor remove listeners on creation if logRAD.enabled = false", () => {
            createRAD(false);
            expect(onHeadersReceived.addListener).not.toHaveBeenCalled();
            expect(onHeadersReceived.removeListener).not.toHaveBeenCalled();
            expect(onCookieChanged.addListener).not.toHaveBeenCalled();
            expect(onCookieChanged.removeListener).not.toHaveBeenCalled();
        });
        it("should add listeners after setting logRAD.enabled = true", () => {
            createRAD(false);
            prepareApplySettings(true);
            recentlyAccessedDomains["applySettings"]();
            expect(onHeadersReceived.addListener.mock.calls).toEqual([
                [
                    recentlyAccessedDomains["onHeadersReceived"],
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
            ]);
            expect(onCookieChanged.addListener.mock.calls).toEqual([[recentlyAccessedDomains["onCookieChanged"]]]);
        });
        it("should remove listeners after setting logRAD.enabled = false", () => {
            createRAD(true);
            prepareApplySettings(false);
            recentlyAccessedDomains["applySettings"]();
            expect(onHeadersReceived.removeListener.mock.calls).toEqual([
                [recentlyAccessedDomains["onHeadersReceived"]],
            ]);
            expect(onCookieChanged.removeListener.mock.calls).toEqual([[recentlyAccessedDomains["onCookieChanged"]]]);
        });
    });

    describe("onCookieChanged", () => {
        function fireOnCookieChanged(removed: boolean) {
            recentlyAccessedDomains["onCookieChanged"]({
                removed,
                cookie: quickCookie(".www.google.com", "hello", "", COOKIE_STORE_ID, ""),
                cause: 0 as any,
            });
        }
        it("should call add() if non-incognito cookie was added", () => {
            createRAD(false);
            const mock = mockAssimilate(recentlyAccessedDomains, "recentlyAccessedDomains", {
                mock: ["add"],
                whitelist: ["onCookieChanged", "incognitoWatcher", "domainUtils"],
            });
            mocks.domainUtils.removeLeadingDot.expect(".www.google.com").andReturn("www.google.com");
            mocks.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(false);
            mock.add.expect("www.google.com", COOKIE_STORE_ID);
            fireOnCookieChanged(false);
        });
        it("should not call add() if non-incognito cookie was removed", () => {
            createRAD(false);
            whitelistPropertyAccess(recentlyAccessedDomains, "onCookieChanged");
            fireOnCookieChanged(true);
        });
        it("should not call add() if incognito cookie was added or removed", () => {
            createRAD(false);
            whitelistPropertyAccess(recentlyAccessedDomains, "onCookieChanged", "incognitoWatcher");
            mocks.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(true);
            fireOnCookieChanged(false);
            fireOnCookieChanged(true);
        });
    });

    describe("onHeadersReceived", () => {
        it("should call add() if non-incognito tab received a header", () => {
            createRAD(false);
            const mock = mockAssimilate(recentlyAccessedDomains, "recentlyAccessedDomains", {
                mock: ["add"],
            });
            mock.add.expect("www.google.com", COOKIE_STORE_ID);
            mocks.incognitoWatcher.hasTab.expect(42).andReturn(false);
            mocks.domainUtils.getValidHostname.expect("http://www.google.com").andReturn("www.google.com");
            recentlyAccessedDomains["onHeadersReceived"](quickHeadersReceivedDetails("http://www.google.com", 42));
        });
        it("should not call add() if incognito tab received a header", () => {
            denyPropertyAccess(recentlyAccessedDomains, "add");
            mocks.incognitoWatcher.hasTab.expect(42).andReturn(true);
            recentlyAccessedDomains["onHeadersReceived"](quickHeadersReceivedDetails("http://www.google.com", 42));
        });
        it("should not call add() if tab with incognito attribute received a header", () => {
            createRAD(false);
            denyPropertyAccess(recentlyAccessedDomains, "add");
            recentlyAccessedDomains["onHeadersReceived"]({
                ...quickHeadersReceivedDetails("http://www.google.com", 42),
                incognito: true,
            });
        });
        it("should not call add() if a header was received on a negative tab id", () => {
            createRAD(false);
            denyPropertyAccess(recentlyAccessedDomains, "add");
            recentlyAccessedDomains["onHeadersReceived"](quickHeadersReceivedDetails("http://www.google.com", -1));
        });
    });

    describe("add", () => {
        const prepareLog = (domains: string[]) => domains.map((domain) => ({ domain, storeId: COOKIE_STORE_ID }));
        it("should not do anything if not enabled", () => {
            createRAD(false);
            recentlyAccessedDomains["log"] = prepareLog(["a", "b", "c", "d", "e", "f"]);
            recentlyAccessedDomains["add"]("woop", COOKIE_STORE_ID);
            expect(recentlyAccessedDomains["log"]).toEqual(prepareLog(["a", "b", "c", "d", "e", "f"]));
        });
        it("should not do anything if enabled, but domain is empty", () => {
            createRAD(true);
            recentlyAccessedDomains["log"] = prepareLog(["a", "b", "c", "d", "e", "f"]);
            recentlyAccessedDomains["add"]("", COOKIE_STORE_ID);
            expect(recentlyAccessedDomains["log"]).toEqual(prepareLog(["a", "b", "c", "d", "e", "f"]));
        });
        it("should not do anything if domain already at the top spot", () => {
            createRAD(true);
            recentlyAccessedDomains["log"] = prepareLog(["a", "b", "c", "d", "e", "f"]);
            recentlyAccessedDomains["add"]("a", COOKIE_STORE_ID);
            expect(recentlyAccessedDomains["log"]).toEqual(prepareLog(["a", "b", "c", "d", "e", "f"]));
        });
        it("should move existing domain to the top spot", () => {
            createRAD(true);
            recentlyAccessedDomains["log"] = prepareLog(["a", "b", "c", "d"]);
            recentlyAccessedDomains["add"]("c", COOKIE_STORE_ID);
            expect(recentlyAccessedDomains["log"]).toEqual(prepareLog(["c", "a", "b", "d"]));
        });
        it("should insert at the top spot and apply limits", () => {
            createRAD(true);
            recentlyAccessedDomains["log"] = prepareLog(["a", "b", "c", "d", "e", "f"]);
            recentlyAccessedDomains["add"]("woop", COOKIE_STORE_ID);
            expect(recentlyAccessedDomains["log"]).toEqual(prepareLog(["woop", "a", "b", "c", "d"]));
        });
    });
});
