/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { WebRequest } from "webextension-polyfill-ts";
import { RecentlyAccessedDomains } from "../src/background/recentlyAccessedDomains";
import { settings } from "../src/lib/settings";
import { HeaderFilter } from "../src/background/headerFilter";
import { TabWatcher } from "../src/background/tabWatcher";
import { destroyAndNull } from "../src/shared";
import { ensureNotNull, browserMock } from "./browserMock";
import { assert } from "chai";
import { RuleType } from "../src/lib/settingsSignature";

function createHeadersReceivedDetails(url: string, tabId: number, responseHeaders?: WebRequest.HttpHeaders): WebRequest.OnHeadersReceivedDetailsType {
    return {
        url,
        tabId,
        responseHeaders,
        requestId: "mock",
        method: "get",
        frameId: 0,
        parentFrameId: -1,
        type: "main_frame",
        timeStamp: Date.now(),
        statusLine: "HTTP/0.9 200 OK",
        statusCode: 200
    };
}

function createHttpHeader(name: string, value?: string) {
    return {
        name,
        value
    };
}

const baseRules = [
    { rule: "*.white.com", type: RuleType.WHITE },
    { rule: "*.gray.com", type: RuleType.GRAY },
    { rule: "*.forget.com", type: RuleType.FORGET },
    { rule: "*.block.com", type: RuleType.BLOCK }
];

