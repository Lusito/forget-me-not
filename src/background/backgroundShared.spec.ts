import { someItemsMatch } from "./backgroundShared";

describe("someItemsMatch", () => {
    const acceptedKeys = ["a", "b", "c"];
    it.each([["a"], ["b"], ["c"], ["a", "b"], ["a", "b", "c"], ["b", "c"], ["a", "c"], ["a", "f"], ["f", "c"]])(
        "returns true if at least one changedKey is in acceptedKeys",
        (...items) => {
            expect(someItemsMatch(items, acceptedKeys)).toBe(true);
        }
    );
    it.each([["f"], ["g"], ["h"], ["f", "g"]])(
        "returns false if none of the changedKeys is in acceptedKeys",
        (...changedKeys) => {
            expect(someItemsMatch(changedKeys, acceptedKeys)).toBe(false);
        }
    );
});
