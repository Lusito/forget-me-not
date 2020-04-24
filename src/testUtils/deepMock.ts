import { DeepMockNode } from "./deepMockNode";
import { getCleanStack, DeepMockError } from "./deepMockUtils";
import { DeepMock, Expectation } from "./deepMockTypes";

interface Target {
    path: string;
    children: { [key: string]: any };
    rootNode: DeepMockNode;
}

const createTimes = (target: Target, expectation: Expectation) => (callCount: number) => {
    while (--callCount > 0) target.rootNode.addExpectation(target.path, expectation);
};

const notAllowed = (name: string) => () => {
    throw new DeepMockError(`Error: It's not allowed to use ${name} on a mock builder.`);
};

const builderHandler: ProxyHandler<Target> = {
    get(target, prop) {
        if (prop === "expect") {
            const expectation: Expectation = {
                stack: getCleanStack(),
            };
            target.rootNode.addExpectation(target.path, expectation);
            const expect = Object.assign(
                (...args: any[]) => {
                    expectation.args = args;
                    return expect;
                },
                {
                    andResolve: (result: any) => {
                        expectation.returns = Promise.resolve(result);
                        return expect;
                    },
                    andReject: (error: Error) => {
                        expectation.returns = Promise.reject(error);
                        return expect;
                    },
                    andReturn: (result: any) => {
                        expectation.returns = result;
                        return expect;
                    },
                    andThrow: (error: Error) => {
                        expectation.throws = error;
                        return expect;
                    },
                    times: createTimes(target, expectation),
                }
            );
            return expect;
        }
        if (prop === "spy") {
            return (spy: any) => {
                const expectation: Expectation = { spy, stack: getCleanStack() };
                target.rootNode.addExpectation(target.path, expectation);
                return { times: createTimes(target, expectation) };
            };
        }
        if (prop === "mock") {
            return (value: any) => target.rootNode.setValue(target.path, value);
        }
        if (prop === "mockAllow") {
            return () => target.rootNode.allow(target.path);
        }
        if (prop === "mockAllowMethod") {
            return () => target.rootNode.addExpectation(target.path, null);
        }
        if (prop === "mockPath") {
            return target.path;
        }
        const key = prop.toString();
        let child = target.children[key];
        if (!child) {
            const path = target.path ? `${target.path}.${key}` : key;
            child = new Proxy({ path, children: {}, rootNode: target.rootNode }, builderHandler);
            target.children[key] = child;
        }
        return child;
    },
    // not to be called
    apply: notAllowed("apply"),
    ownKeys: notAllowed("ownKeys"),
    has: notAllowed("has"),
    getPrototypeOf: notAllowed("getPrototypeOf"),
    setPrototypeOf: notAllowed("setPrototypeOf"),
    isExtensible: notAllowed("isExtensible"),
    preventExtensions: notAllowed("preventExtensions"),
    set: notAllowed("set"),
    deleteProperty: notAllowed("deleteProperty"),
    construct: notAllowed("construct"),
    getOwnPropertyDescriptor: notAllowed("getOwnPropertyDescriptor"),
    defineProperty: notAllowed("defineProperty"),
};

export function deepMock<T>(rootNode: DeepMockNode): DeepMock<T> {
    return new Proxy({ path: "", children: {}, rootNode }, builderHandler) as any;
}

export function quickDeepMock<T>(name: string) {
    const rootNode = new DeepMockNode(name);
    const proxy: T = rootNode.getProxy();
    const mock = deepMock<T>(rootNode);
    return [proxy, mock, rootNode] as const;
}
