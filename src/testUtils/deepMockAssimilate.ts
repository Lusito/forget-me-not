import { AssimilatedMockMap } from "./deepMockTypes";
import { DeepMockError } from "./deepMockUtils";
import { quickDeepMock } from "./deepMock";

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

export function mockAssimilate<T extends { [s: string]: any }, TKey extends string>(
    instance: T,
    mockKeys: TKey[],
    whitelist?: string[]
): AssimilatedMockMap<Pick<T, TKey>> {
    const name = "assimilated";// fixme: name
    const [proxy, mock] = quickDeepMock<T>(name);
    const properties = getProperties(instance);
    
    // Validate, that every mock is in properties
    for(const key of mockKeys) {
        if (!properties.includes(key as TKey))
            throw new DeepMockError(`Property "${key}" does not exist on ${name}, so it can't be assimilated`);
        else if (typeof instance[key] !== "function")
            throw new DeepMockError(`Property "${key}" on ${name} is not a function, so it can't be assimilated`);
    }
    
    // Validate, that every whitelist item is in properties
    if (whitelist) {
        for(const key of whitelist) {
            if (!properties.includes(key as TKey))
                throw new DeepMockError(`Property "${key}" does not exist on ${name}, so it can't be whitelisted`);
        }
    }

    for (const property of properties) {
        if (mockKeys.includes(property as TKey)) {
            mock[property].mockAllowMethod();
            (instance as any)[property] = proxy[property];
        } else if (whitelist && !whitelist.includes(property as TKey)) denyPropertyAccess(instance, property);
    }

    return mock;
}
