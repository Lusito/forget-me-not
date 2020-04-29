import { CleanupType } from "./types";

export interface BadgeInfo {
    className: string;
    i18nBadge: string;
    i18nButton: string;
    color: string | [number, number, number, number];
}

function createBadge(name: string, color: [number, number, number, number]): BadgeInfo {
    const className = `cleanup_type_${name}`;
    return {
        className,
        i18nBadge: `${className}_badge`,
        i18nButton: `${className}_button`,
        color,
    };
}

const badgeNone: BadgeInfo = { className: "", i18nBadge: "", i18nButton: "", color: [0, 0, 0, 255] };

export const badges = {
    never: createBadge("never", [38, 69, 151, 255]),
    startup: createBadge("startup", [116, 116, 116, 255]),
    leave: createBadge("leave", [190, 23, 38, 255]),
    instantly: createBadge("instantly", [0, 0, 0, 255]),
    none: badgeNone,
};

export function getBadgeForCleanupType(type: CleanupType) {
    switch (type) {
        case CleanupType.NEVER:
            return badges.never;
        case CleanupType.STARTUP:
            return badges.startup;
        default:
        case CleanupType.LEAVE:
            return badges.leave;
        case CleanupType.INSTANTLY:
            return badges.instantly;
    }
}
