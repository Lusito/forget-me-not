/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "../lib/settings";
import { messageUtil, ReceiverHandle } from "../lib/messageUtil";

export class CleanupScheduler {
    private settingsReceiver: ReceiverHandle | null;
    private delayTime: number = 0;
    private enabled: boolean = false;
    private readonly handler: (domain: string) => void;
    private domainTimeouts: { [s: string]: number } = {};
    private snoozing: boolean;
    private readonly snoozedDomains: { [s: string]: boolean } = {};

    public constructor(handler: (domain: string) => void, snoozing: boolean) {
        this.snoozing = snoozing;
        this.handler = handler;

        this.updateSettings();
        this.settingsReceiver = messageUtil.receive("settingsChanged", (changedKeys: string[]) => {
            if (changedKeys.indexOf("domainLeave.enabled") !== -1 || changedKeys.indexOf("domainLeave.delay") !== -1)
                this.updateSettings();
        });
    }

    private updateSettings() {
        const enabled = settings.get("domainLeave.enabled");
        if (enabled !== this.enabled) {
            this.enabled = enabled;
            if (!enabled) {
                this.clearAllTimeouts();
                for (const domain in this.snoozedDomains)
                    delete this.snoozedDomains[domain];
            }
        }
        this.delayTime = settings.get("domainLeave.delay") * 60 * 1000;
    }

    public destroy() {
        if (this.settingsReceiver) {
            this.settingsReceiver.destroy();
            this.settingsReceiver = null;
        }
        this.clearAllTimeouts();
    }

    private clearAllTimeouts() {
        for (const domain in this.domainTimeouts) {
            clearTimeout(this.domainTimeouts[domain]);
            delete this.domainTimeouts[domain];
        }
    }

    public schedule(domain: string) {
        if (!this.enabled)
            return;

        if (this.domainTimeouts[domain]) {
            clearTimeout(this.domainTimeouts[domain]);
            delete this.domainTimeouts[domain];
        }
        if (this.snoozing)
            this.snoozedDomains[domain] = true;
        else if (this.delayTime <= 0)
            this.handler(domain);
        else {
            this.domainTimeouts[domain] = setTimeout(() => {
                if (this.enabled) {
                    if (this.snoozing)
                        this.snoozedDomains[domain] = true;
                    else
                        this.handler(domain);
                }
                delete this.domainTimeouts[domain];
            }, this.delayTime);
        }
    }

    public setSnoozing(snoozing: boolean) {
        this.snoozing = snoozing;
        if (snoozing) {
            // cancel countdowns and remember them for later
            for (const domain in this.domainTimeouts) {
                this.snoozedDomains[domain] = true;
                clearTimeout(this.domainTimeouts[domain]);
                delete this.domainTimeouts[domain];
            }
        } else {
            // reschedule
            for (const domain in this.snoozedDomains) {
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
