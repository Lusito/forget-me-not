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
