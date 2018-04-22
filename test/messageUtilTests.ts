/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { createSpy, browserMock, SpyData } from "./BrowserMock";
import * as messageUtil from "../src/lib/messageUtil";
import { Runtime } from "webextension-polyfill-ts/src/generated/runtime";

interface CalledWithData {
    index: number;
    sender: Runtime.MessageSender;
    data: any;
}

describe("Message Utility", () => {
    const event1 = 'event1';
    const event2 = 'event2';
    const data1 = 'mydata1';
    const data2 = 'mydata2';

    describe("sendSelf", () => {
        it("should call receive methods in order", () => {
            const spy = createSpy();
            messageUtil.receive(event1, spy.bind(1));
            messageUtil.receive(event1, spy.bind(2));
            messageUtil.receive(event2, spy.bind(3));
            messageUtil.receive(event1, spy.bind(4));
            messageUtil.receive(event2, spy.bind(5));

            messageUtil.sendSelf(event1, data1);
            spy.assertCalls([
                [data1, {}],
                [data1, {}],
                [data1, {}]
            ], [1,2,4]);

            messageUtil.sendSelf(event2, data2);
            spy.assertCalls([
                [data2, {}],
                [data2, {}]
            ], [3,5]);
        });
    });

    describe("send", () => {
        it("should call receive methods in order", () => {
            
            const spy = createSpy();
            const sender = { id: 'mock' };
            messageUtil.receive(event1, spy.bind(1));
            messageUtil.receive(event1, spy.bind(2));
            messageUtil.receive(event2, spy.bind(3));
            messageUtil.receive(event1, spy.bind(4));
            messageUtil.receive(event2, spy.bind(5));

            messageUtil.send(event1, data1);
            spy.assertCalls([
                [data1, sender],
                [data1, sender],
                [data1, sender]
            ], [1,2,4]);

            messageUtil.send(event2, data2);
            spy.assertCalls([
                [data2, sender],
                [data2, sender]
            ], [3,5]);
        });
    });
});
