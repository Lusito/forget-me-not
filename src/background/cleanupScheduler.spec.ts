/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */
import { container } from "tsyringe";
import { advanceTime } from "mockzilla";

import { CleanupScheduler } from "./cleanupScheduler";
import { mocks } from "../testUtils/mocks";

describe("Cleanup Scheduler", () => {
    let handler: jest.Mock | null = null;
    let cleanupScheduler: CleanupScheduler | null = null;

    afterEach(() => {
        cleanupScheduler = null;
    });

    function createScheduler(enabled: boolean, snoozing: boolean, delay = 1) {
        handler = jest.fn();
        mocks.settings.get.expect("domainLeave.enabled").andReturn(enabled);
        mocks.settings.get.expect("domainLeave.delay").andReturn(delay);
        mocks.messageUtil.mockAllow();

        mocks.snoozeManager.isSnoozing.expect().andReturn(snoozing);
        mocks.snoozeManager.listeners.add.expect(expect.anything());
        cleanupScheduler = container.resolve(CleanupScheduler);

        mocks.messageUtil.receive.expect("settingsChanged", expect.anything());
        cleanupScheduler.init(handler);
    }

    describe("schedule", () => {
        describe("domainLeave.enabled = false", () => {
            beforeEach(() => createScheduler(false, false));

            it("should neither schedule nor remember domains", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing = true, domainLeave.enabled = true", () => {
            beforeEach(() => createScheduler(true, true));

            it("should schedule domain cleans", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveSameMembers([
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
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(999);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler?.mock.calls).toEqual([["google.com"], ["google.de"], ["google.jp"]]);
            });
            it("should call handler with little difference in expected duration", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(999);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler?.mock.calls).toEqual([["google.com"], ["google.de"], ["google.jp"]]);
            });
        });
        describe("snoozing changing, domainLeave.enabled = true", () => {
            beforeEach(() => createScheduler(true, false));

            it("should remember domains to clean", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de",
                    "google.com",
                    "google.jp",
                ]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                cleanupScheduler!.setSnoozing(true);
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveSameMembers([
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
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");

                mocks.settings.get.expect("domainLeave.enabled").andReturn(false);
                mocks.settings.get.expect("domainLeave.delay").andReturn(1000);
                cleanupScheduler!["updateSettings"]();
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing = false, domainLeave.enabled = true, domainLeave.delay = 0.4s", () => {
            beforeEach(() => createScheduler(true, false, 0.4));

            it("should call handler with little difference in expected duration", async () => {
                await cleanupScheduler!.schedule("google.de");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers(["google.de"]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(200);
                await cleanupScheduler!.schedule("google.com");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers(["google.de", "google.com"]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                advanceTime(199);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler).toHaveBeenCalledTimes(1);
                expect(handler).toHaveBeenCalledWith("google.de");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers(["google.com"]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                handler!.mockClear();
                advanceTime(199);
                expect(handler).not.toHaveBeenCalled();
                advanceTime(1);
                expect(handler).toHaveBeenCalledTimes(1);
                expect(handler).toHaveBeenCalledWith("google.com");
            });
        });
    });
});
