/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/leave-me-not
 */

import { CleanupType } from "../lib/settingsSignature";
import { TabWatcher } from "./tabWatcher";
import { IncognitoWatcher } from "./incognitoWatcher";
import { HeaderFilter } from "./headerFilter";
import { settings } from "../lib/settings";
import { booleanContext } from "../testUtils/testHelpers";
import { quickHttpHeader, quickHeadersReceivedDetails } from "../testUtils/quickHelpers";

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

    afterEach(async () => {
        tabWatcher = null;
        incognitoWatcher = null;
        headerFilter = null;
        await settings.restoreDefaults();
    });

    beforeEach(() => {
        tabWatcher = new TabWatcher(tabWatcherListener);
        incognitoWatcher = new IncognitoWatcher();
    });

    describe("isEnabled", () => {
        it("should return false with default settings", () => {
            headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
            expect(headerFilter!.isEnabled()).toBe(false);
        });
        it("should return true if cleanThirdPartyCookies.beforeCreation was set before creation", () => {
            settings.set("cleanThirdPartyCookies.beforeCreation", true);
            headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
            expect(headerFilter.isEnabled()).toBe(true);
            headerFilter.setSnoozing(true);
            expect(headerFilter.isEnabled()).toBe(false);
            headerFilter.setSnoozing(false);
            expect(headerFilter.isEnabled()).toBe(true);
        });
        it("should return true if cleanThirdPartyCookies.beforeCreation was set after creation", async () => {
            headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
            settings.set("cleanThirdPartyCookies.beforeCreation", true);
            await settings.save();
            expect(headerFilter.isEnabled()).toBe(true);
            headerFilter.setSnoozing(true);
            expect(headerFilter.isEnabled()).toBe(false);
            headerFilter.setSnoozing(false);
            expect(headerFilter.isEnabled()).toBe(true);
        });

        booleanContext((instantlyEnabled) => {
            beforeEach(async () => {
                settings.set("instantly.enabled", instantlyEnabled);
                await settings.save();
            });

            it(`should return ${instantlyEnabled} if an instantly rule existed before creation`, () => {
                settings.set("rules", [{ rule: "google.com", type: CleanupType.INSTANTLY }]);
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                expect(headerFilter.isEnabled()).toBe(instantlyEnabled);
                headerFilter.setSnoozing(true);
                expect(headerFilter.isEnabled()).toBe(false);
                headerFilter.setSnoozing(false);
                expect(headerFilter.isEnabled()).toBe(instantlyEnabled);
            });
            it(`should return ${instantlyEnabled} if an instantly rule was added after creation`, async () => {
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                settings.set("rules", [{ rule: "google.com", type: CleanupType.INSTANTLY }]);
                await settings.save();
                expect(headerFilter.isEnabled()).toBe(instantlyEnabled);
                headerFilter.setSnoozing(true);
                expect(headerFilter.isEnabled()).toBe(false);
                headerFilter.setSnoozing(false);
                expect(headerFilter.isEnabled()).toBe(instantlyEnabled);
            });
        });
    });

    describe("filterResponseHeaders", () => {
        describe("cleanThirdPartyCookies.beforeCreation = false and no rules", () => {
            it("should do nothing", () => {
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("something", "hello=world"),
                    quickHttpHeader("cookie", "foo=bar"),
                    quickHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                expect(result).toHaveLength(0);
            });
        });

        describe("cleanThirdPartyCookies.beforeCreation = true", () => {
            beforeEach(async () => {
                settings.set("cleanThirdPartyCookies.beforeCreation", true);
                await settings.save();
            });

            it("should return empty object if no responseHeaders are set", () => {
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", 0
                ));
                expect(result).toEqual([{}]);
            });
            it("should filter all thirdparty cookies", () => {
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, [
                        quickHttpHeader("set-cookie", "hello=world"),
                        quickHttpHeader("set-cookie", "foo=bar")
                    ]
                ));
                expect(result).toEqual([{ responseHeaders: [] }]);
                const result2 = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.jp", tabId, [
                        quickHttpHeader("set-cookie", "hello=world"),
                        quickHttpHeader("set-cookie", "foo=bar")
                    ]
                ));
                expect(result2).toEqual([{ responseHeaders: [] }]);
            });
            it("should not filter firstparty cookies", () => {
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.de", tabId, headers
                ));
                expect(result).toEqual([{ responseHeaders: headers }]);
            });
            it("should not filter thirdparty cookies with an unknown tab id", () => {
                browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", 9999, headers
                ));
                expect(result).toEqual([{ responseHeaders: headers }]);
            });
            it("should only filter set-cookie headers", () => {
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("something", "hello=world"),
                    quickHttpHeader("cookie", "foo=bar"),
                    quickHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                expect(result).toEqual([{ responseHeaders: headers.slice(1) }]);
                browserMock.webRequest.reset();
            });

            it("should filter no neverlisted cookies", async () => {
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                settings.set("rules", baseRules);
                await settings.save();
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.never.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.startup.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.leave.com", tabId, headers
                ))).toEqual([{ responseHeaders: [] }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.instantly.com", tabId, headers
                ))).toEqual([{ responseHeaders: [] }]);
            });

            it("should not change anything on a private tab", () => {
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-private");
                incognitoWatcher!.forceAdd(tabId, "firefox-private");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("something", "hello=world"),
                    quickHttpHeader("cookie", "foo=bar"),
                    quickHttpHeader("x-set-cookie", "woot")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                expect(result).toEqual([{}]);
            });
        });
        describe("cleanThirdPartyCookies.beforeCreation = false, but with rules", () => {
            beforeEach(async () => {
                settings.set("cleanThirdPartyCookies.beforeCreation", false);
                settings.set("rules", baseRules);
                await settings.save();
            });

            it("should filter no thirdparty cookies", () => {
                const tabId = browserMock.tabs.create("http://www.google.de", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                const result = browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ));
                expect(result).toEqual([{ responseHeaders: headers }]);
            });

            it("should filter only cookies that have an instantly rule", () => {
                const tabId = browserMock.tabs.create("http://www.google.com", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world"),
                    quickHttpHeader("set-cookie", "foo=bar")
                ];
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.instantly.com", tabId, headers
                ))).toEqual([{ responseHeaders: [] }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.leave.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.startup.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.never.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);
            });

            it("should handle multiline values correctly", async () => {
                const tabId = browserMock.tabs.create("http://www.google.com", "firefox-default");
                headerFilter = new HeaderFilter(tabWatcher!, incognitoWatcher!);
                const headers = [
                    quickHttpHeader("set-cookie", "hello=world\nfoo=bar")
                ];
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.instantly.com", tabId, headers
                ))).toEqual([{ responseHeaders: [] }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.leave.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.startup.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);
                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.never.com", tabId, headers
                ))).toEqual([{ responseHeaders: headers }]);

                settings.set("rules", [{ rule: "hello@*.google.com", type: CleanupType.INSTANTLY }]);
                await settings.save();

                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ))).toEqual([{ responseHeaders: [ quickHttpHeader("set-cookie", "foo=bar") ] }]);

                settings.set("rules", [
                    { rule: "hello@*.google.com", type: CleanupType.INSTANTLY },
                    { rule: "foo@*.google.com", type: CleanupType.INSTANTLY }
                ]);
                await settings.save();

                expect(browserMock.webRequest.headersReceived(quickHeadersReceivedDetails(
                    "http://www.google.com", tabId, headers
                ))).toEqual([{ responseHeaders: [] }]);
            });
        });
    });
});
