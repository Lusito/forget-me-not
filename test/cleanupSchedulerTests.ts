/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../src/lib/settings";
import { destroyAndNull } from "../src/shared";
import { ensureNotNull, browserMock, createSpy, SpyData } from "./browserMock";
import { assert } from "chai";
import { CleanupScheduler } from "../src/background/cleanupScheduler";

describe("Cleanup Scheduler", () => {
    let handler: SpyData | null = null;
    let cleanupScheduler: CleanupScheduler | null = null;

    afterEach(() => {
        cleanupScheduler = destroyAndNull(cleanupScheduler);
        settings.restoreDefaults();
    });

    beforeEach(() => {
        browserMock.reset();
    });

    describe("schedule", () => {
        context("domainLeave.enabled = false", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", false);
                settings.save();
                handler = createSpy();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
            it("should neither schedule nor remember domains", () => {
                cleanupScheduler = ensureNotNull(cleanupScheduler);
                handler = ensureNotNull(handler);
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.com");
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.jp");
                assert.sameMembers(cleanupScheduler.getScheduledDomainsToClean(), []);
                assert.sameMembers(cleanupScheduler.getSnoozedDomainsToClean(), []);
                handler.assertNoCall();
            });
        });
        context("snoozing = true, domainLeave.enabled = true", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.save();
                handler = createSpy();
                cleanupScheduler = new CleanupScheduler(handler, true);
            });
            it("should schedule domain cleans", () => {
                cleanupScheduler = ensureNotNull(cleanupScheduler);
                handler = ensureNotNull(handler);
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.com");
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.jp");
                assert.sameMembers(cleanupScheduler.getScheduledDomainsToClean(), []);
                assert.sameMembers(cleanupScheduler.getSnoozedDomainsToClean(), [
                    "google.de", "google.com", "google.jp"
                ]);
                handler.assertNoCall();
            });
        });
        context("snoozing = false, domainLeave.enabled = true", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.save();
                handler = createSpy();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
            it("should remember domains to clean", () => {
                cleanupScheduler = ensureNotNull(cleanupScheduler);
                handler = ensureNotNull(handler);
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.com");
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.jp");
                assert.sameMembers(cleanupScheduler.getScheduledDomainsToClean(), [
                    "google.de", "google.com", "google.jp"
                ]);
                assert.sameMembers(cleanupScheduler.getSnoozedDomainsToClean(), []);
                handler.assertNoCall();
            });
        });
        context("snoozing changing, domainLeave.enabled = true", () => {
            beforeEach(() => {
                settings.set("domainLeave.enabled", true);
                settings.save();
                handler = createSpy();
                cleanupScheduler = new CleanupScheduler(handler, false);
            });
            it("should remember domains to clean", () => {
                cleanupScheduler = ensureNotNull(cleanupScheduler);
                handler = ensureNotNull(handler);
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.com");
                cleanupScheduler.schedule("google.de");
                cleanupScheduler.schedule("google.jp");
                assert.sameMembers(cleanupScheduler.getScheduledDomainsToClean(), [
                    "google.de", "google.com", "google.jp"
                ]);
                assert.sameMembers(cleanupScheduler.getSnoozedDomainsToClean(), []);
                cleanupScheduler.setSnoozing(true);
                assert.sameMembers(cleanupScheduler.getScheduledDomainsToClean(), []);
                assert.sameMembers(cleanupScheduler.getSnoozedDomainsToClean(), [
                    "google.de", "google.com", "google.jp"
                ]);
                handler.assertNoCall();
            });
        });
    });
    // fixme: change settings after creation, test if calls actually happened
});
