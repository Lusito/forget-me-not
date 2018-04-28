/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { createSpy, browserMock } from "./browserMock";
import { messageUtil, ReceiverHandle } from "../src/lib/messageUtil";
import { destroyAllAndEmpty } from "../src/shared";

describe("Message Utility", () => {
    const receivers: ReceiverHandle[] = [];
    beforeEach(() => browserMock.reset());
    afterEach(() => {
        destroyAllAndEmpty(receivers);
    });
    const event1 = "event1";
    const event2 = "event2";
    const data1 = "mydata1";
    const data2 = "mydata2";

    describe("sendSelf", () => {
        it("should call receive methods in order", () => {
            const spy = createSpy();
            receivers.push(messageUtil.receive(event1, spy.bind(1)));
            receivers.push(messageUtil.receive(event1, spy.bind(2)));
            receivers.push(messageUtil.receive(event2, spy.bind(3)));
            receivers.push(messageUtil.receive(event1, spy.bind(4)));
            receivers.push(messageUtil.receive(event2, spy.bind(5)));

            messageUtil.sendSelf(event1, data1);
            spy.assertCalls([
                [data1, {}],
                [data1, {}],
                [data1, {}]
            ], [1, 2, 4]);

            messageUtil.sendSelf(event2, data2);
            spy.assertCalls([
                [data2, {}],
                [data2, {}]
            ], [3, 5]);
        });
        it("should not call the receiver if it has been canceled", () => {
            const spy = createSpy();
            const receiver = messageUtil.receive(event1, spy);
            receiver.destroy();

            messageUtil.sendSelf(event1, data1);
            spy.assertNoCall();
        });
    });

    describe("send", () => {
        it("should call receive methods in order", () => {
            const spy = createSpy();
            const sender = { id: "mock" };
            receivers.push(messageUtil.receive(event1, spy.bind(1)));
            receivers.push(messageUtil.receive(event1, spy.bind(2)));
            receivers.push(messageUtil.receive(event2, spy.bind(3)));
            receivers.push(messageUtil.receive(event1, spy.bind(4)));
            receivers.push(messageUtil.receive(event2, spy.bind(5)));

            messageUtil.send(event1, data1);
            spy.assertCalls([
                [data1, sender],
                [data1, sender],
                [data1, sender]
            ], [1, 2, 4]);

            messageUtil.send(event2, data2);
            spy.assertCalls([
                [data2, sender],
                [data2, sender]
            ], [3, 5]);
        });
        it("should not call the receiver if it has been canceled", () => {
            const spy = createSpy();
            const receiver = messageUtil.receive(event1, spy);
            receiver.destroy();

            messageUtil.send(event1, data1);
            spy.assertNoCall();
        });
    });
});
