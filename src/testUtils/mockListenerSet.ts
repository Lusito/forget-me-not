import { MockzillaDeep } from "mockzilla";

// fixme: move to mockzilla
export class MockzillaListenerSet<T extends (...args: any[]) => any> {
    public readonly add: jest.SpyInstance<Set<T>, [T]>;

    public readonly delete: jest.SpyInstance<boolean, [T]>;

    private readonly set: Set<T>

    public constructor(set: Set<T>) {
        this.set = set;
        this.add = jest.spyOn(set, "add");
        this.delete = jest.spyOn(set, "delete");
    }

    public emit(...args: Parameters<T>) {
        this.set.forEach((listener) => listener(...args));
    };
}

export type MockzillaListenerSetOf<T> = T extends MockzillaDeep<Set<infer TD>>
    ? TD extends (...args: any[]) => any ? MockzillaListenerSet<TD> : unknown
    : unknown;

export function mockListenerSet<T extends (...args: any[]) => any>(builder: MockzillaDeep<Set<T>>) {
    const set = new Set<T>();
    const mock = new MockzillaListenerSet<T>(set);
    builder.mock(set);
    return mock;
}
