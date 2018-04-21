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
            let calledWith: CalledWithData[] = [];
            messageUtil.receive(event1, (data, sender) => {
                calledWith.push({ index: 1, data, sender });
            });
            messageUtil.receive(event1, (data, sender) => {
                calledWith.push({ index: 2, data, sender });
            });
            messageUtil.receive(event2, (data, sender) => {
                calledWith.push({ index: 3, data, sender });
            });
            messageUtil.receive(event1, (data, sender) => {
                calledWith.push({ index: 4, data, sender });
            });
            messageUtil.receive(event2, (data, sender) => {
                calledWith.push({ index: 5, data, sender });
            });
            messageUtil.sendSelf(event1, data1);
            assert.deepEqual(calledWith, [
                { index: 1, data: data1, sender: {} },
                { index: 2, data: data1, sender: {} },
                { index: 4, data: data1, sender: {} }
            ]);
            calledWith = [];
            messageUtil.sendSelf(event2, data2);
            assert.deepEqual(calledWith, [
                { index: 3, data: data2, sender: {} },
                { index: 5, data: data2, sender: {} }
            ]);
        });
    });

    describe("send", () => {
        it("should call receive methods in order", () => {
            let calledWith: CalledWithData[] = [];
            messageUtil.receive(event1, (data, sender) => {
                calledWith.push({ index: 1, data, sender });
            });
            messageUtil.receive(event1, (data, sender) => {
                calledWith.push({ index: 2, data, sender });
            });
            messageUtil.receive(event2, (data, sender) => {
                calledWith.push({ index: 3, data, sender });
            });
            messageUtil.receive(event1, (data, sender) => {
                calledWith.push({ index: 4, data, sender });
            });
            messageUtil.receive(event2, (data, sender) => {
                calledWith.push({ index: 5, data, sender });
            });
            messageUtil.send(event1, data1);
            assert.deepEqual(calledWith, [
                { index: 1, data: data1, sender: { id: 'mock' } },
                { index: 2, data: data1, sender: { id: 'mock' } },
                { index: 4, data: data1, sender: { id: 'mock' } }
            ]);
            calledWith = [];
            messageUtil.send(event2, data2);
            assert.deepEqual(calledWith, [
                { index: 3, data: data2, sender: { id: 'mock' } },
                { index: 5, data: data2, sender: { id: 'mock' } }
            ]);
        });
    });
});
