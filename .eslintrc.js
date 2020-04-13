const utils = require("@lusito/eslint-config/utils");

module.exports = {
    extends: ["@lusito/eslint-config-react"],
    rules: {
        "react/no-unknown-property": ["error", { ignore: ["class"] }],
        "@typescript-eslint/prefer-nullish-coalescing": "off",
        "@typescript-eslint/prefer-optional-chain": "warn",
        ...utils.getA11yOffRules(), // just for now
    },
    settings: {
        react: {
            createClass: "h",
            pragma: "h",
            version: "latest",
        },
    },
    env: {
        browser: true,
    },
    globals: {
        browserMock: "readonly",
    },
    overrides: [
        {
            files: ["**/*.spec.ts"],
            rules: {
                "dot-notation": "off",
            },
        },
        {
            files: ["**/*.tsx"],
            rules: {
                "@typescript-eslint/no-use-before-define": "off",
            },
        },
    ],
};
