/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as messageUtil from "../lib/messageUtil";
import { CookieDomainInfo } from '../shared';
import { getBadgeForDomain } from './backgroundShared';

const MAX_COOKIE_DOMAIN_HISTORY = 20;

export class MostRecentCookieDomains {
    private domains: string[] = [];

    public constructor() {
        messageUtil.receive('getMostRecentCookieDomains', (params: any, sender: any) => {
            messageUtil.send('onMostRecentCookieDomains', this.get());
        });
    }

    private get(): CookieDomainInfo[] {
        let result: CookieDomainInfo[] = [];
        for (const domain of this.domains) {
            let badgeKey = getBadgeForDomain(domain).i18nKey;
            if (badgeKey) {
                result.push({
                    domain: domain,
                    badge: badgeKey
                });
            }
        }
        return result;
    }

    public add(domain: string) {
        if (domain.startsWith('.'))
            domain = domain.substr(1);
        let index = this.domains.indexOf(domain);
        if (index !== 0) {
            if (index !== -1)
                this.domains.splice(index, 1);
            this.domains.unshift(domain);
            if (this.domains.length > MAX_COOKIE_DOMAIN_HISTORY)
                this.domains.length = MAX_COOKIE_DOMAIN_HISTORY;
        }
    }
}
