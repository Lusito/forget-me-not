module.exports = {
    transform: {
        ".+\\.ts$": "ts-jest",
    },
    testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.ts$",
    moduleFileExtensions: ["ts", "js"],
    setupFilesAfterEnv: ["./src/testUtils/setupTests.ts"],
    collectCoverageFrom: [
        "src/**/*.ts",
        // ignore entry points
        "!src/*.ts",
        // ignore frontend code
        "!src/frontend/*.ts",
        "!src/icons/index.ts",
        // ignore definition files
        "!src/**/*.d.ts",
        // ignore test utils
        "!src/testUtils/*.ts",
    ],
};