describe("Header Filter", () => {
    const tabWatcherListener = {
        onDomainEnter: () => undefined,
        onDomainLeave: () => undefined
    };
    let tabWatcher: TabWatcher | null = null;
    let recentlyAccessedDomains: RecentlyAccessedDomains | null = null;
    let headerFilter: HeaderFilter | null = null;

    afterEach(() => {
        recentlyAccessedDomains = destroyAndNull(recentlyAccessedDomains);
        tabWatcher = destroyAndNull(tabWatcher);
        headerFilter = destroyAndNull(headerFilter);
        settings.restoreDefaults();
    });

    beforeEach(() => {
        browserMock.reset();
        recentlyAccessedDomains = new RecentlyAccessedDomains();
        tabWatcher = new TabWatcher(tabWatcherListener, recentlyAccessedDomains);
    });

    describe("isEnabled", () => {
        it("should return false with default settings", () => {
            tabWatcher = ensureNotNull(tabWatcher);
            recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
            headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
            assert.isFalse(headerFilter.isEnabled());
        });
        it("should return true if cleanThirdPartyCookies.beforeCreation was set before creation", () => {
            tabWatcher = ensureNotNull(tabWatcher);
            recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
            settings.set("cleanThirdPartyCookies.beforeCreation", true);
            headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
            assert.isTrue(headerFilter.isEnabled());
        });
        it("should return true if cleanThirdPartyCookies.beforeCreation was set before creation", (done) => {
            tabWatcher = ensureNotNull(tabWatcher);
            recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
            headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
            settings.set("cleanThirdPartyCookies.beforeCreation", true);
            settings.save();

            // settings take a frame to kick in
            setTimeout(() => {
                headerFilter = ensureNotNull(headerFilter);
                assert.isTrue(headerFilter.isEnabled());
                done();
            }, 10);
        });
        it("should return true if a blocking rule existed on creation", () => {
            tabWatcher = ensureNotNull(tabWatcher);
            recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
            settings.set("rules", [{ rule: "google.com", type: RuleType.BLOCK }]);
            headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
            assert.isTrue(headerFilter.isEnabled());
        });
        it("should return true if a blocking rule was added after creation", (done) => {
            tabWatcher = ensureNotNull(tabWatcher);
            recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
            headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
            settings.set("rules", [{ rule: "google.com", type: RuleType.BLOCK }]);
            settings.save();

            // settings take a frame to kick in
            setTimeout(() => {
                headerFilter = ensureNotNull(headerFilter);
                assert.isTrue(headerFilter.isEnabled());
                done();
            }, 10);
        });
    });

    describe("filterResponseHeaders", () => {
        context("cleanThirdPartyCookies.beforeCreation = false and no rules", () => {
            it("should do nothing", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const headers = [
                    createHttpHeader("set-cookie", "hello=world"),
                    createHttpHeader("something", "hello=world"),
                    createHttpHeader("cookie", "foo=bar"),
                    createHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                assert.deepEqual(result, []);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.google.de", badge: "badge_forget" } // because of the tab
                ]);
            });
        });

        context("cleanThirdPartyCookies.beforeCreation = true", () => {
            beforeEach(() => {
                settings.set("cleanThirdPartyCookies.beforeCreation", true);
                settings.save();
            });

            it("should return empty object if no responseHeaders are set", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const result = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.com", 0
                ));
                assert.deepEqual(result, [{}]);

                assert.deepEqual(recentlyAccessedDomains.get(), []);
            });
            it("should filter all thirdparty cookies", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const result = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.com", tabId, [
                        createHttpHeader("set-cookie", "hello=world"),
                        createHttpHeader("set-cookie", "foo=bar")
                    ]
                ));
                assert.deepEqual(result, [{ responseHeaders: [] }]);
                const result2 = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.jp", tabId, [
                        createHttpHeader("set-cookie", "hello=world"),
                        createHttpHeader("set-cookie", "foo=bar")
                    ]
                ));
                assert.deepEqual(result2, [{ responseHeaders: [] }]);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.google.jp", badge: "badge_forget" },
                    { domain: "www.google.com", badge: "badge_forget" },
                    { domain: "www.google.de", badge: "badge_forget" } // because of the tab
                ]);
            });
            it("should not filter firstparty cookies", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const headers = [
                    createHttpHeader("set-cookie", "hello=world"),
                    createHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.de", tabId, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers }]);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.google.de", badge: "badge_forget" } // because of the tab
                ]);
            });
            it("should not filter thirdparty cookies with an unknown tab id", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                browserMock.tabs.create("http://www.google.de", "firefox-default");
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const headers = [
                    createHttpHeader("set-cookie", "hello=world"),
                    createHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.com", 9999, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers }]);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.google.de", badge: "badge_forget" } // because of the tab
                ]);
            });
            it("should only filter set-cookie headers", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const headers = [
                    createHttpHeader("set-cookie", "hello=world"),
                    createHttpHeader("something", "hello=world"),
                    createHttpHeader("cookie", "foo=bar"),
                    createHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers.slice(1) }]);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.google.com", badge: "badge_forget" },
                    { domain: "www.google.de", badge: "badge_forget" } // because of the tab
                ]);
            });

            it("should filter no whitelisted cookies", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                settings.set("rules", baseRules);
                settings.save();
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const headers = [
                    createHttpHeader("set-cookie", "hello=world"),
                    createHttpHeader("set-cookie", "foo=bar")
                ];
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.white.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.gray.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.forget.com", tabId, headers
                )), [{ responseHeaders: [] }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.block.com", tabId, headers
                )), [{ responseHeaders: [] }]);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.block.com", badge: "badge_block" },
                    { domain: "www.forget.com", badge: "badge_forget" },
                    { domain: "www.google.de", badge: "badge_forget" } // because of the tab
                ]);
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
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const headers = [
                    createHttpHeader("set-cookie", "hello=world"),
                    createHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                assert.deepEqual(result, [{ responseHeaders: headers }]);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.google.de", badge: "badge_forget" } // because of the tab
                ]);
            });

            it("should filter only cookies that have a block rule", () => {
                tabWatcher = ensureNotNull(tabWatcher);
                const tabId = browserMock.tabs.create("http://www.google.com", "firefox-default");
                recentlyAccessedDomains = ensureNotNull(recentlyAccessedDomains);
                headerFilter = new HeaderFilter(tabWatcher, recentlyAccessedDomains);
                const headers = [
                    createHttpHeader("set-cookie", "hello=world"),
                    createHttpHeader("set-cookie", "foo=bar")
                ];
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.block.com", tabId, headers
                )), [{ responseHeaders: [] }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.forget.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.gray.com", tabId, headers
                )), [{ responseHeaders: headers }]);
                assert.deepEqual(browserMock.webRequest.headersReceived(createHeadersReceivedDetails(
                    "http://www.white.com", tabId, headers
                )), [{ responseHeaders: headers }]);

                assert.deepEqual(recentlyAccessedDomains.get(), [
                    { domain: "www.block.com", badge: "badge_block" },
                    { domain: "www.google.com", badge: "badge_forget" } // because of the tab
                ]);
            });
        });
    });
});
