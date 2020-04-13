/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { CleanupScheduler } from "./cleanupScheduler";
import { settings } from "../lib/settings";
import { advanceTime } from "../testUtils/time";

describe("Cleanup Scheduler", () => {
    let handler: jest.Mock | null = null;
    let cleanupScheduler: CleanupScheduler | null = null;

    afterEach(async () => {
        cleanupScheduler = null;
        await settings.restoreDefaults();
    });

    describe("schedule", () => {
        describe("domainLeave.enabled = false", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", false);
                await settings.save();
                handler = jest.fn();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
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
            beforeEach(async () => {
                settings.set("domainLeave.enabled", true);
                await settings.save();
                handler = jest.fn();
                cleanupScheduler = new CleanupScheduler(handler, true);
            });
            it("should schedule domain cleans", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveSameMembers([
                    "google.de", "google.com", "google.jp"
                ]);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing = false, domainLeave.enabled = true", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", true);
                await settings.save();
                handler = jest.fn();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
            it("should remember domains to clean", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de", "google.com", "google.jp"
                ]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                expect(handler).not.toHaveBeenCalled();
            });
            it("should call handler with little difference in expected duration", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de", "google.com", "google.jp"
                ]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing changing, domainLeave.enabled = true", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", true);
                await settings.save();
                handler = jest.fn();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
            it("should remember domains to clean", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveSameMembers([
                    "google.de", "google.com", "google.jp"
                ]);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                cleanupScheduler!.setSnoozing(true);
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveSameMembers([
                    "google.de", "google.com", "google.jp"
                ]);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("domainLeave.enabled = true changed to false", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", true);
                await settings.save();
                handler = jest.fn();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
            it("should forget domains and remove timeouts", async () => {
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.com");
                await cleanupScheduler!.schedule("google.de");
                await cleanupScheduler!.schedule("google.jp");

                settings.set("domainLeave.enabled", false);
                await settings.save();
                expect(cleanupScheduler!.getScheduledDomainsToClean()).toHaveLength(0);
                expect(cleanupScheduler!.getSnoozedDomainsToClean()).toHaveLength(0);
                expect(handler).not.toHaveBeenCalled();
            });
        });
        describe("snoozing = false, domainLeave.enabled = true, domainLeave.delay = 0.4s", () => {
            beforeEach(async () => {
                settings.set("domainLeave.enabled", true);
                settings.set("domainLeave.delay", 0.4);
                await settings.save();
                handler = jest.fn();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
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
