/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { messageUtil } from "../lib/messageUtil";
import { someItemsMatch } from "./backgroundShared";

const DOMAIN_LEAVE_SETTINGS_KEYS = ["domainLeave.enabled", "domainLeave.delay"];

export class CleanupScheduler {
    private delayTime = 0;

    private enabled = false;

    private readonly handler: (domain: string) => Promise<void>;

    private domainTimeouts: { [s: string]: ReturnType<typeof setTimeout> } = {};

    private snoozing: boolean;

    private readonly snoozedDomains: { [s: string]: boolean } = {};

    public constructor(handler: (domain: string) => Promise<void>, snoozing: boolean) {
        this.snoozing = snoozing;
        this.handler = handler;

        this.updateSettings();
        messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, DOMAIN_LEAVE_SETTINGS_KEYS)) this.updateSettings();
        });
    }

    private updateSettings() {
        const enabled = settings.get("domainLeave.enabled");
        if (enabled !== this.enabled) {
            this.enabled = enabled;
            if (!enabled) {
                this.clearAllTimeouts();
                for (const domain of Object.keys(this.snoozedDomains)) delete this.snoozedDomains[domain];
            }
        }
        this.delayTime = settings.get("domainLeave.delay") * 1000;
    }

    private clearAllTimeouts() {
        for (const domain of Object.keys(this.domainTimeouts)) {
            clearTimeout(this.domainTimeouts[domain]);
            delete this.domainTimeouts[domain];
        }
    }

    public async schedule(domain: string) {
        if (!this.enabled) return;

        if (this.domainTimeouts[domain]) {
            clearTimeout(this.domainTimeouts[domain]);
            delete this.domainTimeouts[domain];
        }
        if (this.snoozing) this.snoozedDomains[domain] = true;
        else if (this.delayTime <= 0) await this.handler(domain);
        else {
            this.domainTimeouts[domain] = setTimeout(() => {
                if (this.enabled) {
                    if (this.snoozing) this.snoozedDomains[domain] = true;
                    else this.handler(domain);
                }
                delete this.domainTimeouts[domain];
            }, this.delayTime);
        }
    }

    public setSnoozing(snoozing: boolean) {
        this.snoozing = snoozing;
        if (snoozing) {
            // cancel countdowns and remember them for later
            for (const domain of Object.keys(this.domainTimeouts)) {
                this.snoozedDomains[domain] = true;
                clearTimeout(this.domainTimeouts[domain]);
                delete this.domainTimeouts[domain];
            }
        } else {
            // reschedule
            for (const domain of Object.keys(this.snoozedDomains)) {
                this.schedule(domain);
                delete this.snoozedDomains[domain];
            }
        }
    }

    public getSnoozedDomainsToClean() {
        return Object.getOwnPropertyNames(this.snoozedDomains);
    }

    public getScheduledDomainsToClean() {
        return Object.getOwnPropertyNames(this.domainTimeouts);
    }
}
