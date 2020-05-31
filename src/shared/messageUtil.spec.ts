import { container } from "tsyringe";
import { mockAssimilate, whitelistPropertyAccess } from "mockzilla";

import { MessageUtil } from "./messageUtil";

describe("MessageUtil", () => {
    const event1 = "event1";
    const event2 = "event2";
    const data1 = "mydata1";
    const data2 = "mydata2";
    let messageUtil: MessageUtil;

    beforeEach(() => {
        mockBrowser.runtime.onMessage.addListener.expect(expect.anything());
        messageUtil = container.resolve(MessageUtil);
    });

    describe("constructor", () => {
        it("registers the onMessage listener", () => {
            const listener = mockBrowser.runtime.onMessage.addListener.getMockCalls()[0][0];
            const mock = mockAssimilate(messageUtil, "messageUtil", {
                mock: ["emitCallbacks"],
                whitelist: [],
            });
            const message = {
                action: "mock-action",
                params: ["param1", "param2"],
            };
            listener(undefined, {});
            mock.emitCallbacks.expect(message.action, message.params);
            listener(message, {});
        });
    });

    describe("register", () => {
        describe("receive", () => {
            it("should delegate to receive", () => {
                const mock = mockAssimilate(messageUtil, "messageUtil", {
                    mock: ["receive"],
                    whitelist: ["register"],
                });
                const callback = (_param: string) => {};
                mock.receive.expect(event1, callback);
                const registered = messageUtil["register"]<(arg: string) => void>(event1);
                registered.receive(callback);
            });
        });
        describe("send", () => {
            it("should delegate to send", () => {
                const mock = mockAssimilate(messageUtil, "messageUtil", {
                    mock: ["send"],
                    whitelist: ["register"],
                });
                mock.send.expect(event1, [data1]);
                const registered = messageUtil["register"]<(arg: string) => void>(event1);
                registered.send(data1);
            });
        });
        describe("sendSelf", () => {
            it("should delegate to emitCallbacks", () => {
                const mock = mockAssimilate(messageUtil, "messageUtil", {
                    mock: ["emitCallbacks"],
                    whitelist: ["register"],
                });
                mock.emitCallbacks.expect(event1, [data1]);
                const registered = messageUtil["register"]<(arg: string) => void>(event1);
                registered.sendSelf(data1);
            });
        });
    });

    describe("send", () => {
        it("should delegate to mockBrowser.runtime.sendMessage", async () => {
            mockBrowser.runtime.sendMessage
                .expect({
                    action: event1,
                    params: [data1],
                })
                .andResolve({} as any); // fixme: mockzilla bug
            await messageUtil["send"](event1, [data1]);
        });
        it("should swallow exceptions", async () => {
            mockBrowser.runtime.sendMessage
                .expect({
                    action: event1,
                    params: [data1],
                })
                .andReject(new Error("Nothing to see here"));
            await messageUtil["send"](event1, [data1]);
        });
    });

    describe("emitCallbacks", () => {
        it("should do nothing if no callbacks registered", () => {
            whitelistPropertyAccess(messageUtil, "callbacksMap", "emitCallbacks");
            messageUtil["emitCallbacks"](event2, [data2]);
        });
        it("should call receive methods in order", () => {
            const spy = jest.fn();
            messageUtil["receive"](event1, (...args) => spy(1, ...args));
            messageUtil["receive"](event1, (...args) => spy(2, ...args));
            messageUtil["receive"](event2, (...args) => spy(3, ...args));
            messageUtil["receive"](event1, (...args) => spy(4, ...args));
            messageUtil["receive"](event2, (...args) => spy(5, ...args));

            messageUtil["emitCallbacks"](event1, [data1]);
            expect(spy.mock.calls).toEqual([
                [1, data1],
                [2, data1],
                [4, data1],
            ]);
            spy.mockClear();

            messageUtil["emitCallbacks"](event2, [data2]);
            expect(spy.mock.calls).toEqual([
                [3, data2],
                [5, data2],
            ]);
        });
        it("should not call the receiver if it has been canceled", () => {
            const spy = jest.fn();
            const receiver = messageUtil["receive"](event1, spy);
            receiver.destroy();

            messageUtil["emitCallbacks"](event1, [data1]);
            expect(spy).not.toHaveBeenCalled();
        });

        it("should only remove one listener upon receiver.destroy()", () => {
            const spy = jest.fn();
            const receiver = messageUtil["receive"](event1, spy);
            messageUtil["receive"](event2, spy);
            receiver.destroy();
            receiver.destroy();

            messageUtil["emitCallbacks"](event1, [data1]);
            expect(spy).not.toHaveBeenCalled();

            messageUtil["emitCallbacks"](event2, [data2]);
            expect(spy.mock.calls).toEqual([[data2]]);
        });
    });
});
