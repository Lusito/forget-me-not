/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";

export interface SpyData {
    (...args: any[]): any;
    callCount: number;
    thisValues: any[];
    args: any[][];
    assertCalls: (args: any[], thisValues?: any[]) => void;
    assertNoCall: () => void;
    reset: () => void;
}

// tslint:disable-next-line:ban-types
export function createSpy(wrappedFunction?: Function) {
    const spyData = function (...args: any[]) {
        spyData.callCount++;
        // @ts-ignore
        spyData.thisValues.push(this);
        spyData.args.push(Array.from(args));

        if (wrappedFunction) {
            // @ts-ignore
            return wrappedFunction.apply(this, args);
        }
    } as SpyData;
    spyData.callCount = 0;
    spyData.thisValues = [];
    spyData.args = [];
    spyData.assertCalls = (args, thisValues?) => {
        assert.deepEqual(spyData.args, args);
        if (thisValues)
            assert.deepEqual(spyData.thisValues, thisValues);
        spyData.reset();
    };
    spyData.assertNoCall = () => {
        assert.equal(spyData.callCount, 0);
    };

    spyData.reset = () => {
        spyData.callCount = 0;
        spyData.thisValues.length = 0;
        spyData.args.length = 0;
    };
    return spyData;
}

export const clone = (value: any) => JSON.parse(JSON.stringify(value));

export function ensureNotNull<T>(value: T | null): T {
    assert.isNotNull(value);
    // @ts-ignore
    return value;
}

// tslint:disable-next-line:ban-types
export function doneHandler<T extends Function>(handler: T, done: MochaDone, doneCondition?: () => boolean) {
    return (...args: any[]) => {
        try {
            handler.apply(null, args);
            if (!doneCondition || doneCondition())
                done();
        } catch (e) {
            done(e);
        }
    };
}
