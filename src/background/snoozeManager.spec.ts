import { container } from "tsyringe";
import { mockAssimilate } from "mockzilla";

import { SnoozeManager } from "./snoozeManager";
import { mocks } from "../testUtils/mocks";

describe("SnoozeManager", () => {
    let snoozeManager: SnoozeManager;

    beforeEach(() => {
        mocks.messageUtil.toggleSnoozingState.receive.expect(expect.anything());
        mocks.messageUtil.getSnoozingState.receive.expect(expect.anything());
        snoozeManager = container.resolve(SnoozeManager);
    });

    it("is not snoozing initially", () => {
        expect(snoozeManager.isSnoozing()).toBe(false);
    });

    describe("constructor", () => {
        it("registers the toggleSnoozingState listener correctly", () => {
            const mock = mockAssimilate(snoozeManager, "snoozeManager", {
                mock: ["toggleSnoozingState"],
                whitelist: [],
            });
            mock.toggleSnoozingState.expect().andResolve();
            mocks.messageUtil.toggleSnoozingState.receive.getMockCalls()[0][0]();
        });
        it("registers the getSnoozingState listener correctly", () => {
            const mock = mockAssimilate(snoozeManager, "snoozeManager", {
                mock: ["sendSnoozingState"],
                whitelist: [],
            });
            mock.sendSnoozingState.expect().andResolve();
            mocks.messageUtil.getSnoozingState.receive.getMockCalls()[0][0]();
        });
    });
    describe("toggleSnoozingState", () => {
        it("toggles the state and sends a message", async () => {
            mocks.messageUtil.onSnoozingState.send.expect(true);
            await snoozeManager["toggleSnoozingState"]();
            expect(snoozeManager.isSnoozing()).toBe(true);

            mocks.messageUtil.onSnoozingState.send.expect(false);
            await snoozeManager["toggleSnoozingState"]();
            expect(snoozeManager.isSnoozing()).toBe(false);
        });
    });
});
