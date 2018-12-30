/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { FrameInfo } from "../src/background/frameInfo";
import { ensureNotNull } from "./testHelpers";

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
            ensureNotNull(frameInfo).collectHostnames(hostnames);
            assert.isEmpty(hostnames);
        });
        it("should not add anything if navigating from empty hostname to empty hostname", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.prepareNavigation("");
            frameInfo.collectHostnames(hostnames);
            assert.isEmpty(hostnames);
        });
        it("should add hostname if committed", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            frameInfo.collectHostnames(hostnames);
            assert.hasAllKeys(hostnames, ["www.google.com"]);
        });
        it("should add nextHostname if navigating", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            frameInfo.prepareNavigation("www.amazon.com");
            frameInfo.collectHostnames(hostnames);
            assert.hasAllKeys(hostnames, ["www.google.com", "www.amazon.com"]);
        });
        it("should keep existing hostnames", () => {
            frameInfo = ensureNotNull(frameInfo);
            hostnames.add("www.amazon.com");
            frameInfo.collectHostnames(hostnames);
            assert.hasAllKeys(hostnames, ["www.amazon.com"]);
            frameInfo.commitNavigation("www.google.com");
            frameInfo.collectHostnames(hostnames);
            assert.hasAllKeys(hostnames, ["www.amazon.com", "www.google.com"]);
            hostnames.clear();
            hostnames.add("www.amazon.com");
            frameInfo.prepareNavigation("www.github.com");
            frameInfo.collectHostnames(hostnames);
            assert.hasAllKeys(hostnames, ["www.amazon.com", "www.google.com", "www.github.com"]);
        });
    });

    describe("matchHostname", () => {
        it("should return true if hostname matches, no matter of the checkNext argument", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            assert.isTrue(frameInfo.matchHostname("www.google.com", true));
            assert.isTrue(frameInfo.matchHostname("www.google.com", false));
        });
        it("should return false if hostname does not match, no matter of the checkNext argument", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            assert.isFalse(frameInfo.matchHostname("google.com", true));
            assert.isFalse(frameInfo.matchHostname("google.com", false));
        });
        it("should return true if nextHostname matches and checkNext = true", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            frameInfo.prepareNavigation("www.amazon.com");
            assert.isTrue(frameInfo.matchHostname("www.amazon.com", true));
            assert.isFalse(frameInfo.matchHostname("www.amazon.com", false));
            assert.isFalse(frameInfo.matchHostname("amazon.com", true));
        });
    });

    describe("matchHostnameFP", () => {
        it("should return true if hostnameFP or nextHostnameFP matches", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            frameInfo.prepareNavigation("www.amazon.com");
            assert.isFalse(frameInfo.matchHostnameFP("www.google.com"));
            assert.isFalse(frameInfo.matchHostnameFP("www.amazon.com"));
            assert.isTrue(frameInfo.matchHostnameFP("google.com"));
            assert.isTrue(frameInfo.matchHostnameFP("amazon.com"));
        });
    });

    describe("prepareNavigation", () => {
        it("should set lastTimeStamp with Date.now()", () => {
            frameInfo = ensureNotNull(frameInfo);
            assert.equal((frameInfo as any).lastTimeStamp, 0);
            frameInfo.prepareNavigation("www.google.com");
            assert.isBelow(Math.abs(Date.now() - (frameInfo as any).lastTimeStamp), 10);
        });
        it("should return previous value of nextHostname", () => {
            frameInfo = ensureNotNull(frameInfo);
            assert.equal(frameInfo.prepareNavigation("www.google.com"), "");
            assert.equal(frameInfo.prepareNavigation("www.amazon.com"), "www.google.com");
            assert.equal(frameInfo.prepareNavigation("www.github.com"), "www.amazon.com");
            frameInfo.commitNavigation("www.amazon.com");
            assert.equal(frameInfo.prepareNavigation("www.google.com"), "");
        });
    });

    describe("commitNavigation", () => {
        it("should set lastTimeStamp with Date.now()", () => {
            frameInfo = ensureNotNull(frameInfo);
            assert.equal((frameInfo as any).lastTimeStamp, 0);
            frameInfo.commitNavigation("www.google.com");
            assert.isBelow(Math.abs(Date.now() - (frameInfo as any).lastTimeStamp), 10);
        });
        it("should set nextHostname and nextHostnameFP to empty string", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.prepareNavigation("www.amazon.com");
            assert.equal((frameInfo as any).nextHostname, "www.amazon.com");
            assert.equal((frameInfo as any).nextHostnameFP, "amazon.com");
            frameInfo.commitNavigation("www.google.com");
            assert.equal((frameInfo as any).nextHostname, "");
            assert.equal((frameInfo as any).nextHostnameFP, "");
        });
    });

    describe("isIdle", () => {
        it("should return true initially", () => {
            assert.isTrue(ensureNotNull(frameInfo).isIdle());
        });
        it("should return false during navigation, even after the delay of 1s", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.prepareNavigation("www.google.com");
            assert.isFalse(frameInfo.isIdle());
            (frameInfo as any).lastTimeStamp = Date.now() - 1100;
            assert.isFalse(frameInfo.isIdle());
        });
        it("should return false right after navigation commit, false after a second", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            assert.isFalse(frameInfo.isIdle());
            (frameInfo as any).lastTimeStamp = Date.now() - 900;
            assert.isFalse(frameInfo.isIdle());
            (frameInfo as any).lastTimeStamp = Date.now() - 1000;
            assert.isTrue(frameInfo.isIdle());
        });
    });

    describe("isNavigating", () => {
        it("should return false initially", () => {
            assert.isFalse(ensureNotNull(frameInfo).isNavigating());
        });
        it("should return false when committed", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.commitNavigation("www.google.com");
            assert.isFalse(frameInfo.isNavigating());
        });
        it("should return true when navigating", () => {
            frameInfo = ensureNotNull(frameInfo);
            frameInfo.prepareNavigation("www.google.com");
            assert.isTrue(frameInfo.isNavigating());

            // Even when navigating twice to the same domain
            frameInfo.prepareNavigation("www.google.com");
            assert.isTrue(frameInfo.isNavigating());

            // and after commit and navigate
            frameInfo.commitNavigation("www.google.com");
            frameInfo.prepareNavigation("www.amazon.com");
            assert.isTrue(frameInfo.isNavigating());
        });
    });
});
