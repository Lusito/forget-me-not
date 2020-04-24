/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */
import chalk from "chalk";
import diff from "jest-diff";
import { iterableEquality } from "expect/build/utils";
import { equals } from "expect/build/jasmineUtils";

import { colorizeStack, DeepMockError } from "./deepMockUtils";
import { Expectation } from "./deepMockTypes";

const EXPECTATION = chalk.green("Expectation");
const ERROR = chalk.red("ERROR");

interface ChildMethod {
    type: "method";
    value: (...args: any[]) => any;
    expectations: Expectation[];
}

interface ChildValue {
    type: "value";
    value: any;
}

interface ChildNode {
    type: "node";
    value: any; // the Proxy instance
    node: DeepMockNode;
}

type ChildType = ChildValue | ChildMethod | ChildNode;

export class DeepMockNode {
    private readonly path: string;

    private readonly proxy: any;

    private disabled = false;

    private children: { [s: string]: ChildType } = {};

    public constructor(path: string) {
        this.path = path;
        this.proxy = new Proxy(
            {},
            {
                ownKeys: () => {
                    this.disabledCheck("ownKeys");
                    return Object.getOwnPropertyNames(this.children);
                },
                has: (target: any, prop: string) => this.disabledCheck(prop) || prop in this.children || false,
                get: (target: any, prop: string) => {
                    this.disabledCheck(prop);
                    if (prop in this.children) return this.children[prop].value;
                    this.notImplemented(prop);
                },
                // not to be called
                apply: () => this.disabledCheckNotImplemented("apply", undefined),
                getPrototypeOf: () => this.disabledCheckNotImplemented("getPrototypeOf", null),
                setPrototypeOf: () => this.disabledCheckNotImplemented("setPrototypeOf", false),
                isExtensible: () => this.disabledCheckNotImplemented("isExtensible", false),
                preventExtensions: () => this.disabledCheckNotImplemented("preventExtensions", false),
                set: () => this.disabledCheckNotImplemented("set", false),
                deleteProperty: () => this.disabledCheckNotImplemented("deleteProperty", false),
                construct: () => this.disabledCheckNotImplemented("construct", {}),
                getOwnPropertyDescriptor: () => this.disabledCheckNotImplemented("getOwnPropertyDescriptor", undefined),
                defineProperty: () => this.disabledCheckNotImplemented("defineProperty", false),
            }
        );
    }

    private pathTo = (key: string) => (key ? `${this.path}.${key}` : this.path);

    private notImplemented(what: string) {
        throw new DeepMockError(`Mock "${this.pathTo(what)}" is not implemented`);
    }

    private disabledCheck(what: string) {
        if (this.disabled)
            throw new DeepMockError(`Mock "${this.pathTo(what)}" has been used after tests have finished!`);
        return false;
    }

    private disabledCheckNotImplemented<T>(what: string, ret: T) {
        this.disabledCheck(what) || this.notImplemented(what);
        return ret;
    }

    private getNested(keys: string[]) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nestedKey = keys.pop()!;
        const nestedNode = keys.reduce((node, key) => node.getChildNode(key), this as DeepMockNode);
        return [nestedKey, nestedNode] as const;
    }

    public allow(key: string) {
        const parts = key.split(".");
        if (parts.length > 1) {
            const [nestedKey, nestedNode] = this.getNested(parts);
            nestedNode.allow(nestedKey);
            return;
        }
        this.getChildNode(key);
    }

    public setValue(key: string, value: any) {
        const parts = key.split(".");
        if (parts.length > 1) {
            const [nestedKey, nestedNode] = this.getNested(parts);
            nestedNode.setValue(nestedKey, value);
            return;
        }
        let child = this.getChild(key, "value");
        if (!child) {
            child = {
                type: "value",
                value,
            };
            this.children[key] = child;
        }
    }

    public addExpectation(key: string, expectation: Expectation | null) {
        const parts = key.split(".");
        if (parts.length > 1) {
            const [nestedKey, nestedConfig] = this.getNested(parts);
            nestedConfig.addExpectation(nestedKey, expectation);
            return;
        }

        let child = this.getChild(key, "method");
        if (!child) {
            child = this.createMethod(key);
            this.children[key] = child;
        }
        if (expectation) child.expectations.push(expectation);
    }

    private getChild(key: string, type: ChildMethod["type"]): ChildMethod | null;

    private getChild(key: string, type: ChildValue["type"]): ChildValue | null;

    private getChild(key: string, type: ChildNode["type"]): ChildNode | null;

    private getChild(key: string, type: ChildType["type"]): ChildType | null {
        const child = this.children[key];
        if (!child) return null;
        if (child.type !== type)
            throw new DeepMockError(`Expect a mock ${type}, but found a mock ${child.type} at ${this.path}.${key}`);
        return child;
    }

    private createMethod(key: string): ChildMethod {
        const name = chalk.dim(`${this.pathTo(key)}()`);
        const expectations: Expectation[] = [];
        return {
            type: "method",
            value(...args: any[]) {
                const expectation = expectations.shift();
                if (!expectation) {
                    throw new DeepMockError(`${ERROR}: ${name} has been called unexpectedly!`);
                }
                if (expectation.spy) return expectation.spy(...args);
                if (expectation.args) {
                    if (!equals(args, expectation.args, [iterableEquality])) {
                        const title = `Expectation of call to ${name} did not match invocation`;
                        const expectationStack = colorizeStack(expectation.stack, true);
                        const argsDiff = diff(expectation.args, args);
                        throw new DeepMockError(
                            `${EXPECTATION}: ${expectationStack}\n  \n${ERROR}: ${title}:\n${argsDiff}`
                        );
                    }
                }
                if (expectation.throws) throw expectation.throws;
                return expectation.returns;
            },
            expectations,
        };
    }

    private getChildNode(key: string) {
        let child = this.getChild(key, "node");
        if (!child) {
            const node = new DeepMockNode(this.pathTo(key));
            child = {
                type: "node",
                value: node.proxy,
                node,
            };
            this.children[key] = child;
        }
        return child.node;
    }

    public getProxy() {
        return this.proxy;
    }

    public disable() {
        this.disabled = true;
        for (const key of Object.keys(this.children)) {
            const child = this.children[key];
            if (child.type === "node") child.node.disable();
        }
        this.children = {};
    }

    public enable() {
        this.disabled = false;
    }

    public verify() {
        for (const key of Object.keys(this.children)) {
            const child = this.children[key];
            if (child.type === "node") {
                child.node.verify();
            } else if (child.type === "method") {
                const { expectations } = child;
                if (expectations.length) {
                    const callName = `${this.pathTo(key)}()`;
                    const uniqueExpectations = expectations.filter((e, i, self) => self.indexOf(e) === i);
                    throw new DeepMockError(
                        `Missing ${expectations.length} calls to ${chalk.dim(
                            callName
                        )}:\n${uniqueExpectations
                            .map((expectation) => colorizeStack(expectation.stack, true))
                            .join("\n")}`,
                        true
                    );
                }
            }
        }
    }

    public verifyAndDisable() {
        try {
            this.verify();
        } finally {
            this.disable();
        }
    }
}
