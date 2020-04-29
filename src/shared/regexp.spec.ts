import { ruleToRegExString, getRegExForRule } from "./regexp";

describe("ruleToRegExString", () => {
    it("should create correct regular expressions", () => {
        expect(ruleToRegExString("*")).toBe(".*");
        expect(ruleToRegExString("*.a")).toBe("(^|\\.)a$");
        expect(ruleToRegExString("*.a.bc")).toBe("(^|\\.)a\\.bc$");
        expect(ruleToRegExString("www.google.co")).toBe("^www\\.google\\.co$");
        expect(ruleToRegExString("*.g.ogle.co")).toBe("(^|\\.)g\\.ogle\\.co$");
        expect(ruleToRegExString("*.a.*")).toBe("(^|\\.)a($|\\..*)");
        expect(ruleToRegExString("*.a.*.b.*.c.*")).toBe("(^|\\.)a(\\..*\\.|\\.)b(\\..*\\.|\\.)c($|\\..*)");
    });
});

describe("getRegExForRule", () => {
    describe("with rule: *", () => {
        const regex = getRegExForRule("*");
        it("should return a regular expression that matches any input", () => {
            expect(regex.test("a")).toBe(true);
            expect(regex.test("ab")).toBe(true);
            expect(regex.test("google.com")).toBe(true);
            expect(regex.test("www.google.com")).toBe(true);
            expect(regex.test("hello.world.foo.bar.google.com")).toBe(true);
        });
    });

    describe("with rule: foo", () => {
        const regex = getRegExForRule("foo");
        it("should return a regular expression that matches only 'foo'", () => {
            expect(regex.test("foo")).toBe(true);
            expect(regex.test("foob")).toBe(false);
            expect(regex.test("google.com")).toBe(false);
            expect(regex.test("www.google.com")).toBe(false);
            expect(regex.test("hello.world.foo.bar.google.com")).toBe(false);
        });
    });

    describe("with rule: *.foo", () => {
        const regex = getRegExForRule("*.foo");
        it("should return a regular expression that matches any input ending with '.foo' or is 'foo'", () => {
            expect(regex.test("foo")).toBe(true);
            expect(regex.test("b.foo")).toBe(true);
            expect(regex.test("b.c.foo")).toBe(true);
            expect(regex.test("b.c.d.foo")).toBe(true);
            expect(regex.test("foo.b.c.d.foo")).toBe(true);
            expect(regex.test("foofoo")).toBe(false);
            expect(regex.test("bfoo")).toBe(false);
            expect(regex.test("foo.b")).toBe(false);
            expect(regex.test("foo.b.foob")).toBe(false);
            expect(regex.test("b.c.dfoo")).toBe(false);
        });
    });

    describe("with rule: foo.*", () => {
        const regex = getRegExForRule("foo.*");
        it("should return a regular expression that matches any input starting with 'foo.'", () => {
            expect(regex.test("foo.b")).toBe(true);
            expect(regex.test("foo.b.c.d.foo.b")).toBe(true);
            expect(regex.test("foo.b.c.d")).toBe(true);
            expect(regex.test("foo.b")).toBe(true);
            expect(regex.test("foo.b.ab")).toBe(true);
            expect(regex.test("aa.b")).toBe(false);
            expect(regex.test("fooa.b")).toBe(false);
            expect(regex.test("afoo.b")).toBe(false);
            expect(regex.test("b.c.dfoo.d")).toBe(false);
            expect(regex.test("b.c")).toBe(false);
        });
        it("should return a regular expression that matches 'foo'", () => {
            expect(regex.test("foo")).toBe(true);
        });
    });

    describe("with rule: foo.*.bar", () => {
        const regex = getRegExForRule("foo.*.bar");
        it("should return a regular expression that matches any input starting with 'foo.' and ending with '.bar", () => {
            expect(regex.test("foo.bar")).toBe(true);
            expect(regex.test("foo.helloworld.bar")).toBe(true);
            expect(regex.test("foo.hello.world.bar")).toBe(true);
            expect(regex.test("foo.bar.nope")).toBe(false);
            expect(regex.test("foohellobar")).toBe(false);
        });
    });

    describe("with rule: *.foo.*", () => {
        const regex = getRegExForRule("*.foo.*");
        it("should return a regular expression that matches any input containing '.foo.'", () => {
            expect(regex.test("b.foo.b")).toBe(true);
            expect(regex.test("b.c.foo.b")).toBe(true);
            expect(regex.test("b.c.d.foo.b")).toBe(true);
            expect(regex.test("foo.b.c.d.foo.b")).toBe(true);
            expect(regex.test("foo.b")).toBe(true);
            expect(regex.test("foo.b.foob")).toBe(true);
        });
        it("should return a regular expression that does not match any input containing '[^.]foo.'", () => {
            expect(regex.test("afoo.b")).toBe(false);
            expect(regex.test("bfoo.b")).toBe(false);
            expect(regex.test("b.c.dfoo.d")).toBe(false);
            expect(regex.test("b.c")).toBe(false);
        });
        it("should return a regular expression that matches any input starting with 'foo.'", () => {
            expect(regex.test("foo.b")).toBe(true);
            expect(regex.test("foo.b.c.d.foo.b")).toBe(true);
            expect(regex.test("foo.b.c.d")).toBe(true);
            expect(regex.test("foo.b")).toBe(true);
            expect(regex.test("foo.b.foob")).toBe(true);
        });
        it("should return a regular expression that matches 'foo'", () => {
            expect(regex.test("foo")).toBe(true);
        });
        it("should return a regular expression that matches any input ending with '.foo'", () => {
            expect(regex.test("b.foo")).toBe(true);
            expect(regex.test("b.c.foo")).toBe(true);
            expect(regex.test("b.c.d.foo")).toBe(true);
            expect(regex.test("foo.b.c.d.foo")).toBe(true);
            expect(regex.test("b.b")).toBe(false);
            expect(regex.test("b")).toBe(false);
        });
    });

    describe("with rule: foo.*.bar.*.2k", () => {
        const regex = getRegExForRule("foo.*.bar.*.2k");
        it("should return a regular expression that matches any input starting with foo., ending with .2k and having .bar. in the middle", () => {
            expect(regex.test("foo.bar.2k")).toBe(true);
            expect(regex.test("foo.a.bar.2k")).toBe(true);
            expect(regex.test("foo.a.b.c.bar.2k")).toBe(true);
            expect(regex.test("foo.a.bar.b.2k")).toBe(true);
            expect(regex.test("foo.bar.a.b.c.2k")).toBe(true);
            expect(regex.test("foo.bar")).toBe(false);
            expect(regex.test("foo.2k")).toBe(false);
            expect(regex.test("bar.2k")).toBe(false);
            expect(regex.test("foobar2k")).toBe(false);
        });
    });
});
