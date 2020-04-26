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

export function mockAssimilate<T extends { [key: string]: (...args: any[]) => any }>(
    instance: any,
    mocks: T,
    whitelist?: string[]
): AssimilatedMockMap<T> {
    const [proxy, mock, node] = quickDeepMock<T>("assimilated");
    // fixme: validate, that every part of mocks is in property
    for (const property of getProperties(instance)) {
        if (Object.prototype.hasOwnProperty.call(mocks, property)) {
            mock[property].mockAllowMethod();
            instance[property] = proxy[property];
        } else if (!whitelist?.includes(property)) denyPropertyAccess(instance, property);
    }

    assimilatedNodes.push(node);
    return mock;
}

afterEach(() => {
    for (const node of assimilatedNodes) node.verifyAndDisable();
});
