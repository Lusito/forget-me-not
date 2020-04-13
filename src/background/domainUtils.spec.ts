/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { DomainUtils } from "./domainUtils";

describe("Domain Utils", () => {
    const utils = new DomainUtils();
    describe("getFirstPartyCookieDomain", () => {
        it("should return first party domains for valid cookie domains", () => {
            expect(utils.getFirstPartyCookieDomain("www.google.com")).toBe("google.com");
            expect(utils.getFirstPartyCookieDomain(".google.com")).toBe("google.com");
            expect(utils.getFirstPartyCookieDomain("google.com")).toBe("google.com");
            expect(utils.getFirstPartyCookieDomain(".michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
            expect(utils.getFirstPartyCookieDomain("michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
            expect(utils.getFirstPartyCookieDomain("hello.michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
        });
    });

    describe("getValidHostname", () => {
        it("should return hostnames for valid urls", () => {
            expect(utils.getValidHostname("http://www.google.com")).toBe("www.google.com");
            expect(utils.getValidHostname("https://www.google.com")).toBe("www.google.com");
        });
        it("should return emptystring for invalid urls", () => {
            expect(utils.getValidHostname("hhttp://www.google.com")).toBe("");
            expect(utils.getValidHostname("httpss://www.google.com")).toBe("");
            expect(utils.getValidHostname("file://www.google.com")).toBe("");
            expect(utils.getValidHostname("chrome://www.google.com")).toBe("");
            expect(utils.getValidHostname("about:preferences")).toBe("");
            expect(utils.getValidHostname("Bu][$<|-|!7")).toBe("");
            expect(utils.getValidHostname(null as any)).toBe("");
        });
    });
});
