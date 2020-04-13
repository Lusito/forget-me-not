/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { getValidHostname } from "./shared";

describe("Shared", () => {
    describe("getValidHostname", () => {
        it("should return hostnames for valid urls", () => {
            expect(getValidHostname("http://www.google.com")).toBe("www.google.com");
            expect(getValidHostname("https://www.google.com")).toBe("www.google.com");
        });
        it("should return emptystring for invalid urls", () => {
            expect(getValidHostname("hhttp://www.google.com")).toBe("");
            expect(getValidHostname("httpss://www.google.com")).toBe("");
            expect(getValidHostname("file://www.google.com")).toBe("");
            expect(getValidHostname("chrome://www.google.com")).toBe("");
            expect(getValidHostname("about:preferences")).toBe("");
            expect(getValidHostname("Bu][$<|-|!7")).toBe("");
            expect(getValidHostname(null as any)).toBe("");
        });
    });
});
