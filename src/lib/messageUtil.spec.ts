/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil } from "./messageUtil";
import { mockEvent, EventMockOf } from "../testUtils/mockBrowser";

describe("Message Utility", () => {
    const event1 = "event1";
    const event2 = "event2";
    const data1 = "mydata1";
    const data2 = "mydata2";
    const sender = { id: "mock" };
    let onMessage: EventMockOf<typeof mockBrowser.runtime.onMessage>;

    beforeEach(() => {
        onMessage = mockEvent(mockBrowser.runtime.onMessage);
    });
    afterEach(() => {
        onMessage.disable();
    });

    describe("sendSelf", () => {
        it("should call receive methods in order", () => {
            const spy = jest.fn();
            messageUtil.receive(event1, (...args) => spy(1, ...args));
            messageUtil.receive(event1, (...args) => spy(2, ...args));
            messageUtil.receive(event2, (...args) => spy(3, ...args));
            messageUtil.receive(event1, (...args) => spy(4, ...args));
            messageUtil.receive(event2, (...args) => spy(5, ...args));

            messageUtil.sendSelf(event1, data1);
            expect(spy.mock.calls).toEqual([
                [1, data1, {}],
                [2, data1, {}],
                [4, data1, {}],
            ]);
            spy.mockClear();

            messageUtil.sendSelf(event2, data2);
            expect(spy.mock.calls).toEqual([
                [3, data2, {}],
                [5, data2, {}],
            ]);
        });
        it("should not call the receiver if it has been canceled", () => {
            const spy = jest.fn();
            const receiver = messageUtil.receive(event1, spy);
            receiver.destroy();

            messageUtil.sendSelf(event1, data1);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe("sendMessage", () => {
        it("should call receive methods in order", async () => {
            mockBrowser.runtime.sendMessage
                .expect({
                    action: event1,
                    params: data1,
                })
                .andResolve({});
            await messageUtil.send(event1, data1);
        });
    });

    describe("onMessage", () => {
        it("should call receive methods in order", () => {
            const spy = jest.fn();
            messageUtil.receive(event1, (...args) => spy(1, ...args));
            messageUtil.receive(event1, (...args) => spy(2, ...args));
            messageUtil.receive(event2, (...args) => spy(3, ...args));
            messageUtil.receive(event1, (...args) => spy(4, ...args));
            messageUtil.receive(event2, (...args) => spy(5, ...args));

            onMessage.emit(
                {
                    action: event1,
                    params: data1,
                },
                sender
            );
            expect(spy.mock.calls).toEqual([
                [1, data1, sender],
                [2, data1, sender],
                [4, data1, sender],
            ]);
            spy.mockClear();

            onMessage.emit(
                {
                    action: event2,
                    params: data2,
                },
                sender
            );
            expect(spy.mock.calls).toEqual([
                [3, data2, sender],
                [5, data2, sender],
            ]);
        });
        it("should not call the receiver if it has been canceled", () => {
            const spy = jest.fn();
            const receiver = messageUtil.receive(event1, spy);
            receiver.destroy();

            onMessage.emit(
                {
                    action: event1,
                    params: data1,
                },
                sender
            );
            expect(spy).not.toHaveBeenCalled();
        });
    });
});
