export interface DomainAndStore {
    domain: string;
    storeId: string;
}

export interface CookieDomainInfo extends DomainAndStore {
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
