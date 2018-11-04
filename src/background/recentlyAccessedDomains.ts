/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil, ReceiverHandle } from "../lib/messageUtil";
import { CookieDomainInfo, destroyAllAndEmpty } from "../shared";
import { getBadgeForCleanupType } from "./backgroundHelpers";
import { settings } from "../lib/settings";
import { someItemsMatch } from "./backgroundShared";

const APPLY_SETTINGS_KEYS = ["logRAD.enabled", "logRAD.limit"];
const UPDATE_SETTINGS_KEYS = ["fallbackRule", "rules", "whitelistNoTLD", "whitelistFileSystem"];

export class RecentlyAccessedDomains {
    private receivers: ReceiverHandle[];
    private enabled = false;
    private limit = 0;
    private domains: string[] = [];

    public constructor() {
        this.receivers = [
            messageUtil.receive("getRecentlyAccessedDomains", (params: any, sender: any) => {
                messageUtil.send("onRecentlyAccessedDomains", this.get());
            }),
            messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
                if (someItemsMatch(changedKeys, APPLY_SETTINGS_KEYS)) {
                    this.applySettings();
                    messageUtil.send("onRecentlyAccessedDomains", this.get());
                } else if (someItemsMatch(changedKeys, UPDATE_SETTINGS_KEYS)) {
                    messageUtil.send("onRecentlyAccessedDomains", this.get());
                }
            })
        ];
        settings.onReady(this.applySettings.bind(this));
    }

    public destroy() {
        destroyAllAndEmpty(this.receivers);
    }

    public isEnabled() {
        return this.enabled;
    }

    public getLimit() {
        return this.limit;
    }

    private applySettings() {
        this.enabled = settings.get("logRAD.enabled");
        this.limit = settings.get("logRAD.limit");
        this.applyLimit();
    }

    private applyLimit() {
        const limit = (this.enabled && this.limit > 0) ? this.limit : 0;
        if (this.domains.length > limit)
            this.domains.length = limit;
    }

    public get(): CookieDomainInfo[] {
        const result: CookieDomainInfo[] = [];
        for (const domain of this.domains) {
            const badge = getBadgeForCleanupType(settings.getCleanupTypeForDomain(domain));
            if (badge) {
                result.push({
                    domain,
                    className: badge.className,
                    i18nBadge: badge.i18nBadge,
                    i18nButton: badge.i18nButton
                });
            }
        }
        return result;
    }

    public add(domain: string) {
        if (this.enabled && domain) {
            if (domain.startsWith("."))
                domain = domain.substr(1);
            const index = this.domains.indexOf(domain);
            if (index !== 0) {
                if (index !== -1)
                    this.domains.splice(index, 1);
                this.domains.unshift(domain);
                this.applyLimit();
            }
        }
    }
}
