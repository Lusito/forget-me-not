/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { badges, getBadgeForCleanupType } from "./backgroundHelpers";
import { CleanupType } from "../lib/shared";

describe("Background Helpers", () => {
    describe("getBadgeForCleanupType", () => {
        it.each([
            [CleanupType.NEVER, badges.never],
            [CleanupType.STARTUP, badges.startup],
            [CleanupType.LEAVE, badges.leave],
            [CleanupType.INSTANTLY, badges.instantly],
            [("unknown" as any) as CleanupType, badges.leave],
        ])("should return the correct badge for %s", (type, badge) => {
            expect(getBadgeForCleanupType(type)).toBe(badge);
        });
    });
});
