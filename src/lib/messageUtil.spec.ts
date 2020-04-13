/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { messageUtil } from "./messageUtil";

describe("Message Utility", () => {
    const event1 = "event1";
    const event2 = "event2";
    const data1 = "mydata1";
    const data2 = "mydata2";

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

    describe("send", () => {
        it("should call receive methods in order", async () => {
            const spy = jest.fn();
            const sender = { id: "mock" };
            messageUtil.receive(event1, (...args) => spy(1, ...args));
            messageUtil.receive(event1, (...args) => spy(2, ...args));
            messageUtil.receive(event2, (...args) => spy(3, ...args));
            messageUtil.receive(event1, (...args) => spy(4, ...args));
            messageUtil.receive(event2, (...args) => spy(5, ...args));

            await messageUtil.send(event1, data1);
            expect(spy.mock.calls).toEqual([
                [1, data1, sender],
                [2, data1, sender],
                [4, data1, sender],
            ]);
            spy.mockClear();

            await messageUtil.send(event2, data2);
            expect(spy.mock.calls).toEqual([
                [3, data2, sender],
                [5, data2, sender],
            ]);
        });
        it("should not call the receiver if it has been canceled", async () => {
            const spy = jest.fn();
            const receiver = messageUtil.receive(event1, spy);
            receiver.destroy();

            await messageUtil.send(event1, data1);
            expect(spy).not.toHaveBeenCalled();
        });
    });
});
