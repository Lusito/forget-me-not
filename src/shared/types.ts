/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export interface CookieDomainInfo {
    domain: string;
    className: string;
    i18nBadge: string;
    i18nButton: string;
}

export enum CleanupType {
    NEVER,
    STARTUP,
    LEAVE,
    INSTANTLY,
}
