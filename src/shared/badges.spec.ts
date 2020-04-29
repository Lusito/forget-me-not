import { badges, getBadgeForCleanupType } from "./badges";
import { CleanupType } from "./types";

describe("Badges", () => {
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
