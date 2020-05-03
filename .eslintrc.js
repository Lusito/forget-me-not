const utils = require("@lusito/eslint-config/utils");

module.exports = {
    extends: ["@lusito/eslint-config-react"],
    rules: {
        "react/no-unknown-property": ["error", { ignore: ["class"] }],
        "@typescript-eslint/no-parameter-properties": ["error", { allows: ["private readonly", "public readonly"] }],
        "@typescript-eslint/prefer-nullish-coalescing": "off",
        "@typescript-eslint/prefer-optional-chain": "warn",
        "react/static-property-placement": "off",
        // fixme: move to shared config
        "require-await": "error",
        "no-useless-constructor": "off",
        "@typescript-eslint/no-useless-constructor": ["error"],
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
    overrides: [
        {
            files: ["**/*.spec.ts"],
            rules: {
                "dot-notation": "off",
                "@typescript-eslint/ban-ts-ignore": "off",
                "jest/expect-expect": [
                    "error",
                    {
                        assertFunctionNames: [
                            "expect",
                            "**.expect",
                            "**.expect.*",
                            "whitelistPropertyAccess",
                            "denyPropertyAccess",
                        ],
                    },
                ],
            },
            globals: {
                mockBrowser: "readonly",
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
