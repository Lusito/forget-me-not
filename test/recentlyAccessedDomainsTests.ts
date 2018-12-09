/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { browserMock } from "./browserMock";
import { ensureNotNull, createSpy, doneHandler, createCookieDomainInfo } from "./testHelpers";
import { destroyAndNull, CookieDomainInfo } from "../src/shared";
import { messageUtil, ReceiverHandle } from "../src/lib/messageUtil";
import { RecentlyAccessedDomains } from "../src/background/recentlyAccessedDomains";
import { settings } from "../src/lib/settings";

describe("Recently Accessed Domains", () => {
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let receiver: ReceiverHandle | null = null;
    beforeEach(() => {
        messageUtil.clearCallbacksMap();
        browserMock.reset();
    });
    afterEach(() => {
        recentlyAccessedDomains = destroyAndNull(recentlyAccessedDomains);
        receiver = destroyAndNull(receiver);
        settings.restoreDefaults();
    });

    describe("add", () => {
        it("should detect settings on creation", () => {
            settings.set("logRAD.enabled", false);
            settings.set("logRAD.limit", 42);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            assert.isFalse(recentlyAccessedDomains.isEnabled());
            assert.strictEqual(recentlyAccessedDomains.getLimit(), 42);
        });
        it("should detect settings after creation", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains();
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
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            assert.deepEqual(recentlyAccessedDomains.get(), []);
        });
        it("should not do anything if logRAD.limit === 0", () => {
            settings.set("logRAD.limit", 0);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            assert.deepEqual(recentlyAccessedDomains.get(), []);
        });
        it("should only add domains up to the limit and discard the oldest ones", () => {
            settings.set("logRAD.limit", 3);
            settings.save();
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            assert.deepEqual(recentlyAccessedDomains.get(), [
                createCookieDomainInfo("google.jp", "leave"),
                createCookieDomainInfo("google.dk", "leave"),
                createCookieDomainInfo("google.co.uk", "leave")
            ]);
        });
        it("should drop all domains above the limit when the limit has been changed", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            assert.deepEqual(recentlyAccessedDomains.get(), [
                createCookieDomainInfo("google.jp", "leave"),
                createCookieDomainInfo("google.dk", "leave"),
                createCookieDomainInfo("google.co.uk", "leave"),
                createCookieDomainInfo("google.de", "leave"),
                createCookieDomainInfo("google.com", "leave")
            ]);
            settings.set("logRAD.limit", 3);
            settings.save().then(doneHandler(() => {
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                assert.deepEqual(recentlyAccessedDomains.get(), [
                    createCookieDomainInfo("google.jp", "leave"),
                    createCookieDomainInfo("google.dk", "leave"),
                    createCookieDomainInfo("google.co.uk", "leave")
                ]);
            }, done));
        });
        it("should fire an event 'onRecentlyAccessedDomains' with the domain infos when the event 'getRecentlyAccessedDomains' has been fired", () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            const expected = [
                createCookieDomainInfo("google.jp", "leave"),
                createCookieDomainInfo("google.dk", "leave"),
                createCookieDomainInfo("google.co.uk", "leave"),
                createCookieDomainInfo("google.de", "leave"),
                createCookieDomainInfo("google.com", "leave")
            ];
            assert.deepEqual(recentlyAccessedDomains.get(), expected);

            const spy = createSpy();
            receiver = messageUtil.receive("onRecentlyAccessedDomains", spy);
            messageUtil.send("getRecentlyAccessedDomains");
            spy.assertCalls([[expected, { id: "mock" }]]);
        });
        it("should fire an event 'onRecentlyAccessedDomains' when logRAD.limit changed", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");

            let isDone = 0;
            receiver = messageUtil.receive("onRecentlyAccessedDomains", doneHandler((list: CookieDomainInfo[]) => {
                assert.deepEqual(list, [
                    createCookieDomainInfo("google.jp", "leave"),
                    createCookieDomainInfo("google.dk", "leave"),
                    createCookieDomainInfo("google.co.uk", "leave")
                ]);
            }, done, () => (++isDone) === 1));
            settings.set("logRAD.limit", 3);
            settings.save();
        });
        it("should fire an event 'onRecentlyAccessedDomains' when logRAD.enabled changed", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");

            let isDone = 0;
            receiver = messageUtil.receive("onRecentlyAccessedDomains", doneHandler((list: CookieDomainInfo[]) => {
                assert.deepEqual(list, []);
            }, done, () => (++isDone) === 1));
            settings.set("logRAD.enabled", false);
            settings.save();
        });
    });
});
