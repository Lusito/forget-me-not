export function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

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

function getArgs(func: (...value: boolean[]) => void): string[] {
    const match = func.toString().match(/[^(]*\(([^)]*)\)/);
    if (!match || !match[1]) throw new Error("Can't detect argument names for function");

    return match[1]
        .split(",")
        .map((arg: string) => arg.replace(/\/\*.*\*\//, "").trim())
        .filter((arg: string) => arg);
}

function setupEachBoolean(each: jest.Each) {
    return (text: string, callback: (...value: boolean[]) => any) => {
        const names = getArgs(callback);
        const booleans = booleanVariations(names.length);
        const labels = names.map((name) => `${name}=%j`).join(", ");
        // eslint-disable-next-line jest/valid-describe
        each(booleans)(text.replace("%s", labels), callback);
    };
}

export function setupJestEachBoolean() {
    describe.each.boolean = setupEachBoolean(describe.each);
    describe.only.each.boolean = setupEachBoolean(describe.only.each);
    it.each.boolean = setupEachBoolean(it.each);
    it.only.each.boolean = setupEachBoolean(it.only.each);
}
