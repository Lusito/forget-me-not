import { singleton } from "tsyringe";

import { MessageUtil } from "../shared/messageUtil";

// fixme: make this file unit-testable and add tests

@singleton()
export class SnoozeManager {
    private snoozing = false;

    public readonly listeners = new Set<(snoozing: boolean) => void>();

    public constructor(private readonly messageUtil: MessageUtil) {
        messageUtil.receive("toggleSnoozingState", () => {
            this.toggleSnoozingState();
        });
        messageUtil.receive("getSnoozingState", () => {
            this.sendSnoozingState();
        });
    }

    public isSnoozing() {
        return this.snoozing;
    }

    private async toggleSnoozingState() {
        this.snoozing = !this.snoozing;
        for (const listener of this.listeners) listener(this.snoozing);
        await this.sendSnoozingState();
    }

    private async sendSnoozingState() {
        await this.messageUtil.send("onSnoozingState", this.snoozing);
    }
}
