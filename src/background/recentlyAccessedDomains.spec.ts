/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { RecentlyAccessedDomains } from "./recentlyAccessedDomains";
import { IncognitoWatcher } from "./incognitoWatcher";
import { messageUtil } from "../lib/messageUtil";
import {
    quickSetCookie,
    quickRemoveCookie,
    quickHeadersReceivedDetails,
    quickCookieDomainInfo,
    quickSettings,
    quickIncognito,
} from "../testUtils/quickHelpers";
import { CookieDomainInfo } from "../lib/shared";
import { DomainUtils } from "./domainUtils";

const COOKIE_STORE_ID = "mock";
const INCOGNITO_COOKIE_STORE_ID = "mock-incognito";

describe("Recently Accessed Domains", () => {
    const settings = quickSettings({
        version: "2.0.0",
        // fixme: mobile: true?
        mobile: false,
        // fixme: removeLocalStorageByHostname: false?
        removeLocalStorageByHostname: true,
    });
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let incognitoWatcher: IncognitoWatcher | null = null;
    const incognitoWatcherContext = { storeUtils: { defaultCookieStoreId: "mock" } } as any;
    const domainUtils = new DomainUtils();
    let context: any = null;

    beforeEach(async () => {
        incognitoWatcher = new IncognitoWatcher(incognitoWatcherContext);
        await incognitoWatcher.initializeExistingTabs();
        context = {
            domainUtils,
            incognitoWatcher,
            settings,
        };
    });
    afterEach(async () => {
        incognitoWatcher = null;
        recentlyAccessedDomains = null;
        await settings.restoreDefaults();
    });

    describe("listeners", () => {
        it("should add listeners on creation if logRAD.enabled = true", async () => {
            settings.set("logRAD.enabled", true);
            await settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            expect(browserMock.webRequest.onHeadersReceived.mock.addListener.mock.calls).toEqual([
                [
                    (recentlyAccessedDomains as any).onHeadersReceived,
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
            ]);
            expect(browserMock.cookies.onChanged.mock.addListener.mock.calls).toEqual([
                [(recentlyAccessedDomains as any).onCookieChanged],
            ]);
        });
        it("should neither add nor remove listeners on creation if logRAD.enabled = false", async () => {
            settings.set("logRAD.enabled", false);
            await settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            expect(browserMock.webRequest.onHeadersReceived.mock.addListener).not.toHaveBeenCalled();
            expect(browserMock.cookies.onChanged.mock.addListener).not.toHaveBeenCalled();
            expect(browserMock.webRequest.onHeadersReceived.mock.removeListener).not.toHaveBeenCalled();
            expect(browserMock.cookies.onChanged.mock.removeListener).not.toHaveBeenCalled();
        });
        it("should add listeners after setting logRAD.enabled = true", async () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            settings.set("logRAD.enabled", true);
            await settings.save();
            expect(browserMock.webRequest.onHeadersReceived.mock.addListener.mock.calls).toEqual([
                [
                    (recentlyAccessedDomains as any).onHeadersReceived,
                    { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
                ],
            ]);
            expect(browserMock.cookies.onChanged.mock.addListener.mock.calls).toEqual([
                [(recentlyAccessedDomains as any).onCookieChanged],
            ]);
        });
        it("should remove listeners after setting logRAD.enabled = false", async () => {
            settings.set("logRAD.enabled", true);
            await settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            settings.set("logRAD.enabled", false);
            await settings.save();
            expect(browserMock.webRequest.onHeadersReceived.mock.removeListener.mock.calls).toEqual([
                [(recentlyAccessedDomains as any).onHeadersReceived],
            ]);
            expect(browserMock.cookies.onChanged.mock.removeListener.mock.calls).toEqual([
                [(recentlyAccessedDomains as any).onCookieChanged],
            ]);
        });

        describe("onCookieChanged", () => {
            it("should call add() if non-incognito cookie was added", () => {
                quickIncognito(incognitoWatcher!, 1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(context);
                const spy = jest.spyOn(recentlyAccessedDomains, "add");
                quickSetCookie("google.com", "hello", "world", "", COOKIE_STORE_ID, "");
                quickSetCookie(".google.de", "hello", "world", "", COOKIE_STORE_ID, "");
                expect(spy).toHaveBeenCalledTimes(2);
                expect(spy).toHaveBeenCalledWith("google.com");
                expect(spy).toHaveBeenCalledWith("google.de");
            });
            it("should not call add() if non-incognito cookie was removed", () => {
                quickIncognito(incognitoWatcher!, 1, INCOGNITO_COOKIE_STORE_ID);
                quickSetCookie("google.com", "hello", "world", "", COOKIE_STORE_ID, "");
                recentlyAccessedDomains = new RecentlyAccessedDomains(context);
                const spy = jest.spyOn(recentlyAccessedDomains, "add");
                quickRemoveCookie("google.com", "hello", "", COOKIE_STORE_ID, "");
                expect(spy).not.toHaveBeenCalled();
            });
            it("should not call add() if incognito cookie was added or removed", () => {
                quickIncognito(incognitoWatcher!, 1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(context);
                const spy = jest.spyOn(recentlyAccessedDomains, "add");
                quickSetCookie("google.com", "hello", "world", "", INCOGNITO_COOKIE_STORE_ID, "");
                quickRemoveCookie("google.com", "hello", "", INCOGNITO_COOKIE_STORE_ID, "");
                expect(spy).not.toHaveBeenCalled();
            });
        });

        describe("onHeadersReceived", () => {
            it("should call add() if non-incognito tab received a header", () => {
                quickIncognito(incognitoWatcher!, 1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(context);
                const spy = jest.spyOn(recentlyAccessedDomains, "add");
                browserMock.webRequest.headersReceived(quickHeadersReceivedDetails("http://google.com", 2));
                expect(spy).toHaveBeenCalledTimes(1);
                expect(spy).toHaveBeenCalledWith("google.com");
            });
            it("should not call add() if incognito tab received a header", () => {
                quickIncognito(incognitoWatcher!, 1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(context);
                const spy = jest.spyOn(recentlyAccessedDomains, "add");
                browserMock.webRequest.headersReceived(quickHeadersReceivedDetails("http://google.com", 1));
                expect(spy).not.toHaveBeenCalled();
            });
            it("should not call add() if a header was received on a negative tab id", () => {
                quickIncognito(incognitoWatcher!, 1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(context);
                const spy = jest.spyOn(recentlyAccessedDomains, "add");
                browserMock.webRequest.headersReceived(quickHeadersReceivedDetails("http://google.com", -1));
                expect(spy).not.toHaveBeenCalled();
            });
        });
    });

    describe("add", () => {
        it("should detect settings on creation", async () => {
            settings.set("logRAD.enabled", false);
            settings.set("logRAD.limit", 42);
            await settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            expect(recentlyAccessedDomains.isEnabled()).toBe(false);
            expect(recentlyAccessedDomains.getLimit()).toBe(42);
        });
        it("should detect settings after creation", async () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            expect(recentlyAccessedDomains.isEnabled()).toBe(true);
            expect(recentlyAccessedDomains.getLimit()).not.toBe(42);
            settings.set("logRAD.enabled", false);
            settings.set("logRAD.limit", 42);
            await settings.save();
            expect(recentlyAccessedDomains!.isEnabled()).toBe(false);
            expect(recentlyAccessedDomains!.getLimit()).toBe(42);
        });
        it("should not do anything if logRAD.enabled === false", async () => {
            settings.set("logRAD.enabled", false);
            await settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            recentlyAccessedDomains.add("google.com");
            expect(recentlyAccessedDomains.get()).toHaveLength(0);
        });
        it("should not do anything if logRAD.limit === 0", async () => {
            settings.set("logRAD.limit", 0);
            await settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            recentlyAccessedDomains.add("google.com");
            expect(recentlyAccessedDomains.get()).toHaveLength(0);
        });
        it("should only add domains up to the limit and discard the oldest ones", async () => {
            settings.set("logRAD.limit", 3);
            await settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            expect(recentlyAccessedDomains.get()).toEqual([
                quickCookieDomainInfo("google.jp", "leave"),
                quickCookieDomainInfo("google.dk", "leave"),
                quickCookieDomainInfo("google.co.uk", "leave"),
            ]);
        });
        it("should drop all domains above the limit when the limit has been changed", async () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            expect(recentlyAccessedDomains.get()).toEqual([
                quickCookieDomainInfo("google.jp", "leave"),
                quickCookieDomainInfo("google.dk", "leave"),
                quickCookieDomainInfo("google.co.uk", "leave"),
                quickCookieDomainInfo("google.de", "leave"),
                quickCookieDomainInfo("google.com", "leave"),
            ]);
            settings.set("logRAD.limit", 3);
            await settings.save();
            expect(recentlyAccessedDomains.get()).toEqual([
                quickCookieDomainInfo("google.jp", "leave"),
                quickCookieDomainInfo("google.dk", "leave"),
                quickCookieDomainInfo("google.co.uk", "leave"),
            ]);
        });
        it("should fire an event 'onRecentlyAccessedDomains' with the domain infos when the event 'getRecentlyAccessedDomains' has been fired", () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            const expected = [
                quickCookieDomainInfo("google.jp", "leave"),
                quickCookieDomainInfo("google.dk", "leave"),
                quickCookieDomainInfo("google.co.uk", "leave"),
                quickCookieDomainInfo("google.de", "leave"),
                quickCookieDomainInfo("google.com", "leave"),
            ];
            expect(recentlyAccessedDomains.get()).toEqual(expected);

            const spy = jest.fn();
            messageUtil.receive("onRecentlyAccessedDomains", spy);
            messageUtil.send("getRecentlyAccessedDomains");
            expect(spy).toBeCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(expected, { id: "mock" });
        });
        it("should fire an event 'onRecentlyAccessedDomains' when logRAD.limit changed", async () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");

            const promise = new Promise((resolve) => {
                messageUtil.receive("onRecentlyAccessedDomains", (list: CookieDomainInfo[]) => {
                    expect(list).toEqual([
                        quickCookieDomainInfo("google.jp", "leave"),
                        quickCookieDomainInfo("google.dk", "leave"),
                        quickCookieDomainInfo("google.co.uk", "leave"),
                    ]);
                    resolve();
                });
            });
            settings.set("logRAD.limit", 3);
            await settings.save();
            await promise;
        });
        it("should fire an event 'onRecentlyAccessedDomains' when logRAD.enabled changed", async () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(context);
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");

            const promise = new Promise((resolve) => {
                messageUtil.receive("onRecentlyAccessedDomains", (list: CookieDomainInfo[]) => {
                    expect(list).toHaveLength(0);
                    resolve();
                });
            });
            settings.set("logRAD.enabled", false);
            await settings.save();
            await promise;
        });
    });
});
