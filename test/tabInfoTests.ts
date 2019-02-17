/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { TabInfo } from "../src/background/tabInfo";
import { createSpy, doneHandler } from "./testHelpers";
import { browserMock } from "./browserMock";

describe("TabInfo", () => {
    const checkDomainLeaveSpy = createSpy();

    beforeEach(() => checkDomainLeaveSpy.reset());
    afterEach(() => checkDomainLeaveSpy.assertNoCall());

    const createTabInfo = () => new TabInfo(42, "first.amazon.com", "mock", checkDomainLeaveSpy);

    describe("constructor", () => {
        it("should initialize with the parameters", () => {
            const tabInfo = createTabInfo();
            assert.equal((tabInfo as any).tabId, 42);
            assert.sameMembers(Object.getOwnPropertyNames((tabInfo as any).frameInfos), ["0"]);
            assert.isTrue(tabInfo.contains("first.amazon.com", false));
            assert.isTrue(tabInfo.contains("first.amazon.com", true));
            assert.isFalse(tabInfo.contains("amazon.com", false));
            assert.isFalse(tabInfo.contains("amazon.com", true));
        });
    });

    describe("prepareNavigation", () => {
        it("should return previous next hostname on change", () => {
            const tabInfo = createTabInfo();
            assert.equal(tabInfo.prepareNavigation(0, "amazon.com"), "");
            assert.equal(tabInfo.prepareNavigation(0, "amazon.com"), "");
            assert.equal(tabInfo.prepareNavigation(0, "second.amazon.com"), "amazon.com");
        });
    });

    describe("commitNavigation", () => {
        context("with frameId = 0", () => {
            it("should return a collection of all hostnames before the change and then remove non-0 tabinfos", () => {
                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(2, "second.amazon.com");
                tabInfo.prepareNavigation(2, "p.second.amazon.com");
                tabInfo.commitNavigation(3, "third.amazon.com");
                const hostnames = tabInfo.commitNavigation(0, "zero.amazon.com");
                assert.sameMembers(Array.from(hostnames), [
                    "first.amazon.com",
                    "second.amazon.com",
                    "p.second.amazon.com",
                    "third.amazon.com"
                ]);
                assert.isFalse(tabInfo.contains("first.amazon.com", true));
                assert.isFalse(tabInfo.contains("second.amazon.com", true));
                assert.isFalse(tabInfo.contains("p.second.amazon.com", true));
                assert.isFalse(tabInfo.contains("third.amazon.com", true));
                assert.isTrue(tabInfo.contains("zero.amazon.com", true));
            });
        });

        context("with frameId = 2", () => {
            it("should return a collection of hostnames in frame 2 before the change", () => {
                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(2, "second.amazon.com");
                tabInfo.prepareNavigation(2, "p.second.amazon.com");
                tabInfo.commitNavigation(3, "third.amazon.com");
                const hostnames = tabInfo.commitNavigation(2, "zero.amazon.com");
                assert.sameMembers(Array.from(hostnames), [
                    "second.amazon.com",
                    "p.second.amazon.com"
                ]);
                assert.isTrue(tabInfo.contains("first.amazon.com", true));
                assert.isFalse(tabInfo.contains("second.amazon.com", true));
                assert.isFalse(tabInfo.contains("p.second.amazon.com", true));
                assert.isTrue(tabInfo.contains("third.amazon.com", true));
                assert.isTrue(tabInfo.contains("zero.amazon.com", true));
            });
        });
    });

    describe("contains", () => {
        it("should return true during navigation only if checkNext = true", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(0, "second.amazon.com");
            assert.isTrue(tabInfo.contains("first.amazon.com", true));
            assert.isTrue(tabInfo.contains("first.amazon.com", true));
            assert.isFalse(tabInfo.contains("second.amazon.com", false));
            assert.isTrue(tabInfo.contains("second.amazon.com", true));
        });
        it("should return true on another frame during navigation only if checkNext = true", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(42, "second.amazon.com");
            assert.isTrue(tabInfo.contains("first.amazon.com", true));
            assert.isTrue(tabInfo.contains("first.amazon.com", true));
            assert.isFalse(tabInfo.contains("second.amazon.com", false));
            assert.isTrue(tabInfo.contains("second.amazon.com", true));
            tabInfo.commitNavigation(42, "second.amazon.com");
            assert.isTrue(tabInfo.contains("first.amazon.com", true));
            assert.isTrue(tabInfo.contains("first.amazon.com", true));
            assert.isTrue(tabInfo.contains("second.amazon.com", true));
            assert.isTrue(tabInfo.contains("second.amazon.com", true));
        });
    });

    describe("matchHostnameFP", () => {
        it("should return true only for first party domains on frame 0", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(0, "x.amazon.x");
            tabInfo.prepareNavigation(1, "a.amazon.a");
            tabInfo.commitNavigation(2, "b.amazon.b");
            tabInfo.commitNavigation(3, "c.amazon.c");
            assert.isFalse(tabInfo.matchHostnameFP("first.amazon.com"));
            assert.isFalse(tabInfo.matchHostnameFP("x.amazon.x"));
            assert.isFalse(tabInfo.matchHostnameFP("a.amazon.a"));
            assert.isFalse(tabInfo.matchHostnameFP("b.amazon.b"));
            assert.isFalse(tabInfo.matchHostnameFP("c.amazon.c"));
            assert.isTrue(tabInfo.matchHostnameFP("amazon.com"));
            assert.isTrue(tabInfo.matchHostnameFP("amazon.x"));
            assert.isFalse(tabInfo.matchHostnameFP("amazon.a"));
            assert.isFalse(tabInfo.matchHostnameFP("amazon.b"));
            assert.isFalse(tabInfo.matchHostnameFP("amazon.c"));
        });
    });

    describe("containsHostnameFP", () => {
        it("should return true if at least one frame matches first party", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(0, "x.amazon.x");
            tabInfo.prepareNavigation(1, "a.amazon.a");
            tabInfo.commitNavigation(2, "b.amazon.b");
            tabInfo.commitNavigation(3, "c.amazon.c");
            assert.isFalse(tabInfo.containsHostnameFP("first.amazon.com"));
            assert.isFalse(tabInfo.containsHostnameFP("x.amazon.x"));
            assert.isFalse(tabInfo.containsHostnameFP("a.amazon.a"));
            assert.isFalse(tabInfo.containsHostnameFP("b.amazon.b"));
            assert.isFalse(tabInfo.containsHostnameFP("c.amazon.c"));
            assert.isTrue(tabInfo.containsHostnameFP("amazon.com"));
            assert.isTrue(tabInfo.containsHostnameFP("amazon.x"));
            assert.isTrue(tabInfo.containsHostnameFP("amazon.a"));
            assert.isTrue(tabInfo.containsHostnameFP("amazon.b"));
            assert.isTrue(tabInfo.containsHostnameFP("amazon.c"));
        });
    });

    describe("scheduleDeadFramesCheck", () => {
        it("should run instantly if never run before", () => {
            const tabInfo = createTabInfo();
            const spy = createSpy();
            (tabInfo as any).checkDeadFrames = spy;
            tabInfo.scheduleDeadFramesCheck();
            spy.assertCalls([[]]); // called once with no params
        });
        // tslint:disable-next-line:only-arrow-functions
        it("should run delayed by 1s if just run", function(done) {
            this.slow(2500);
            const tabInfo = createTabInfo();
            const spy = createSpy();
            (tabInfo as any).checkDeadFrames = spy;
            (tabInfo as any).lastDeadFrameCheck = Date.now();
            tabInfo.scheduleDeadFramesCheck();
            spy.assertNoCall();
            let count = 0;
            setTimeout(doneHandler(() => {
                assert.equal(count++, 0);
                spy.assertNoCall();
            }, done, () => false), 900);
            setTimeout(doneHandler(() => {
                assert.equal(count++, 1);
                spy.assertCalls([[]]); // called once with no params
            }, done, () => true), 1010);
        });
        it("should run delayed by 0.3s run 0.7s ago", function(done) {
            this.slow(2500);
            const tabInfo = createTabInfo();
            const spy = createSpy();
            (tabInfo as any).checkDeadFrames = spy;
            (tabInfo as any).lastDeadFrameCheck = Date.now() - 700;
            tabInfo.scheduleDeadFramesCheck();
            spy.assertNoCall();
            let count = 0;
            setTimeout(doneHandler(() => {
                assert.equal(count++, 0);
                spy.assertNoCall();
            }, done, () => false), 250);
            setTimeout(doneHandler(() => {
                assert.equal(count++, 1);
                spy.assertCalls([[]]); // called once with no params
            }, done, () => true), 310);
        });
        it("should run only once if scheduled twice", function(done) {
            this.slow(2500);
            const tabInfo = createTabInfo();
            const spy = createSpy();
            (tabInfo as any).checkDeadFrames = spy;
            (tabInfo as any).lastDeadFrameCheck = Date.now();
            tabInfo.scheduleDeadFramesCheck();
            tabInfo.scheduleDeadFramesCheck();
            spy.assertNoCall();
            let count = 0;
            setTimeout(doneHandler(() => {
                assert.equal(count++, 0);
                spy.assertNoCall();
            }, done, () => false), 900);
            setTimeout(doneHandler(() => {
                assert.equal(count++, 1);
                spy.assertCalls([[]]); // called once with no params
            }, done, () => true), 1010);
        });
        it("should not reschedule itself if all frames are idle", (done) => {
            const tabInfo = createTabInfo();
            tabInfo.commitNavigation(1, "amazon.com");

            // ensure all tabinfos are in idle
            const frameInfos = (tabInfo as any).frameInfos;
            for (const key in frameInfos)
                frameInfos[key].lastTimeStamp = 0;

            const originalScheduleDeadFramesCheck = tabInfo.scheduleDeadFramesCheck.bind(tabInfo);
            const spy = createSpy();
            tabInfo.scheduleDeadFramesCheck = spy;
            originalScheduleDeadFramesCheck();
            setTimeout(doneHandler(() => {
                checkDomainLeaveSpy.assertCalls([["mock", new Set(["amazon.com"])]]);
                browserMock.tabs.executeScript.assertCalls([[42, { frameId: 1, code: "1" }]]);
                spy.assertNoCall();
            }, done), 10);
        });
        it("should reschedule itself if not all frames are idle", (done) => {
            const tabInfo = createTabInfo();
            // ensure main frame is in idle
            (tabInfo as any).frameInfos["0"].lastTimeStamp = 0;
            tabInfo.prepareNavigation(1, "amazon.com");
            const originalScheduleDeadFramesCheck = tabInfo.scheduleDeadFramesCheck.bind(tabInfo);
            const spy = createSpy();
            tabInfo.scheduleDeadFramesCheck = spy;
            originalScheduleDeadFramesCheck();
            setTimeout(doneHandler(() => {
                browserMock.tabs.executeScript.assertNoCall();
                spy.assertCalls([[]]);
            }, done), 10);
        });
        context("with executeScript returning no success", () => {
            it("should collect hostnames and call checkDomainLeave", (done) => {
                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(1, "amazon.com");
                tabInfo.commitNavigation(2, "images.google.com");

                // ensure all tabinfos are in idle
                const frameInfos = (tabInfo as any).frameInfos;
                for (const key in frameInfos)
                    frameInfos[key].lastTimeStamp = 0;

                tabInfo.scheduleDeadFramesCheck();
                setTimeout(doneHandler(() => {
                    checkDomainLeaveSpy.assertCalls([["mock", new Set(["amazon.com", "images.google.com"])]]);
                    browserMock.tabs.executeScript.assertCalls([
                        [42, { frameId: 1, code: "1" }],
                        [42, { frameId: 2, code: "1" }]
                    ]);
                }, done), 10);
            });
        });
        context("with executeScript returning success", () => {
            it("should not collect hostnames and not call checkDomainLeave", (done) => {
                browserMock.tabs.executeScriptSuccess = true;
                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(1, "amazon.com");
                tabInfo.commitNavigation(2, "images.google.com");

                // ensure all tabinfos are in idle
                const frameInfos = (tabInfo as any).frameInfos;
                for (const key in frameInfos)
                    frameInfos[key].lastTimeStamp = 0;

                tabInfo.scheduleDeadFramesCheck();
                setTimeout(doneHandler(() => {
                    checkDomainLeaveSpy.assertNoCall();
                    browserMock.tabs.executeScript.assertCalls([
                        [42, { frameId: 1, code: "1" }],
                        [42, { frameId: 2, code: "1" }]
                    ]);
                }, done), 10);
            });
        });
    });
});
