/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { getValidHostname, getFirstPartyCookieDomain } from "../src/shared";

describe("Misc functionality", () => {
	describe("getValidHostname", () => {
		it("should return hostnames for valid urls", () => {
			assert.equal(getValidHostname("http://www.google.com"), 'www.google.com');
			assert.equal(getValidHostname("https://www.google.com"), 'www.google.com');
		});
		it("should return emptystring for invalid urls", () => {
			assert.equal(getValidHostname('hhttp://www.google.com'), '');
			assert.equal(getValidHostname('httpss://www.google.com'), '');
			assert.equal(getValidHostname("file://www.google.com"), '');
			assert.equal(getValidHostname("chrome://www.google.com"), '');
			assert.equal(getValidHostname("about:preferences"), '');
			assert.equal(getValidHostname('Bu][$<|-|!7'), '');
			assert.equal(getValidHostname(null), '');
		});
	});

	describe("getFirstPartyCookieDomain", () => {
		it("should return first party domains for valid cookie domains", () => {
			assert.equal(getFirstPartyCookieDomain("www.google.com"), 'google.com');
			assert.equal(getFirstPartyCookieDomain(".google.com"), 'google.com');
			assert.equal(getFirstPartyCookieDomain("google.com"), 'google.com');
			assert.equal(getFirstPartyCookieDomain(".michelgagne.blogspot.de"), 'michelgagne.blogspot.de');
			assert.equal(getFirstPartyCookieDomain("michelgagne.blogspot.de"), 'michelgagne.blogspot.de');
			assert.equal(getFirstPartyCookieDomain("hello.michelgagne.blogspot.de"), 'michelgagne.blogspot.de');
		});
	});
});
