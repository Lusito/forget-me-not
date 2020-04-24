/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export const clone = (value: any) => JSON.parse(JSON.stringify(value));

export function booleanVariations(count: number) {
    const result: boolean[][] = [];
    const size = 2 ** count;
    for (let i = 0; i < size; i++) {
        const entry = i
            .toString(2)
            .split("")
            .map((b) => b !== "0");
        while (entry.length !== count) entry.unshift(false);
        result.push(entry);
    }
    return result;
}

// function getArgs(func: (...value: boolean[]) => void) {
//     const match = func.toString().match(/.*\(([^)]*)\)/);
//     if (!match) throw new Error("Can't detect argument names for function");

//     return match[1]
//         .split(",")
//         .map((arg: string) => arg.replace(/\/\*.*\*\//, "").trim())
//         .filter((arg: string) => arg);
// }

// export interface SimpleSuiteFunction<T> {
//     (callback: T): void;
//     only: (callback: T) => void;
// }
// function createSimpleSuiteFunction<T>(
//     wrapper: (context: (title: string, fn: () => void) => void, callback: T) => void
// ) {
//     const result: SimpleSuiteFunction<T> = (callback: T) => wrapper(describe, callback);
//     result.only = (callback: T) => wrapper(describe.only, callback);
//     return result;
// }

// export const booleanContext = createSimpleSuiteFunction<(...value: boolean[]) => void>((context, callback) => {
//     const names = getArgs(callback);
//     booleanVariations(names.length).forEach((booleans) => {
//         const label = `with ${booleans.map((value, index) => `${names[index]} = ${value}`).join(", ")}`;

//         context(label, () => callback(...booleans));
//     });
// });
