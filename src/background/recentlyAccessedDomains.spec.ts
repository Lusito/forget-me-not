/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { container } from "tsyringe";

import { RecentlyAccessedDomains } from "./recentlyAccessedDomains";
import { mockEvent, EventMockOf } from "../testUtils/mockBrowser";
import { quickCookie, quickHeadersReceivedDetails } from "../testUtils/quickHelpers";
import { mocks } from "../testUtils/mocks";
import { mockAssimilate, whitelistPropertyAccess } from "../testUtils/deepMockAssimilate";

const COOKIE_STORE_ID = "mock";

describe("Recently Accessed Domains", () => {
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let onHeadersReceived: EventMockOf<typeof mockBrowser.webRequest.onHeadersReceived>;
    let onCookieChanged: EventMockOf<typeof mockBrowser.cookies.onChanged>;

    beforeEach(() => {
        onHeadersReceived = mockEvent(mockBrowser.webRequest.onHeadersReceived);
        onCookieChanged = mockEvent(mockBrowser.cookies.onChanged);
    });
    afterEach(() => {
        recentlyAccessedDomains = null;
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
        recentlyAccessedDomains = container.resolve(RecentlyAccessedDomains);
    }

    // fixme: messageUtil listeners and events
    // fixme: get()

    describe("listeners", () => {
        it("should add listeners on creation if logRAD.enabled = true", () => {
            createRAD(true);
            expect(onHeadersReceived.addListener.mock.calls).toEqual([
                [
                    recentlyAccessedDomains!["onHeadersReceived"],
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
            ]);
            expect(onCookieChanged.addListener.mock.calls).toEqual([[recentlyAccessedDomains!["onCookieChanged"]]]);
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
            recentlyAccessedDomains!["applySettings"]();
            expect(onHeadersReceived.addListener.mock.calls).toEqual([
                [
                    recentlyAccessedDomains!["onHeadersReceived"],
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
            ]);
            expect(onCookieChanged.addListener.mock.calls).toEqual([[recentlyAccessedDomains!["onCookieChanged"]]]);
        });
        it("should remove listeners after setting logRAD.enabled = false", () => {
            createRAD(true);
            prepareApplySettings(false);
            recentlyAccessedDomains!["applySettings"]();
            expect(onHeadersReceived.removeListener.mock.calls).toEqual([
                [recentlyAccessedDomains!["onHeadersReceived"]],
            ]);
            expect(onCookieChanged.removeListener.mock.calls).toEqual([[recentlyAccessedDomains!["onCookieChanged"]]]);
        });
    });

    describe("onCookieChanged", () => {
        function fireOnCookieChanged(removed: boolean) {
            recentlyAccessedDomains!["onCookieChanged"]({
                removed,
                cookie: quickCookie(".www.google.com", "hello", "", COOKIE_STORE_ID, ""),
                cause: 0 as any,
            });
        }
        it("should call add() if non-incognito cookie was added", () => {
            createRAD(false);
            const mock = mockAssimilate(
                recentlyAccessedDomains!,
                ["add"],
                ["onCookieChanged", "incognitoWatcher", "domainUtils"]
            );
            mocks.domainUtils.removeLeadingDot.expect(".www.google.com").andReturn("www.google.com");
            mocks.incognitoWatcher.hasCookieStore.expect(COOKIE_STORE_ID).andReturn(false);
            mock.add.expect("www.google.com");
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
            const spy = jest.spyOn(recentlyAccessedDomains!, "add");
            mocks.incognitoWatcher.hasTab.expect(42).andReturn(false);
            mocks.domainUtils.getValidHostname.expect("http://www.google.com").andReturn("www.google.com");
            recentlyAccessedDomains!["onHeadersReceived"](quickHeadersReceivedDetails("http://www.google.com", 42));
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith("www.google.com");
        });
        it("should not call add() if incognito tab received a header", () => {
            createRAD(false);
            const spy = jest.spyOn(recentlyAccessedDomains!, "add");
            mocks.incognitoWatcher.hasTab.expect(42).andReturn(true);
            recentlyAccessedDomains!["onHeadersReceived"](quickHeadersReceivedDetails("http://www.google.com", 42));
            expect(spy).not.toHaveBeenCalled();
        });
        it("should not call add() if tab with incognito attribute received a header", () => {
            createRAD(false);
            const spy = jest.spyOn(recentlyAccessedDomains!, "add");
            recentlyAccessedDomains!["onHeadersReceived"]({
                ...quickHeadersReceivedDetails("http://www.google.com", 42),
                incognito: true,
            });
            expect(spy).not.toHaveBeenCalled();
        });
        it("should not call add() if a header was received on a negative tab id", () => {
            createRAD(false);
            const spy = jest.spyOn(recentlyAccessedDomains!, "add");
            recentlyAccessedDomains!["onHeadersReceived"](quickHeadersReceivedDetails("http://www.google.com", -1));
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe("add", () => {
        it("should not do anything if not enabled", () => {
            createRAD(false);
            recentlyAccessedDomains!["domains"] = ["a", "b", "c", "d", "e", "f"];
            recentlyAccessedDomains!.add("woop");
            expect(recentlyAccessedDomains!["domains"]).toEqual(["a", "b", "c", "d", "e", "f"]);
        });
        it("should not do anything if enabled, but domain is empty", () => {
            createRAD(true);
            recentlyAccessedDomains!["domains"] = ["a", "b", "c", "d", "e", "f"];
            recentlyAccessedDomains!.add("");
            expect(recentlyAccessedDomains!["domains"]).toEqual(["a", "b", "c", "d", "e", "f"]);
        });
        it("should not do anything if domain already at the top spot", () => {
            createRAD(true);
            recentlyAccessedDomains!["domains"] = ["a", "b", "c", "d", "e", "f"];
            recentlyAccessedDomains!.add("a");
            expect(recentlyAccessedDomains!["domains"]).toEqual(["a", "b", "c", "d", "e", "f"]);
        });
        it("should move existing domain to the top spot", () => {
            createRAD(true);
            recentlyAccessedDomains!["domains"] = ["a", "b", "c", "d"];
            recentlyAccessedDomains!.add("c");
            expect(recentlyAccessedDomains!["domains"]).toEqual(["c", "a", "b", "d"]);
        });
        it("should insert at the top spot and apply limits", () => {
            createRAD(true);
            recentlyAccessedDomains!["domains"] = ["a", "b", "c", "d", "e", "f"];
            recentlyAccessedDomains!.add("woop");
            expect(recentlyAccessedDomains!["domains"]).toEqual(["woop", "a", "b", "c", "d"]);
        });
    });
});
