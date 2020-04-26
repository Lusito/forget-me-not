// eslint-disable-next-line import/no-extraneous-dependencies
import { stringify } from "jest-matcher-utils";
import { parse as parseUrl, UrlWithStringQuery } from "url";
import "@abraham/reflection";
import { container } from "tsyringe";

import { browser } from "./mockBrowser";

import "./time";

jest.mock("webextension-polyfill-ts", () => ({ browser }));

(window as any).URL = function URL(url: string) {
    const parsed = parseUrl(url);
    for (const key in parsed) {
        if (key in parsed) this[key] = parsed[key as keyof UrlWithStringQuery];
    }
};

const failExpectation = (message: () => string) => ({ pass: false, message });

expect.extend({
    toHaveSameMembers(actualArray: any[], expectedArray: any[]) {
        if (actualArray.length !== expectedArray.length) {
            return failExpectation(
                () =>
                    `Actual array length (${actualArray.length}) does not match expected array length (${expectedArray.length})`
            );
        }
        const remaining = actualArray.slice();
        const notFound = expectedArray.find((entry) => {
            const otherIndex = remaining.indexOf(entry);
            if (otherIndex < 0) return true;
            remaining.splice(otherIndex, 1);
            return false;
        });
        if (notFound >= 0)
            return failExpectation(() => `Array did not contain ${stringify(notFound)} from expected array`);

        return {
            pass: true,
            message: () => "",
        };
    },
    toHaveSameOrderedMembers(actualArray: any[], expectedArray: any[]) {
        if (actualArray.length !== expectedArray.length) {
            return failExpectation(
                () =>
                    `Actual array length (${actualArray.length}) does not match expected array length (${expectedArray.length})`
            );
        }
        const index = actualArray.findIndex((entry, i) => entry !== expectedArray[i]);
        if (index >= 0) {
            return {
                pass: false,
                message: () =>
                    `Expected array did match at index ${index}: \n\n` +
                    `Found: ${stringify(actualArray[index])}\n\n` +
                    `Expected: ${stringify(expectedArray[index])}`,
            };
        }

        return {
            pass: true,
            message: () => "",
        };
    },
});

beforeEach(() => {
    container.reset();
});
