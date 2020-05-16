import { removeLeadingDot, getFirstPartyCookieDomain, getValidHostname } from "./domainUtils";

describe("DomainUtils", () => {
    describe("removeLeadingDot", () => {
        it("should remove the leading dot of a domain", () => {
            expect(removeLeadingDot(".hello.com")).toBe("hello.com");
        });
        it("should return the domain unchanged if it contains no leading dot", () => {
            expect(removeLeadingDot("www.hello.com")).toBe("www.hello.com");
        });
    });

    describe("getFirstPartyCookieDomain", () => {
        it("should return first party domains for valid cookie domains", () => {
            expect(getFirstPartyCookieDomain("www.google.com")).toBe("google.com");
            expect(getFirstPartyCookieDomain(".google.com")).toBe("google.com");
            expect(getFirstPartyCookieDomain("google.com")).toBe("google.com");
            expect(getFirstPartyCookieDomain(".michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
            expect(getFirstPartyCookieDomain("michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
            expect(getFirstPartyCookieDomain("hello.michelgagne.blogspot.de")).toBe("michelgagne.blogspot.de");
        });
    });

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
