import { FrameInfo } from "./frameInfo";

describe("FrameInfo", () => {
    let frameInfo: FrameInfo | null = null;

    afterEach(() => {
        frameInfo = null;
    });

    beforeEach(() => {
        frameInfo = new FrameInfo();
    });

    describe("collectHostnames", () => {
        const hostnames = new Set<string>();

        beforeEach(() => hostnames.clear());

        it("should not add anything if no hostname has been set yet", () => {
            frameInfo!.collectHostnames(hostnames);
            expect(hostnames.size).toBe(0);
        });
        it("should not add anything if navigating from empty hostname to empty hostname", () => {
            frameInfo!.prepareNavigation("");
            frameInfo!.collectHostnames(hostnames);
            expect(hostnames.size).toBe(0);
        });
        it("should add hostname if committed", () => {
            frameInfo!.commitNavigation("www.google.com");
            frameInfo!.collectHostnames(hostnames);
            expect(Array.from(hostnames.values())).toHaveSameMembers(["www.google.com"]);
        });
        it("should add nextHostname if navigating", () => {
            frameInfo!.commitNavigation("www.google.com");
            frameInfo!.prepareNavigation("www.amazon.com");
            frameInfo!.collectHostnames(hostnames);
            expect(Array.from(hostnames.values())).toHaveSameMembers(["www.google.com", "www.amazon.com"]);
        });
        it("should keep existing hostnames", () => {
            hostnames.add("www.amazon.com");
            frameInfo!.collectHostnames(hostnames);
            expect(Array.from(hostnames.values())).toHaveSameMembers(["www.amazon.com"]);
            frameInfo!.commitNavigation("www.google.com");
            frameInfo!.collectHostnames(hostnames);
            expect(Array.from(hostnames.values())).toHaveSameMembers(["www.amazon.com", "www.google.com"]);
            hostnames.clear();
            hostnames.add("www.amazon.com");
            frameInfo!.prepareNavigation("www.github.com");
            frameInfo!.collectHostnames(hostnames);
            expect(Array.from(hostnames.values())).toHaveSameMembers([
                "www.amazon.com",
                "www.google.com",
                "www.github.com",
            ]);
        });
    });

    // fixme: matchRegexFP

    describe("matchHostname", () => {
        it("should return true if hostname matches, no matter of the checkNext argument", () => {
            frameInfo!.commitNavigation("www.google.com");
            expect(frameInfo!.matchHostname("www.google.com", true)).toBe(true);
            expect(frameInfo!.matchHostname("www.google.com", false)).toBe(true);
        });
        it("should return false if hostname does not match, no matter of the checkNext argument", () => {
            frameInfo!.commitNavigation("www.google.com");
            expect(frameInfo!.matchHostname("google.com", true)).toBe(false);
            expect(frameInfo!.matchHostname("google.com", false)).toBe(false);
        });
        it("should return true if nextHostname matches and checkNext = true", () => {
            frameInfo!.commitNavigation("www.google.com");
            frameInfo!.prepareNavigation("www.amazon.com");
            expect(frameInfo!.matchHostname("www.amazon.com", true)).toBe(true);
            expect(frameInfo!.matchHostname("www.amazon.com", false)).toBe(false);
            expect(frameInfo!.matchHostname("amazon.com", true)).toBe(false);
        });
    });

    describe("matchHostnameFP", () => {
        it("should return true if hostnameFP or nextHostnameFP matches", () => {
            frameInfo!.commitNavigation("www.google.com");
            frameInfo!.prepareNavigation("www.amazon.com");
            expect(frameInfo!.matchHostnameFP("www.google.com")).toBe(false);
            expect(frameInfo!.matchHostnameFP("www.amazon.com")).toBe(false);
            expect(frameInfo!.matchHostnameFP("google.com")).toBe(true);
            expect(frameInfo!.matchHostnameFP("amazon.com")).toBe(true);
        });
    });

    describe("prepareNavigation", () => {
        it("should set lastTimeStamp with Date.now()", () => {
            expect((frameInfo as any).lastTimeStamp).toBe(0);
            frameInfo!.prepareNavigation("www.google.com");
            expect(Math.abs(Date.now() - (frameInfo as any).lastTimeStamp)).toBeLessThan(10);
        });
        it("should return previous value of nextHostname", () => {
            expect(frameInfo!.prepareNavigation("www.google.com")).toBe("");
            expect(frameInfo!.prepareNavigation("www.amazon.com")).toBe("www.google.com");
            expect(frameInfo!.prepareNavigation("www.github.com")).toBe("www.amazon.com");
            frameInfo!.commitNavigation("www.amazon.com");
            expect(frameInfo!.prepareNavigation("www.google.com")).toBe("");
        });
    });

    describe("commitNavigation", () => {
        it("should set lastTimeStamp with Date.now()", () => {
            expect((frameInfo as any).lastTimeStamp).toBe(0);
            frameInfo!.commitNavigation("www.google.com");
            expect(Math.abs(Date.now() - (frameInfo as any).lastTimeStamp)).toBeLessThan(10);
        });
        it("should set nextHostname and nextHostnameFP to empty string", () => {
            frameInfo!.prepareNavigation("www.amazon.com");
            expect((frameInfo as any).nextHostname).toBe("www.amazon.com");
            expect((frameInfo as any).nextHostnameFP).toBe("amazon.com");
            frameInfo!.commitNavigation("www.google.com");
            expect((frameInfo as any).nextHostname).toBe("");
            expect((frameInfo as any).nextHostnameFP).toBe("");
        });
    });

    describe("isIdle", () => {
        it("should return true initially", () => {
            expect(frameInfo!.isIdle()).toBe(true);
        });
        it("should return false during navigation, even after the delay of 1s", () => {
            frameInfo!.prepareNavigation("www.google.com");
            expect(frameInfo!.isIdle()).toBe(false);
            (frameInfo as any).lastTimeStamp = Date.now() - 1100;
            expect(frameInfo!.isIdle()).toBe(false);
        });
        it("should return false right after navigation commit, false after a second", () => {
            frameInfo!.commitNavigation("www.google.com");
            expect(frameInfo!.isIdle()).toBe(false);
            (frameInfo as any).lastTimeStamp = Date.now() - 900;
            expect(frameInfo!.isIdle()).toBe(false);
            (frameInfo as any).lastTimeStamp = Date.now() - 1000;
            expect(frameInfo!.isIdle()).toBe(true);
        });
    });

    describe("isNavigating", () => {
        it("should return false initially", () => {
            expect(frameInfo!.isNavigating()).toBe(false);
        });
        it("should return false when committed", () => {
            frameInfo!.commitNavigation("www.google.com");
            expect(frameInfo!.isNavigating()).toBe(false);
        });
        it("should return true when navigating", () => {
            frameInfo!.prepareNavigation("www.google.com");
            expect(frameInfo!.isNavigating()).toBe(true);

            // Even when navigating twice to the same domain
            frameInfo!.prepareNavigation("www.google.com");
            expect(frameInfo!.isNavigating()).toBe(true);

            // and after commit and navigate
            frameInfo!.commitNavigation("www.google.com");
            frameInfo!.prepareNavigation("www.amazon.com");
            expect(frameInfo!.isNavigating()).toBe(true);
        });
    });
});
