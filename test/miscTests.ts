/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { getValidHostname } from "../src/shared";

describe("Misc functionality", () => {
	describe("getValidHostname", () => {
		it("should return hostnames for valid urls", () => {
			assert.equal(getValidHostname("http://www.google.com"), 'www.google.com');
			assert.equal(getValidHostname("https://www.google.com"), 'www.google.com');
		});
		it("should return emptystring for invalid urls", () => {
			assert.equal(getValidHostname("file://www.google.com"), '');
			assert.equal(getValidHostname("chrome://www.google.com"), '');
			assert.equal(getValidHostname("about:preferences"), '');
			assert.equal(getValidHostname('Bu][$<|-|!7'), '');
			assert.equal(getValidHostname(null), '');
		});
	});
});
