/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export const clone = (value: any) => JSON.parse(JSON.stringify(value));

function booleanVariations(count: number) {
    const result: boolean[][] = [];
    const size = Math.pow(2, count);
    for (let i = 0; i < size; i++) {
        const entry = i.toString(2).split("").map((b) => b === "0" ? false : true);
        while (entry.length !== count)
            entry.unshift(false);
        result.push(entry);
    }
    return result;
}

function getArgs(func: (...value: boolean[]) => void) {
    const match = func.toString().match(/.*\(([^)]*)\)/);
    if (!match) throw new Error("Can't detect argument names for function");

    return match[1].split(",")
        .map((arg: string) => arg.replace(/\/\*.*\*\//, "").trim())
        .filter((arg: string) => arg);
}

export interface SimpleSuiteFunction<T> { (callback: T): void; only: (callback: T) => void; }
function createSimpleSuiteFunction<T>(wrapper: (context: (title: string, fn: () => void) => void, callback: T) => void) {
    const result: SimpleSuiteFunction<T> = (callback: T) => wrapper(describe, callback);
    result.only = (callback: T) => wrapper(describe.only, callback);
    return result;
}

export const booleanContext = createSimpleSuiteFunction<(...value: boolean[]) => void>((context, callback) => {
    const names = getArgs(callback);
    booleanVariations(names.length).forEach((booleans) => {
        const label = "with " + booleans.map((value, index) => `${names[index]} = ${value}`).join(", ");

        context(label, () => callback.apply(null, booleans));
    });
});

type ContextWithResultRow<CT, RT> = { context: CT, result: RT };

export function contextWithResult<CT, RT>(name: string, rows: Array<ContextWithResultRow<CT, RT>>, callback: (context: CT, result: RT) => void) {
    rows.forEach((row) => describe(`with ${name} = ${row.context}`, () => callback(row.context, row.result)));
}

// tslint:disable-next-line:no-namespace
export namespace contextWithResult {
    export function only<CT, RT>(name: string, rows: Array<ContextWithResultRow<CT, RT>>, callback: (context: CT, result: RT) => void) {
        rows.forEach((row) => describe.only(`with ${name} = ${row.context}`, () => callback(row.context, row.result)));
    }
}
