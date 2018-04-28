/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { createSpy, ensureNotNull, browserMock } from "./browserMock";
import { destroyAndNull } from "../src/shared";
import { messageUtil, ReceiverHandle } from "../src/lib/messageUtil";
import { RecentlyAccessedDomains } from "../src/background/recentlyAccessedDomains";
import { settings } from "../src/lib/settings";

describe("Recently Accessed Domains", () => {
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let receiver: ReceiverHandle | null = null;
    beforeEach(() => browserMock.reset());
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
            assert.equal(recentlyAccessedDomains.getLimit(), 42);
        });
        it("should detect settings after creation", (done) => {
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            assert.isTrue(recentlyAccessedDomains.isEnabled());
            assert.notEqual(recentlyAccessedDomains.getLimit(), 42);
            settings.set("logRAD.enabled", false);
            settings.set("logRAD.limit", 42);
            settings.save();

            // settings take a frame to kick in
            setTimeout(() => {
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                assert.isFalse(recentlyAccessedDomains.isEnabled());
                assert.equal(recentlyAccessedDomains.getLimit(), 42);
                done();
            }, 10);
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
                { domain: "google.jp", badge: "badge_forget" },
                { domain: "google.dk", badge: "badge_forget" },
                { domain: "google.co.uk", badge: "badge_forget" }
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
                { domain: "google.jp", badge: "badge_forget" },
                { domain: "google.dk", badge: "badge_forget" },
                { domain: "google.co.uk", badge: "badge_forget" },
                { domain: "google.de", badge: "badge_forget" },
                { domain: "google.com", badge: "badge_forget" }
            ]);
            settings.set("logRAD.limit", 3);
            settings.save();
            // settings take a frame to kick in
            setTimeout(() => {
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "google.jp", badge: "badge_forget" },
                    { domain: "google.dk", badge: "badge_forget" },
                    { domain: "google.co.uk", badge: "badge_forget" }
                ]);
                done();
            }, 10);
        });
        it("should fire an event 'onRecentlyAccessedDomains' with the domain infos when the event 'getRecentlyAccessedDomains' has been fired", () => {
            recentlyAccessedDomains = new RecentlyAccessedDomains();
            recentlyAccessedDomains.add("google.com");
            recentlyAccessedDomains.add("google.de");
            recentlyAccessedDomains.add("google.co.uk");
            recentlyAccessedDomains.add("google.dk");
            recentlyAccessedDomains.add("google.jp");
            const expected = [
                { domain: "google.jp", badge: "badge_forget" },
                { domain: "google.dk", badge: "badge_forget" },
                { domain: "google.co.uk", badge: "badge_forget" },
                { domain: "google.de", badge: "badge_forget" },
                { domain: "google.com", badge: "badge_forget" }
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

            let isDone = false;
            receiver = messageUtil.receive("onRecentlyAccessedDomains", (list) => {
                // during tests, some events get send twice (once for send and once for sendSelf)
                if (!isDone) {
                    assert.deepEqual(list, [
                        { domain: "google.jp", badge: "badge_forget" },
                        { domain: "google.dk", badge: "badge_forget" },
                        { domain: "google.co.uk", badge: "badge_forget" }
                    ]);
                    done();
                    isDone = true;
                }
            });
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

            let isDone = false;
            receiver = messageUtil.receive("onRecentlyAccessedDomains", (list) => {
                // during tests, some events get send twice (once for send and once for sendSelf)
                if (!isDone) {
                    assert.deepEqual(list, []);
                    done();
                    isDone = true;
                }
            });
            settings.set("logRAD.enabled", false);
            settings.save();
        });
    });
});
