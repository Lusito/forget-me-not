/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { container } from "tsyringe";

import { MessageUtil } from "./messageUtil";
import { mockAssimilate } from "../testUtils/deepMockAssimilate";

describe("Message Utility", () => {
    const event1 = "event1";
    const event2 = "event2";
    const data1 = "mydata1";
    const data2 = "mydata2";
    const sender = { id: "mock" };
    let messageUtil: MessageUtil;

    beforeEach(() => {
        mockBrowser.runtime.onMessage.addListener.expect(expect.anything());
        messageUtil = container.resolve(MessageUtil);
    });

    describe("sendSelf", () => {
        it("should delegate to emitCallbacks", () => {
            const mock = mockAssimilate(messageUtil, ["emitCallbacks"], ["sendSelf"]);
            mock.emitCallbacks.expect(event1, data1, {});
            messageUtil.sendSelf(event1, data1);
        });
    });

    describe("send", () => {
        it("should delegate to mockBrowser.runtime.sendMessage", async () => {
            mockBrowser.runtime.sendMessage
                .expect({
                    action: event1,
                    params: data1,
                })
                .andResolve({});
            await messageUtil.send(event1, data1);
        });
        it("should swallow exceptions", async () => {
            mockBrowser.runtime.sendMessage
                .expect({
                    action: event1,
                    params: data1,
                })
                .andReject(new Error("Nothing to see here"));
            await messageUtil.send(event1, data1);
        });
    });

    describe("emitCallbacks", () => {
        it("should call receive methods in order", () => {
            const spy = jest.fn();
            messageUtil.receive(event1, (...args) => spy(1, ...args));
            messageUtil.receive(event1, (...args) => spy(2, ...args));
            messageUtil.receive(event2, (...args) => spy(3, ...args));
            messageUtil.receive(event1, (...args) => spy(4, ...args));
            messageUtil.receive(event2, (...args) => spy(5, ...args));

            messageUtil["emitCallbacks"](event1, data1, sender);
            expect(spy.mock.calls).toEqual([
                [1, data1, sender],
                [2, data1, sender],
                [4, data1, sender],
            ]);
            spy.mockClear();

            messageUtil["emitCallbacks"](event2, data2, sender);
            expect(spy.mock.calls).toEqual([
                [3, data2, sender],
                [5, data2, sender],
            ]);
        });
        it("should not call the receiver if it has been canceled", () => {
            const spy = jest.fn();
            const receiver = messageUtil.receive(event1, spy);
            receiver.destroy();

            messageUtil["emitCallbacks"](event1, data1, sender);
            expect(spy).not.toHaveBeenCalled();
        });
    });
});
