import { AssimilatedMockMap } from "./deepMockTypes";
import { DeepMockError } from "./deepMockUtils";
import { quickDeepMock } from "./deepMock";
import { DeepMockNode } from "./deepMockNode";

export function denyPropertyAccess<T>(instance: T, property: string) {
    Object.defineProperty(instance, property, {
        get() {
            throw new DeepMockError(`Property "${property}" was expected to be left ontouched`);
        },
        set() {
            throw new DeepMockError(`Property "${property}" was expected to be left ontouched`);
        },
    });
}

function getProperties(obj: any) {
    const properties = new Set<string>();
    for (let current = obj; Object.getPrototypeOf(current); current = Object.getPrototypeOf(current))
        Object.getOwnPropertyNames(current).forEach((item) => properties.add(item));
    properties.delete("constructor");
    return [...properties.keys()];
}

export function whitelistPropertyAccess(instance: any, ...whitelist: string[]) {
    for (const property of getProperties(instance)) {
        if (!whitelist.includes(property)) denyPropertyAccess(instance, property);
    }
}

const assimilatedNodes: DeepMockNode[] = [];

export function mockAssimilate<T extends { [s: string]: any }, TKey extends string>(
    instance: T,
    mockKeys: TKey[],
    whitelist?: string[]
): AssimilatedMockMap<Pick<T, TKey>> {
    const [proxy, mock, node] = quickDeepMock<T>("assimilated"); // fixme: name
    // fixme: validate, that every part of mocks is in property
    for (const property of getProperties(instance)) {
        if (mockKeys.includes(property as TKey)) {
            mock[property].mockAllowMethod();
            (instance as any)[property] = proxy[property];
        } else if (whitelist && !whitelist.includes(property as TKey)) denyPropertyAccess(instance, property);
    }

    assimilatedNodes.push(node);
    return mock;
}

afterEach(() => {
    for (const node of assimilatedNodes) node.verifyAndDisable();
});
