/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { browserMock } from "./browserMock";
import { ensureNotNull, createSpy, doneHandler, spyOn } from "./testHelpers";
import { CookieDomainInfo } from "../src/shared";
import { messageUtil } from "../src/lib/messageUtil";
import { RecentlyAccessedDomains } from "../src/background/recentlyAccessedDomains";
import { settings } from "../src/lib/settings";
import { IncognitoWatcher } from "../src/background/incognitoWatcher";
import { quickSetCookie, quickCookieDomainInfo, quickRemoveCookie, quickHeadersReceivedDetails } from "./quickHelpers";

const COOKIE_STORE_ID = "mock";
const INCOGNITO_COOKIE_STORE_ID = "mock-incognito";

describe("Recently Accessed Domains", () => {
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let incognitoWatcher: IncognitoWatcher | null = null;

    beforeEach(() => {
        messageUtil.clearCallbacksMap();
        browserMock.reset();
        incognitoWatcher = new IncognitoWatcher();
    });
    afterEach(() => {
        incognitoWatcher = null;
        recentlyAccessedDomains = null;
        settings.restoreDefaults();
    });

    describe("listeners", () => {
        it("should add listeners on creation if logRAD.enabled = true", () => {
            settings.set("logRAD.enabled", true);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            browserMock.webRequest.onHeadersReceived.mock.addListener.assertCalls([
                [(recentlyAccessedDomains as any).onHeadersReceived, { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] }]
            ]);
            browserMock.cookies.onChanged.mock.addListener.assertCalls([[(recentlyAccessedDomains as any).onCookieChanged]]);
        });
        it("should neither add nor remove listeners on creation if logRAD.enabled = false", () => {
            settings.set("logRAD.enabled", false);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            browserMock.webRequest.onHeadersReceived.mock.addListener.assertNoCall();
            browserMock.cookies.onChanged.mock.addListener.assertNoCall();
            browserMock.webRequest.onHeadersReceived.mock.removeListener.assertNoCall();
            browserMock.cookies.onChanged.mock.removeListener.assertNoCall();
        });
        it("should add listeners after setting logRAD.enabled = true", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            settings.set("logRAD.enabled", true);
            settings.save().then(doneHandler(() => {
                browserMock.webRequest.onHeadersReceived.mock.addListener.assertCalls([
                    [(recentlyAccessedDomains as any).onHeadersReceived, { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] }]
                ]);
                browserMock.cookies.onChanged.mock.addListener.assertCalls([[(recentlyAccessedDomains as any).onCookieChanged]]);
            }, done));
        });
        it("should remove listeners after setting logRAD.enabled = false", (done) => {
            settings.set("logRAD.enabled", true);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            settings.set("logRAD.enabled", false);
            settings.save().then(doneHandler(() => {
                browserMock.webRequest.onHeadersReceived.mock.removeListener.assertCalls([[(recentlyAccessedDomains as any).onHeadersReceived]]);
                browserMock.cookies.onChanged.mock.removeListener.assertCalls([[(recentlyAccessedDomains as any).onCookieChanged]]);
            }, done));
        });

        describe("onCookieChanged", () => {
            it("should call add() if non-incognito cookie was added", () => {
                ensureNotNull(incognitoWatcher).forceAdd(1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
                const spy = spyOn(recentlyAccessedDomains, "add");
                quickSetCookie("google.com", "hello", "world", "", COOKIE_STORE_ID, "");
                quickSetCookie(".google.de", "hello", "world", "", COOKIE_STORE_ID, "");
                spy.assertCalls([["google.com"], ["google.de"]]);
            });
            it("should not call add() if non-incognito cookie was removed", () => {
                ensureNotNull(incognitoWatcher).forceAdd(1, INCOGNITO_COOKIE_STORE_ID);
                quickSetCookie("google.com", "hello", "world", "", COOKIE_STORE_ID, "");
                recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
                const spy = spyOn(recentlyAccessedDomains, "add");
                quickRemoveCookie("google.com", "hello", "", COOKIE_STORE_ID, "");
                spy.assertNoCall();
            });
            it("should not call add() if incognito cookie was added or removed", () => {
                ensureNotNull(incognitoWatcher).forceAdd(1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
                const spy = spyOn(recentlyAccessedDomains, "add");
                quickSetCookie("google.com", "hello", "world", "", INCOGNITO_COOKIE_STORE_ID, "");
                quickRemoveCookie("google.com", "hello", "", INCOGNITO_COOKIE_STORE_ID, "");
                spy.assertNoCall();
            });
        });

        describe("onHeadersReceived", () => {
            it("should call add() if non-incognito tab received a header", () => {
                ensureNotNull(incognitoWatcher).forceAdd(1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
                const spy = spyOn(recentlyAccessedDomains, "add");
                browserMock.webRequest.headersReceived(quickHeadersReceivedDetails("http://google.com", 2));
                spy.assertCalls([["google.com"]]);
            });
            it("should not call add() if incognito tab received a header", () => {
                ensureNotNull(incognitoWatcher).forceAdd(1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
                const spy = spyOn(recentlyAccessedDomains, "add");
                browserMock.webRequest.headersReceived(quickHeadersReceivedDetails("http://google.com", 1));
                spy.assertNoCall();
            });
            it("should not call add() if a header was received on a negative tab id", () => {
                ensureNotNull(incognitoWatcher).forceAdd(1, INCOGNITO_COOKIE_STORE_ID);
                recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
                const spy = spyOn(recentlyAccessedDomains, "add");
                browserMock.webRequest.headersReceived(quickHeadersReceivedDetails("http://google.com", -1));
                spy.assertNoCall();
            });
        });
    });

    describe("add", () => {
        it("should detect settings on creation", () => {
            settings.set("logRAD.enabled", false);
            settings.set("logRAD.limit", 42);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            assert.isFalse(recentlyAccessedDomains.isEnabled());
            assert.strictEqual(recentlyAccessedDomains.getLimit(), 42);
        });
        it("should detect settings after creation", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            assert.isTrue(recentlyAccessedDomains.isEnabled());
            assert.notEqual(recentlyAccessedDomains.getLimit(), 42);
            settings.set("logRAD.enabled", false);
            settings.set("logRAD.limit", 42);
            settings.save().then(doneHandler(() => {
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                assert.isFalse(recentlyAccessedDomains.isEnabled());
                assert.strictEqual(recentlyAccessedDomains.getLimit(), 42);
            }, done));
        });
        it("should not do anything if logRAD.enabled === false", () => {
            settings.set("logRAD.enabled", false);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            recentlyAccessedDomains.add("google.com");
            assert.deepEqual(recentlyAccessedDomains.get(), []);
        });
        it("should not do anything if logRAD.limit === 0", () => {
            settings.set("logRAD.limit", 0);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            recentlyAccessedDomains.add("google.com");
            assert.deepEqual(recentlyAccessedDomains.get(), []);
        });
        it("should only add domains up to the limit and discard the oldest ones", () => {
            settings.set("logRAD.limit", 3);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            assert.deepEqual(recentlyAccessedDomains.get(), [
                quickCookieDomainInfo("google.jp", "leave"),
                quickCookieDomainInfo("google.dk", "leave"),
                quickCookieDomainInfo("google.co.uk", "leave")
            ]);
        });
        it("should drop all domains above the limit when the limit has been changed", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            assert.deepEqual(recentlyAccessedDomains.get(), [
                quickCookieDomainInfo("google.jp", "leave"),
                quickCookieDomainInfo("google.dk", "leave"),
                quickCookieDomainInfo("google.co.uk", "leave"),
                quickCookieDomainInfo("google.de", "leave"),
                quickCookieDomainInfo("google.com", "leave")
            ]);
            settings.set("logRAD.limit", 3);
            settings.save().then(doneHandler(() => {
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                assert.deepEqual(recentlyAccessedDomains.get(), [
                    quickCookieDomainInfo("google.jp", "leave"),
                    quickCookieDomainInfo("google.dk", "leave"),
                    quickCookieDomainInfo("google.co.uk", "leave")
                ]);
            }, done));
        });
        it("should fire an event 'onRecentlyAccessedDomains' with the domain infos when the event 'getRecentlyAccessedDomains' has been fired", () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
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
                quickCookieDomainInfo("google.com", "leave")
            ];
            assert.deepEqual(recentlyAccessedDomains.get(), expected);

            const spy = createSpy();
            messageUtil.receive("onRecentlyAccessedDomains", spy);
            messageUtil.send("getRecentlyAccessedDomains");
            spy.assertCalls([[expected, { id: "mock" }]]);
        });
        it("should fire an event 'onRecentlyAccessedDomains' when logRAD.limit changed", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");

            let isDone = 0;
            messageUtil.receive("onRecentlyAccessedDomains", doneHandler((list: CookieDomainInfo[]) => {
                assert.deepEqual(list, [
                    quickCookieDomainInfo("google.jp", "leave"),
                    quickCookieDomainInfo("google.dk", "leave"),
                    quickCookieDomainInfo("google.co.uk", "leave")
                ]);
            }, done, () => (++isDone) === 1));
            settings.set("logRAD.limit", 3);
            settings.save();
        });
        it("should fire an event 'onRecentlyAccessedDomains' when logRAD.enabled changed", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains(ensureNotNull(incognitoWatcher));
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");

            let isDone = 0;
            messageUtil.receive("onRecentlyAccessedDomains", doneHandler((list: CookieDomainInfo[]) => {
                assert.deepEqual(list, []);
            }, done, () => (++isDone) === 1));
            settings.set("logRAD.enabled", false);
            settings.save();
        });
    });
});
