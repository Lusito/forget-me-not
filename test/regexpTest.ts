/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { ruleToRegExString, getRegExForRule } from "../src/lib/regexp";

describe("ruleToRegExString", () => {
    it("should create correct regular expressions", () => {
        assert.equal(ruleToRegExString("*"), ".*");
        assert.equal(ruleToRegExString("*.a"), "(^|\\.)a$");
        assert.equal(ruleToRegExString("*.a.bc"), "(^|\\.)a\\.bc$");
        assert.equal(ruleToRegExString("www.google.co"), "^www\\.google\\.co$");
        assert.equal(ruleToRegExString("*.g.ogle.co"), "(^|\\.)g\\.ogle\\.co$");
        assert.equal(ruleToRegExString("*.a.*"), "(^|\\.)a($|\\..*)");
        assert.equal(ruleToRegExString("*.a.*.b.*.c.*"), "(^|\\.)a(\\..*\\.|\\.)b(\\..*\\.|\\.)c($|\\..*)");
    });
});

describe("getRegExForRule", () => {
    context("with rule: *", () => {
        const regex = getRegExForRule("*");
        it("should return a regular expression that matches any input", () => {
            assert.isTrue(regex.test("a"));
            assert.isTrue(regex.test("ab"));
            assert.isTrue(regex.test("google.com"));
            assert.isTrue(regex.test("www.google.com"));
            assert.isTrue(regex.test("hello.world.foo.bar.google.com"));
        });
    });

    context("with rule: foo", () => {
        const regex = getRegExForRule("foo");
        it("should return a regular expression that matches only 'foo'", () => {
            assert.isTrue(regex.test("foo"));
            assert.isFalse(regex.test("foob"));
            assert.isFalse(regex.test("google.com"));
            assert.isFalse(regex.test("www.google.com"));
            assert.isFalse(regex.test("hello.world.foo.bar.google.com"));
        });
    });

    context("with rule: *.foo", () => {
        const regex = getRegExForRule("*.foo");
        it("should return a regular expression that matches any input ending with '.foo' or is 'foo'", () => {
            assert.isTrue(regex.test("foo"));
            assert.isTrue(regex.test("b.foo"));
            assert.isTrue(regex.test("b.c.foo"));
            assert.isTrue(regex.test("b.c.d.foo"));
            assert.isTrue(regex.test("foo.b.c.d.foo"));
            assert.isFalse(regex.test("foofoo"));
            assert.isFalse(regex.test("bfoo"));
            assert.isFalse(regex.test("foo.b"));
            assert.isFalse(regex.test("foo.b.foob"));
            assert.isFalse(regex.test("b.c.dfoo"));
        });
    });

    context("with rule: foo.*", () => {
        const regex = getRegExForRule("foo.*");
        it("should return a regular expression that matches any input starting with 'foo.'", () => {
            assert.isTrue(regex.test("foo.b"));
            assert.isTrue(regex.test("foo.b.c.d.foo.b"));
            assert.isTrue(regex.test("foo.b.c.d"));
            assert.isTrue(regex.test("foo.b"));
            assert.isTrue(regex.test("foo.b.ab"));
            assert.isFalse(regex.test("aa.b"));
            assert.isFalse(regex.test("fooa.b"));
            assert.isFalse(regex.test("afoo.b"));
            assert.isFalse(regex.test("b.c.dfoo.d"));
            assert.isFalse(regex.test("b.c"));
        });
        it("should return a regular expression that matches 'foo'", () => {
            assert.isTrue(regex.test("foo"));
        });
    });

    context("with rule: foo.*.bar", () => {
        const regex = getRegExForRule("foo.*.bar");
        it("should return a regular expression that matches any input starting with 'foo.' and ending with '.bar", () => {
            assert.isTrue(regex.test("foo.bar"));
            assert.isTrue(regex.test("foo.helloworld.bar"));
            assert.isTrue(regex.test("foo.hello.world.bar"));
            assert.isFalse(regex.test("foo.bar.nope"));
            assert.isFalse(regex.test("foohellobar"));
        });
    });

    context("with rule: *.foo.*", () => {
        const regex = getRegExForRule("*.foo.*");
        it("should return a regular expression that matches any input containing '.foo.'", () => {
            assert.isTrue(regex.test("b.foo.b"));
            assert.isTrue(regex.test("b.c.foo.b"));
            assert.isTrue(regex.test("b.c.d.foo.b"));
            assert.isTrue(regex.test("foo.b.c.d.foo.b"));
            assert.isTrue(regex.test("foo.b"));
            assert.isTrue(regex.test("foo.b.foob"));
        });
        it("should return a regular expression that does not match any input containing '[^.]foo.'", () => {
            assert.isFalse(regex.test("afoo.b"));
            assert.isFalse(regex.test("bfoo.b"));
            assert.isFalse(regex.test("b.c.dfoo.d"));
            assert.isFalse(regex.test("b.c"));
        });
        it("should return a regular expression that matches any input starting with 'foo.'", () => {
            assert.isTrue(regex.test("foo.b"));
            assert.isTrue(regex.test("foo.b.c.d.foo.b"));
            assert.isTrue(regex.test("foo.b.c.d"));
            assert.isTrue(regex.test("foo.b"));
            assert.isTrue(regex.test("foo.b.foob"));
        });
        it("should return a regular expression that matches 'foo'", () => {
            assert.isTrue(regex.test("foo"));
        });
        it("should return a regular expression that matches any input ending with '.foo'", () => {
            assert.isTrue(regex.test("b.foo"));
            assert.isTrue(regex.test("b.c.foo"));
            assert.isTrue(regex.test("b.c.d.foo"));
            assert.isTrue(regex.test("foo.b.c.d.foo"));
            assert.isFalse(regex.test("b.b"));
            assert.isFalse(regex.test("b"));
        });
    });

    context("with rule: foo.*.bar.*.2k", () => {
        const regex = getRegExForRule("foo.*.bar.*.2k");
        it("should return a regular expression that matches any input starting with foo., ending with .2k and having .bar. in the middle", () => {
            assert.isTrue(regex.test("foo.bar.2k"));
            assert.isTrue(regex.test("foo.a.bar.2k"));
            assert.isTrue(regex.test("foo.a.b.c.bar.2k"));
            assert.isTrue(regex.test("foo.a.bar.b.2k"));
            assert.isTrue(regex.test("foo.bar.a.b.c.2k"));
            assert.isFalse(regex.test("foo.bar"));
            assert.isFalse(regex.test("foo.2k"));
            assert.isFalse(regex.test("bar.2k"));
            assert.isFalse(regex.test("foobar2k"));
        });
    });
});
