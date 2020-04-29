import { advanceTime, mockAssimilate } from "mockzilla";

import { TabInfo, MIN_DEAD_FRAME_CHECK_INTERVAL } from "./tabInfo";

describe("TabInfo", () => {
    const checkDomainLeaveSpy = jest.fn();

    beforeEach(() => checkDomainLeaveSpy.mockClear());
    // eslint-disable-next-line jest/no-standalone-expect
    afterEach(() => expect(checkDomainLeaveSpy).not.toHaveBeenCalled());

    const createTabInfo = () => new TabInfo(42, "first.amazon.com", "mock", checkDomainLeaveSpy);

    describe("constructor", () => {
        it("should initialize with the parameters", () => {
            const tabInfo = createTabInfo();
            expect((tabInfo as any).tabId).toBe(42);
            expect(Object.keys((tabInfo as any).frameInfos)).toHaveSameMembers(["0"]);
            expect(tabInfo.contains("first.amazon.com", false)).toBe(true);
            expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("amazon.com", false)).toBe(false);
            expect(tabInfo.contains("amazon.com", true)).toBe(false);
        });
    });

    describe("prepareNavigation", () => {
        it("should return previous next hostname on change", () => {
            const tabInfo = createTabInfo();
            expect(tabInfo.prepareNavigation(0, "amazon.com")).toBe("");
            expect(tabInfo.prepareNavigation(0, "amazon.com")).toBe("");
            expect(tabInfo.prepareNavigation(0, "second.amazon.com")).toBe("amazon.com");
        });
    });

    describe("commitNavigation", () => {
        describe("with frameId = 0", () => {
            it("should return a collection of all hostnames before the change and then remove non-0 tabinfos", () => {
                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(2, "second.amazon.com");
                tabInfo.prepareNavigation(2, "p.second.amazon.com");
                tabInfo.commitNavigation(3, "third.amazon.com");
                const hostnames = tabInfo.commitNavigation(0, "zero.amazon.com");
                expect(Array.from(hostnames)).toHaveSameMembers([
                    "first.amazon.com",
                    "second.amazon.com",
                    "p.second.amazon.com",
                    "third.amazon.com",
                ]);
                expect(tabInfo.contains("first.amazon.com", true)).toBe(false);
                expect(tabInfo.contains("second.amazon.com", true)).toBe(false);
                expect(tabInfo.contains("p.second.amazon.com", true)).toBe(false);
                expect(tabInfo.contains("third.amazon.com", true)).toBe(false);
                expect(tabInfo.contains("zero.amazon.com", true)).toBe(true);
            });
        });

        describe("with frameId = 2", () => {
            it("should return a collection of hostnames in frame 2 before the change", () => {
                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(2, "second.amazon.com");
                tabInfo.prepareNavigation(2, "p.second.amazon.com");
                tabInfo.commitNavigation(3, "third.amazon.com");
                const hostnames = tabInfo.commitNavigation(2, "zero.amazon.com");
                expect(Array.from(hostnames)).toHaveSameMembers(["second.amazon.com", "p.second.amazon.com"]);
                expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
                expect(tabInfo.contains("second.amazon.com", true)).toBe(false);
                expect(tabInfo.contains("p.second.amazon.com", true)).toBe(false);
                expect(tabInfo.contains("third.amazon.com", true)).toBe(true);
                expect(tabInfo.contains("zero.amazon.com", true)).toBe(true);
            });
        });
    });

    describe("contains", () => {
        it("should return true during navigation only if checkNext = true", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(0, "second.amazon.com");
            expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("second.amazon.com", false)).toBe(false);
            expect(tabInfo.contains("second.amazon.com", true)).toBe(true);
        });
        it("should return true on another frame during navigation only if checkNext = true", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(42, "second.amazon.com");
            expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("second.amazon.com", false)).toBe(false);
            expect(tabInfo.contains("second.amazon.com", true)).toBe(true);
            tabInfo.commitNavigation(42, "second.amazon.com");
            expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("first.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("second.amazon.com", true)).toBe(true);
            expect(tabInfo.contains("second.amazon.com", true)).toBe(true);
        });
    });

    // fixme: containsRuleFP

    describe("matchHostnameFP", () => {
        it("should return true only for first party domains on frame 0", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(0, "x.amazon.x");
            tabInfo.prepareNavigation(1, "a.amazon.a");
            tabInfo.commitNavigation(2, "b.amazon.b");
            tabInfo.commitNavigation(3, "c.amazon.c");
            expect(tabInfo.matchHostnameFP("first.amazon.com")).toBe(false);
            expect(tabInfo.matchHostnameFP("x.amazon.x")).toBe(false);
            expect(tabInfo.matchHostnameFP("a.amazon.a")).toBe(false);
            expect(tabInfo.matchHostnameFP("b.amazon.b")).toBe(false);
            expect(tabInfo.matchHostnameFP("c.amazon.c")).toBe(false);
            expect(tabInfo.matchHostnameFP("amazon.com")).toBe(true);
            expect(tabInfo.matchHostnameFP("amazon.x")).toBe(true);
            expect(tabInfo.matchHostnameFP("amazon.a")).toBe(false);
            expect(tabInfo.matchHostnameFP("amazon.b")).toBe(false);
            expect(tabInfo.matchHostnameFP("amazon.c")).toBe(false);
        });
    });

    describe("containsHostnameFP", () => {
        it("should return true if at least one frame matches first party", () => {
            const tabInfo = createTabInfo();
            tabInfo.prepareNavigation(0, "x.amazon.x");
            tabInfo.prepareNavigation(1, "a.amazon.a");
            tabInfo.commitNavigation(2, "b.amazon.b");
            tabInfo.commitNavigation(3, "c.amazon.c");
            expect(tabInfo.containsHostnameFP("first.amazon.com")).toBe(false);
            expect(tabInfo.containsHostnameFP("x.amazon.x")).toBe(false);
            expect(tabInfo.containsHostnameFP("a.amazon.a")).toBe(false);
            expect(tabInfo.containsHostnameFP("b.amazon.b")).toBe(false);
            expect(tabInfo.containsHostnameFP("c.amazon.c")).toBe(false);
            expect(tabInfo.containsHostnameFP("amazon.com")).toBe(true);
            expect(tabInfo.containsHostnameFP("amazon.x")).toBe(true);
            expect(tabInfo.containsHostnameFP("amazon.a")).toBe(true);
            expect(tabInfo.containsHostnameFP("amazon.b")).toBe(true);
            expect(tabInfo.containsHostnameFP("amazon.c")).toBe(true);
        });
    });

    describe("scheduleDeadFramesCheck", () => {
        it("should run instantly if never run before", async () => {
            const tabInfo = createTabInfo();
            const mock = mockAssimilate(tabInfo, "tabInfo", {
                mock: ["checkDeadFrames"],
                whitelist: ["scheduleDeadFramesCheck", "scheduledDeadFrameCheck", "lastDeadFrameCheck"],
            });
            mock.checkDeadFrames.expect().andResolve();
            await tabInfo.scheduleDeadFramesCheck();
        });
        // tslint:disable-next-line:only-arrow-functions
        it("should run delayed by 1s if just run", async () => {
            const tabInfo = createTabInfo();
            const mock = mockAssimilate(tabInfo, "tabInfo", {
                mock: ["checkDeadFrames"],
            });
            tabInfo["lastDeadFrameCheck"] = Date.now();
            await tabInfo.scheduleDeadFramesCheck();
            advanceTime(MIN_DEAD_FRAME_CHECK_INTERVAL - 1);
            mock.checkDeadFrames.expect();
            advanceTime(1);
        });
        it("should run delayed by 0.3s run 0.7s ago", async () => {
            const tabInfo = createTabInfo();
            const mock = mockAssimilate(tabInfo, "tabInfo", {
                mock: ["checkDeadFrames"],
            });
            tabInfo["lastDeadFrameCheck"] = Date.now() - 700;
            await tabInfo.scheduleDeadFramesCheck();
            advanceTime(299);
            mock.checkDeadFrames.expect();
            advanceTime(1);
        });
        it("should run only once if scheduled twice", async () => {
            const tabInfo = createTabInfo();
            const mock = mockAssimilate(tabInfo, "tabInfo", {
                mock: ["checkDeadFrames"],
            });
            tabInfo["lastDeadFrameCheck"] = Date.now();
            await tabInfo.scheduleDeadFramesCheck();
            await tabInfo.scheduleDeadFramesCheck();
            advanceTime(MIN_DEAD_FRAME_CHECK_INTERVAL - 1);
            mock.checkDeadFrames.expect();
            advanceTime(1);
        });
        it("should not reschedule itself if all frames are idle", async () => {
            const tabInfo = createTabInfo();
            tabInfo.commitNavigation(1, "amazon.com");

            // @ts-ignore
            mockBrowser.tabs.executeScript.expect(42, { frameId: 1, code: "1" }).andResolve([]);

            // ensure all tabinfos are in idle
            const { frameInfos } = tabInfo as any;
            for (const key of Object.keys(frameInfos)) frameInfos[key].lastTimeStamp = 0;

            const spy = jest.spyOn(tabInfo, "scheduleDeadFramesCheck");
            await tabInfo["checkDeadFrames"]();
            expect(checkDomainLeaveSpy).not.toHaveBeenCalled();
            expect(spy).not.toHaveBeenCalled();
        });
        it("should reschedule itself if not all frames are idle", async () => {
            const tabInfo = createTabInfo();
            // ensure main frame is in idle
            (tabInfo as any).frameInfos["0"].lastTimeStamp = 0;
            tabInfo.prepareNavigation(1, "amazon.com");
            const originalScheduleDeadFramesCheck = tabInfo.scheduleDeadFramesCheck.bind(tabInfo);

            const mock = mockAssimilate(tabInfo, "tabInfo", {
                mock: ["scheduleDeadFramesCheck"],
            });
            mock.scheduleDeadFramesCheck.expect();
            await originalScheduleDeadFramesCheck();
        });
        describe("with executeScript returning no success", () => {
            it("should collect hostnames and call checkDomainLeave", async () => {
                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(1, "amazon.com");
                tabInfo.commitNavigation(2, "images.google.com");

                // @ts-ignore
                mockBrowser.tabs.executeScript.expect(42, { frameId: 1, code: "1" }).andReject(new Error());
                // @ts-ignore
                mockBrowser.tabs.executeScript.expect(42, { frameId: 2, code: "1" }).andReject(new Error());

                // ensure all tabinfos are in idle
                const { frameInfos } = tabInfo as any;
                for (const key of Object.keys(frameInfos)) frameInfos[key].lastTimeStamp = 0;

                await tabInfo.scheduleDeadFramesCheck();
                expect(checkDomainLeaveSpy).toHaveBeenCalledTimes(1);
                expect(checkDomainLeaveSpy).toHaveBeenCalledWith("mock", new Set(["amazon.com", "images.google.com"]));
                checkDomainLeaveSpy.mockClear();
            });
        });
        describe("with executeScript returning success", () => {
            it("should not collect hostnames and not call checkDomainLeave", async () => {
                // @ts-ignore
                mockBrowser.tabs.executeScript.expect(42, { frameId: 1, code: "1" }).andResolve([]);
                // @ts-ignore
                mockBrowser.tabs.executeScript.expect(42, { frameId: 2, code: "1" }).andResolve([]);

                const tabInfo = createTabInfo();
                tabInfo.commitNavigation(1, "amazon.com");
                tabInfo.commitNavigation(2, "images.google.com");

                // ensure all tabinfos are in idle
                const { frameInfos } = tabInfo as any;
                for (const key of Object.keys(frameInfos)) frameInfos[key].lastTimeStamp = 0;

                await tabInfo.scheduleDeadFramesCheck();
                expect(checkDomainLeaveSpy).not.toHaveBeenCalled();
            });
        });
    });
});
