/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil, ReceiverHandle } from "../lib/messageUtil";
import { CookieDomainInfo, destroyAllAndEmpty } from "../shared";
import { getBadgeForRuleType } from "./backgroundHelpers";
import { settings } from "../lib/settings";

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
                if (changedKeys.indexOf("logRAD.enabled") !== -1 || changedKeys.indexOf("logRAD.limit") !== -1) {
                    this.applySettings();
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
            const badge = getBadgeForRuleType(settings.getRuleTypeForDomain(domain)).i18nKey;
            if (badge) {
                result.push({ domain, badge });
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
