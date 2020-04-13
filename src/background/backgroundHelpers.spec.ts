/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { badges, getBadgeForCleanupType, BadgeInfo } from "./backgroundHelpers";
import { CleanupType } from "../lib/shared";
import { contextWithResult } from "../testUtils/testHelpers";

describe("Background Helpers", () => {
    describe("getBadgeForCleanupType", () => {
        contextWithResult<CleanupType, BadgeInfo>(
            "type",
            [
                { context: CleanupType.NEVER, result: badges.never },
                { context: CleanupType.STARTUP, result: badges.startup },
                { context: CleanupType.LEAVE, result: badges.leave },
                { context: CleanupType.INSTANTLY, result: badges.instantly },
                { context: ("unknown" as any) as CleanupType, result: badges.leave },
            ],
            (type, badge) => {
                it("should return the correct badge", () => {
                    expect(getBadgeForCleanupType(type)).toBe(badge);
                });
            }
        );
    });
});
