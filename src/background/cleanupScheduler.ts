import { injectable } from "tsyringe";

import { someItemsMatch } from "./backgroundShared";
import { Settings } from "../shared/settings";
import { MessageUtil } from "../shared/messageUtil";
import { SnoozeManager } from "./snoozeManager";

const DOMAIN_LEAVE_SETTINGS_KEYS = ["domainLeave.enabled", "domainLeave.delay"];

@injectable()
export class CleanupScheduler {
    private delayTime = 0;

    private enabled = false;

    private handler: (domain: string) => Promise<void> = () => Promise.resolve();

    private domainTimeouts: { [s: string]: ReturnType<typeof setTimeout> } = {};

    private snoozing: boolean;

    private snoozedDomains: { [s: string]: boolean } = {};

    public constructor(
        private readonly settings: Settings,
        private readonly messageUtil: MessageUtil,
        snoozeManager: SnoozeManager
    ) {
        this.snoozing = snoozeManager.isSnoozing();

        snoozeManager.listeners.add((snoozing) => {
            this.setSnoozing(snoozing);
        });
    }

    public init(handler: (domain: string) => Promise<void>) {
        this.handler = handler;

        this.updateSettings();
        this.messageUtil.settingsChanged.receive((changedKeys: string[]) => {
            if (someItemsMatch(changedKeys, DOMAIN_LEAVE_SETTINGS_KEYS)) this.updateSettings();
        });
    }

    private updateSettings() {
        const enabled = this.settings.get("domainLeave.enabled");
        if (enabled !== this.enabled) {
            this.enabled = enabled;
            if (!enabled) {
                this.clearAllTimeouts();
                for (const domain of Object.keys(this.snoozedDomains)) delete this.snoozedDomains[domain];
            }
        }
        this.delayTime = this.settings.get("domainLeave.delay") * 1000;
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

    private async setSnoozing(snoozing: boolean) {
        this.snoozing = snoozing;
        if (snoozing) {
            // cancel countdowns and remember them for later
            for (const domain of Object.keys(this.domainTimeouts)) {
                this.snoozedDomains[domain] = true;
                clearTimeout(this.domainTimeouts[domain]);
            }
            this.domainTimeouts = {};
        } else {
            // reschedule
            await Promise.all(Object.keys(this.snoozedDomains).map((domain) => this.schedule(domain)));
            this.snoozedDomains = {};
        }
    }

    public getSnoozedDomainsToClean() {
        return Object.keys(this.snoozedDomains);
    }

    public getScheduledDomainsToClean() {
        return Object.keys(this.domainTimeouts);
    }
}
