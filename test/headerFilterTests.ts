/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/leave-me-not
 */

import { settings } from "../src/lib/settings";
import { HeaderFilter } from "../src/background/headerFilter";
import { TabWatcher } from "../src/background/tabWatcher";
import { browserMock } from "./browserMock";
import { ensureNotNull, doneHandler, booleanContext } from "./testHelpers";
import { assert } from "chai";
import { CleanupType } from "../src/lib/settingsSignature";
import { quickHeadersReceivedDetails, quickHttpHeader } from "./quickHelpers";
import { IncognitoWatcher } from "../src/background/incognitoWatcher";

const baseRules = [
    { rule: "*.never.com", type: CleanupType.NEVER },
    { rule: "*.startup.com", type: CleanupType.STARTUP },
    { rule: "*.leave.com", type: CleanupType.LEAVE },
    { rule: "*.instantly.com", type: CleanupType.INSTANTLY }
];

describe("Header Filter", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let tabWatcher: TabWatcher | null = null;
    let incognitoWatcher: IncognitoWatcher | null = null;
    let headerFilter: HeaderFilter | null = null;

    afterEach(() => {
        tabWatcher = null;
        incognitoWatcher = null;
        headerFilter = null;
        settings.restoreDefaults();
    });

    beforeEach(() => {
        browserMock.reset();
        tabWatcher = new TabWatcher(tabWatcherListener);
        incognitoWatcher = new IncognitoWatcher();
    });

    describe("isEnabled", () => {
        it("should return false with default settings", () => {
            tabWatcher = ensureNotNull(tabWatcher);
            incognitoWatcher = ensureNotNull(incognitoWatcher);
            headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
            assert.isFalse(headerFilter.isEnabled());
        });
        it("should return true if cleanThirdPartyCookies.beforeCreation was set before creation", () => {
            tabWatcher = ensureNotNull(tabWatcher);
            incognitoWatcher = ensureNotNull(incognitoWatcher);
            settings.set("cleanThirdPartyCookies.beforeCreation", true);
            headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
            assert.isTrue(headerFilter.isEnabled());
            headerFilter.setSnoozing(true);
            assert.isFalse(headerFilter.isEnabled());
            headerFilter.setSnoozing(false);
            assert.isTrue(headerFilter.isEnabled());
        });
        it("should return true if cleanThirdPartyCookies.beforeCreation was set after creation", (done) => {
            tabWatcher = ensureNotNull(tabWatcher);
            incognitoWatcher = ensureNotNull(incognitoWatcher);
            headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
            settings.set("cleanThirdPartyCookies.beforeCreation", true);
            settings.save().then(doneHandler(() => {
                headerFilter = ensureNotNull(headerFilter);
                assert.isTrue(headerFilter.isEnabled());
                headerFilter.setSnoozing(true);
                assert.isFalse(headerFilter.isEnabled());
                headerFilter.setSnoozing(false);
                assert.isTrue(headerFilter.isEnabled());
            }, done));
        });

        booleanContext((instantlyEnabled) => {
            beforeEach(() => {
                settings.set("instantly.enabled", instantlyEnabled);
                settings.save();
            });

            it(`should return ${instantlyEnabled} if an instantly rule existed before creation`, () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                settings.set("rules", [{ rule: "google.com", type: CleanupType.INSTANTLY }]);
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                assert.strictEqual(headerFilter.isEnabled(), instantlyEnabled);
                headerFilter.setSnoozing(true);
                assert.isFalse(headerFilter.isEnabled());
                headerFilter.setSnoozing(false);
                assert.strictEqual(headerFilter.isEnabled(), instantlyEnabled);
            });
            it(`should return ${instantlyEnabled} if an instantly rule was added after creation`, (done) => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                settings.set("rules", [{ rule: "google.com", type: CleanupType.INSTANTLY }]);
                settings.save().then(doneHandler(() => {
                    headerFilter = ensureNotNull(headerFilter);
                    assert.strictEqual(headerFilter.isEnabled(), instantlyEnabled);
                    headerFilter.setSnoozing(true);
                    assert.isFalse(headerFilter.isEnabled());
                    headerFilter.setSnoozing(false);
                    assert.strictEqual(headerFilter.isEnabled(), instantlyEnabled);
                }, done));
            });
        });
    });

    describe("filterResponseHeaders", () => {
        context("cleanThirdPartyCookies.beforeCreation = false and no rules", () => {
            it("should do nothing", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("something", "hello=world"),
                    quickHttpHeader("cookie", "foo=bar"),
                    quickHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                assert.deepEqual(result, []);
            });
        });

        context("cleanThirdPartyCookies.beforeCreation = true", () => {
            beforeEach(() => {
                settings.set("cleanThirdPartyCookies.beforeCreation", true);
                settings.save();
            });

            it("should return empty object if no responseHeaders are set", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", 0
                ));
                assert.deepEqual(result, [{}]);
            });
            it("should filter all thirdparty cookies", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, [
                        quickHttpHeader("set-cookie", "hello=world"),
                        quickHttpHeader("set-cookie", "foo=bar")
                    ]
                ));
                assert.deepEqual(result, [{ responseHeaders: [] }]);
                const result2 = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.jp", tabId, [
                        quickHttpHeader("set-cookie", "hello=world"),
                        quickHttpHeader("set-cookie", "foo=bar")
                    ]
                ));
                assert.deepEqual(result2, [{ responseHeaders: [] }]);
            });
            it("should not filter firstparty cookies", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.de", tabId, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers }]);
            });
            it("should not filter thirdparty cookies with an unknown tab id", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", 9999, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers }]);
            });
            it("should only filter set-cookie headers", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("something", "hello=world"),
                    quickHttpHeader("cookie", "foo=bar"),
                    quickHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers.slice(1) }]);
            });

            it("should filter no neverlisted cookies", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                settings.set("rules", baseRules);
                settings.save();
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.never.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.startup.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.leave.com", tabId, headers
                )), [{ responseHeaders: [] }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.instantly.com", tabId, headers
                )), [{ responseHeaders: [] }]);
            });

            it("should not change anything on a private tab", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-private");
                incognitoWatcher.forceAdd(tabId, "firefox-private");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("something", "hello=world"),
                    quickHttpHeader("cookie", "foo=bar"),
                    quickHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                assert.deepEqual(result, [{}]);
            });
        });
        context("cleanThirdPartyCookies.beforeCreation = false, but with rules", () => {
            beforeEach(() => {
                settings.set("cleanThirdPartyCookies.beforeCreation", false);
                settings.set("rules", baseRules);
                settings.save();
            });

            it("should filter no thirdparty cookies", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers }]);
            });

            it("should filter only cookies that have an instantly rule", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.com", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.instantly.com", tabId, headers
                )), [{ responseHeaders: [] }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.leave.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.startup.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.never.com", tabId, headers
                )), [{ responseHeaders: headers }]);
            });

            it("should handle multiline values correctly", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                incognitoWatcher = ensureNotNull(incognitoWatcher);
                const tabId = browserMock.tabs.create("http://www.google.com", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher, incognitoWatcher);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world\nfoo=bar")
                ];
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.instantly.com", tabId, headers
                )), [{ responseHeaders: [] }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.leave.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.startup.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.never.com", tabId, headers
                )), [{ responseHeaders: headers }]);

                settings.set("rules", [{ rule: "hello@*.google.com", type: CleanupType.INSTANTLY }]);
                settings.save();

                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                )), [{ responseHeaders: [ quickHttpHeader("set-cookie", "foo=bar") ] }]);

                settings.set("rules", [
                    { rule: "hello@*.google.com", type: CleanupType.INSTANTLY },
                    { rule: "foo@*.google.com", type: CleanupType.INSTANTLY }
                ]);
                settings.save();

                assert.deepEqual(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                )), [{ responseHeaders: [] }]);
            });
        });
    });
});
