import { suite, test } from "mocha-typescript";
import { assert } from "chai";
import { getValidHostname } from "../src/shared";

@suite export class MiscTests {
	@test get_hostname() {
		assert.equal(getValidHostname("http://www.google.com"), 'www.google.com');
		assert.equal(getValidHostname("https://www.google.com"), 'www.google.com');
		assert.equal(getValidHostname("file://www.google.com"), '');
		assert.equal(getValidHostname("chrome://www.google.com"), '');
		assert.equal(getValidHostname("about:preferences"), '');
	}
}
