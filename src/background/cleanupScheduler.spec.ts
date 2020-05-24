import { container } from "tsyringe";
import { advanceTime, mockAssimilate, whitelistPropertyAccess } from "mockzilla";

import { CleanupScheduler } from "./cleanupScheduler";
import { mocks } from "../testUtils/mocks";
import { mockListenerSet, MockzillaListenerSetOf } from "../testUtils/mockListenerSet";

describe("CleanupScheduler", () => {
    let handler: jest.Mock;
    let cleanupScheduler: CleanupScheduler;
    let snoozeListener: MockzillaListenerSetOf<typeof mocks.snoozeManager.listeners>;

    function createScheduler(enabled: boolean, snoozing: boolean, delay = 1) {
        snoozeListener = mockListenerSet(mocks.snoozeManager.listeners);
        handler = jest.fn();
        mocks.settings.get.expect("domainLeave.enabled").andReturn(enabled);
        mocks.settings.get.expect("domainLeave.delay").andReturn(delay);
        mocks.messageUtil.mockAllow();

        mocks.snoozeManager.isSnoozing.expect().andReturn(snoozing);
        cleanupScheduler = container.resolve(CleanupScheduler);

        mocks.messageUtil.settingsChanged.receive.expect(expect.anything());
        cleanupScheduler.init(handler);
    }
    afterEach(() => {
        cleanupScheduler = undefined as any;
    });

    it("should register snoozeListener correctly", () => {
        createScheduler(false, false);
        const mock = mockAssimilate(cleanupScheduler, "cleanupScheduler", {
            mock: ["setSnoozing"],
            whitelist: [],
        });
        const snoozing = {} as any;
        mock.setSnoozing.expect(snoozing);
        snoozeListener.emit(snoozing);
    });

    it("should register settingsChanged listener correctly", () => {
        createScheduler(false, false);
        const mock = mockAssimilate(cleanupScheduler, "cleanupScheduler", {
            mock: ["updateSettings"],
            whitelist: [],
        });

        const callback = mocks.messageUtil.settingsChanged.receive.getMockCalls()[0][0];

        // Do nothing if unknown property
        callback(["instantly.enabled"]);
        callback([]);

        // Call updateSettings if a matching settings updated
        mock.updateSettings.expect().times(4);
        callback(["domainLeave.enabled", "domainLeave.delay"]);
        callback(["domainLeave.delay"]);
        callback(["domainLeave.enabled"]);
        callback(["instantly.enabled", "domainLeave.enabled"]);
    });

    describe("schedule", () => {
        describe("domainLeave.enabled = false", () => {
            beforeEach(() => createScheduler(false, false));

            it("should neither schedule nor remember domains", async () => {
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.com");
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.jp");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing = true, domainLeave.enabled = true", () => {
            beforeEach(() => createScheduler(true, true));

            it("should schedule domain cleans", async () => {
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.com");
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.jp");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing = false, domainLeave.enabled = true", () => {
            beforeEach(() => createScheduler(true, false));

            it("should remember domains to clean", async () => {
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.com");
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.jp");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(999);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler?.mock.calls).toEqual([["google.com"], ["google.de"], ["google.jp"]]);
            });
            it("should call handler with little difference in expected duration", async () => {
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.com");
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.jp");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(999);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler?.mock.calls).toEqual([["google.com"], ["google.de"], ["google.jp"]]);
            });
        });
        describe("snoozing changing, domainLeave.enabled = true", () => {
            beforeEach(() => createScheduler(true, false));

            it("should remember domains to clean", async () => {
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.com");
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.jp");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                cleanupScheduler["setSnoozing"](true);
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("domainLeave.enabled = true changed to false", () => {
            beforeEach(() => createScheduler(true, false));

            it("should forget domains and remove timeouts", async () => {
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.com");
                await cleanupScheduler.schedule("google.de");
                await cleanupScheduler.schedule("google.jp");

                mocks.settings.get.expect("domainLeave.enabled").andReturn(false);
                mocks.settings.get.expect("domainLeave.delay").andReturn(1000);
                cleanupScheduler["updateSettings"]();
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing = false, domainLeave.enabled = true, domainLeave.delay = 0.4s", () => {
            beforeEach(() => createScheduler(true, false, 0.4));

            it("should call handler with little difference in expected duration", async () => {
                await cleanupScheduler.schedule("google.de");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveSameMembers(["google.de"]);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(200);
                await cleanupScheduler.schedule("google.com");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveSameMembers(["google.de", "google.com"]);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(199);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler).toHaveBeenCalledTimes(1);
                expect(handler).toHaveBeenCalledWith("google.de");
                expect(cleanupScheduler.getScheduledDomainsToClean()).toHaveSameMembers(["google.com"]);
                expect(cleanupScheduler.getSnoozedDomainsToClean()).toHaveLength(0);
                handler.mockClear();
                advanceTime(199);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler).toHaveBeenCalledTimes(1);
                expect(handler).toHaveBeenCalledWith("google.com");
            });
        });
    });

    describe("setSnoozing", () => {
        beforeEach(() => createScheduler(false, false));

        it("should set snoozing", async () => {
            await cleanupScheduler["setSnoozing"](true);
            expect(cleanupScheduler["snoozing"]).toBe(true);
            await cleanupScheduler["setSnoozing"](false);
            expect(cleanupScheduler["snoozing"]).toBe(false);
        });
        describe("with snoozing=true", () => {
            it("should cancel countdowns and remember them for later", async () => {
                whitelistPropertyAccess(
                    cleanupScheduler,
                    "snoozedDomains",
                    "domainTimeouts",
                    "setSnoozing",
                    "snoozing"
                );
                cleanupScheduler["snoozedDomains"].c = true;
                cleanupScheduler["domainTimeouts"].a = 10 as any;
                cleanupScheduler["domainTimeouts"].b = 11 as any;
                await cleanupScheduler["setSnoozing"](true);
                expect(cleanupScheduler["snoozedDomains"]).toEqual({
                    a: true,
                    b: true,
                    c: true,
                });
                expect(cleanupScheduler["domainTimeouts"]).toEqual({});
            });
        });
        describe("with snoozing=false", () => {
            it("should reschedule cleanups", async () => {
                cleanupScheduler["snoozedDomains"].a = true;
                cleanupScheduler["snoozedDomains"].b = true;
                const mock = mockAssimilate(cleanupScheduler, "cleanupScheduler", {
                    mock: ["schedule"],
                    whitelist: ["setSnoozing", "snoozing", "snoozedDomains"],
                });
                mock.schedule.expect("a").andResolve();
                mock.schedule.expect("b").andResolve();
                await cleanupScheduler["setSnoozing"](false);
                expect(cleanupScheduler["snoozedDomains"]).toEqual({});
            });
        });
    });
});
