import { container } from "tsyringe";
import { mockAssimilate, whitelistPropertyAccess } from "mockzilla";
import { Downloads } from "webextension-polyfill-ts";

import { mocks } from "../../testUtils/mocks";
import { DownloadCleaner } from "./downloadCleaner";
import { SettingsKey } from "../../shared/defaultSettings";

describe("DownloadCleaner", () => {
    let downloadCleaner: DownloadCleaner;

    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.ruleManager.mockAllow();
        mocks.tabWatcher.mockAllow();
        mockBrowser.downloads.onCreated.addListener.expect(expect.anything());
        downloadCleaner = container.resolve(DownloadCleaner);
    });

    it("adds the onCreated listener correctly", () => {
        const listener = mockBrowser.downloads.onCreated.addListener.getMockCalls()[0][0];
        const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
            mock: ["onCreated"],
            whitelist: [],
        });
        const item = {} as any;
        mock.onCreated.expect(item);
        listener(item);
    });

    describe("onCreated", () => {
        it("does nothing if url has no valid hostname", async () => {
            whitelistPropertyAccess(downloadCleaner, "onCreated");
            const item = {
                url: "",
                incognito: false,
            } as any;
            await downloadCleaner["onCreated"](item);
        });
        describe.each.boolean("with %s", (incognito) => {
            const item = {
                url: "http://www.some-domain.com",
                incognito,
            } as any;
            it("does nothing if neither instant nor startup cleanup should happen", async () => {
                const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                    mock: ["shouldCleanInstantly", "shouldCleanOnStartup"],
                    whitelist: ["onCreated"],
                });
                mock.shouldCleanInstantly.expect().andReturn(false);
                mock.shouldCleanOnStartup.expect("www.some-domain.com", incognito).andReturn(false);
                await downloadCleaner["onCreated"](item);
            });
            it("does nothing more if instant cleanup should happen, but cleanupUrlInstantly returns true", async () => {
                const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                    mock: ["shouldCleanInstantly", "shouldCleanOnStartup", "cleanupUrlInstantly"],
                    whitelist: ["onCreated"],
                });
                mock.shouldCleanInstantly.expect().andReturn(true);
                mock.cleanupUrlInstantly.expect(item.url, "www.some-domain.com", incognito).andResolve(true);
                await downloadCleaner["onCreated"](item);
            });
            it("does nothing if only instant cleanup should happen, but cleanupUrlInstantly returns false", async () => {
                const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                    mock: ["shouldCleanInstantly", "shouldCleanOnStartup", "cleanupUrlInstantly"],
                    whitelist: ["onCreated"],
                });
                mock.shouldCleanInstantly.expect().andReturn(true);
                mock.cleanupUrlInstantly.expect(item.url, "www.some-domain.com", incognito).andResolve(false);
                mock.shouldCleanOnStartup.expect("www.some-domain.com", incognito).andReturn(false);
                await downloadCleaner["onCreated"](item);
            });
            it("remembers the download for startup cleanup", async () => {
                const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                    mock: ["shouldCleanInstantly", "shouldCleanOnStartup", "addDownloadsToClean"],
                    whitelist: ["onCreated", "settings"],
                });
                mock.shouldCleanInstantly.expect().andReturn(false);
                mock.shouldCleanOnStartup.expect("www.some-domain.com", incognito).andReturn(true);
                mock.addDownloadsToClean.expect([item.url]).andResolve();

                await downloadCleaner["onCreated"](item);
            });
        });
    });

    describe("shouldCleanOnStartup", () => {
        it("should return false if incognito", () => {
            whitelistPropertyAccess(downloadCleaner, "shouldCleanOnStartup");
            expect(downloadCleaner["shouldCleanOnStartup"]("www.some-domain.com", true)).toBe(false);
        });
        it("should return false if startup.enabled=false", () => {
            whitelistPropertyAccess(downloadCleaner, "shouldCleanOnStartup", "settings");
            mocks.settings.get.expect("startup.enabled").andReturn(false);
            expect(downloadCleaner["shouldCleanOnStartup"]("www.some-domain.com", false)).toBe(false);
        });
        it("should return false if startup.downloads=false", () => {
            whitelistPropertyAccess(downloadCleaner, "shouldCleanOnStartup", "settings");
            mocks.settings.get.expect("startup.enabled").andReturn(true);
            mocks.settings.get.expect("startup.downloads").andReturn(false);
            expect(downloadCleaner["shouldCleanOnStartup"]("www.some-domain.com", false)).toBe(false);
        });
        it("should return false if domain is protected", () => {
            whitelistPropertyAccess(downloadCleaner, "shouldCleanOnStartup", "settings", "ruleManager");
            mocks.settings.get.expect("startup.enabled").andReturn(true);
            mocks.settings.get.expect("startup.downloads").andReturn(true);
            mocks.ruleManager.isDomainProtected.expect("www.some-domain.com", false, false).andReturn(true);

            expect(downloadCleaner["shouldCleanOnStartup"]("www.some-domain.com", false)).toBe(false);
        });
        it("should return true if domain is not protected", () => {
            whitelistPropertyAccess(downloadCleaner, "shouldCleanOnStartup", "settings", "ruleManager");
            mocks.settings.get.expect("startup.enabled").andReturn(true);
            mocks.settings.get.expect("startup.downloads").andReturn(true);
            mocks.ruleManager.isDomainProtected.expect("www.some-domain.com", false, false).andReturn(false);

            expect(downloadCleaner["shouldCleanOnStartup"]("www.some-domain.com", false)).toBe(true);
        });
    });

    describe("shouldCleanInstantly", () => {
        describe.each.boolean("with %s", (instantlyEnabled, instantlyDownloads) => {
            const expected = instantlyEnabled && instantlyDownloads;
            it(`should return ${expected}`, () => {
                whitelistPropertyAccess(downloadCleaner, "settings", "shouldCleanInstantly");
                mocks.settings.get.expect("instantly.enabled").andReturn(instantlyEnabled);
                if (instantlyEnabled) mocks.settings.get.expect("instantly.downloads").andReturn(instantlyDownloads);
                expect(downloadCleaner["shouldCleanInstantly"]()).toBe(expected);
            });
        });
    });

    describe("cleanupUrlInstantly", () => {
        const url = "http://www.some-domain.com";
        const domain = "www.some-domain.com";
        describe.each.boolean("with %s", (incognito) => {
            describe("with applyRules=true, hasInstantlyRule=false", () => {
                it("just returns false", async () => {
                    whitelistPropertyAccess(downloadCleaner, "settings", "ruleManager", "cleanupUrlInstantly");
                    mocks.settings.get.expect("instantly.downloads.applyRules").andReturn(true);
                    mocks.ruleManager.isDomainInstantly.expect(domain, false).andReturn(false);
                    expect(await downloadCleaner["cleanupUrlInstantly"](url, domain, incognito)).toBe(false);
                });
            });
        });
        describe.each([
            [false, false],
            [true, true],
            [false, true],
        ])("with applyRules=%j, hasInstantlyRule=%j", (applyRules, hasInstantlyRule) => {
            beforeEach(() => {
                mocks.settings.get.expect("instantly.downloads.applyRules").andReturn(applyRules);
                if (applyRules) mocks.ruleManager.isDomainInstantly.expect(domain, false).andReturn(hasInstantlyRule);
            });
            describe("with incognito=true", () => {
                it("removes the download and returns true", async () => {
                    whitelistPropertyAccess(downloadCleaner, "settings", "ruleManager", "cleanupUrlInstantly");
                    mockBrowser.downloads.erase.expect({ url }).andResolve([]);
                    expect(await downloadCleaner["cleanupUrlInstantly"](url, domain, true)).toBe(true);
                });
            });
            describe("with incognito=false", () => {
                it("calls cleanupUrl and returns true", async () => {
                    const mock = mockAssimilate(downloadCleaner, "downloadsCleaner", {
                        mock: ["cleanupUrl"],
                        whitelist: ["settings", "ruleManager", "cleanupUrlInstantly"],
                    });
                    mock.cleanupUrl.expect(url).andResolve();
                    expect(await downloadCleaner["cleanupUrlInstantly"](url, domain, false)).toBe(true);
                });
            });
        });
    });

    describe("updateDownloadsToClean", () => {
        it("saves the new downloadsToClean", async () => {
            whitelistPropertyAccess(downloadCleaner, "updateDownloadsToClean", "settings");

            const downloads = { a: true, b: true };
            mocks.settings.set.expect("downloadsToClean", downloads);
            mocks.settings.save.expect().andResolve();

            await downloadCleaner["updateDownloadsToClean"](downloads);
        });
    });

    describe("addDownloadsToClean", () => {
        it("adds the url to the existing urls", async () => {
            const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                mock: ["updateDownloadsToClean"],
                whitelist: ["settings", "addDownloadsToClean"],
            });
            mocks.settings.get.expect("downloadsToClean").andReturn({ a: true, b: true });
            mock.updateDownloadsToClean.expect({ a: true, b: true, c: true }).andResolve();

            await downloadCleaner["addDownloadsToClean"](["b", "c"]);
        });
    });

    describe("cleanupUrl", () => {
        const url = "http://www.some-domain.com";
        describe("without history API", () => {
            it("erases the download", async () => {
                whitelistPropertyAccess(downloadCleaner, "cleanupUrl");
                mockBrowser.downloads.erase.expect({ url }).andResolve([]);
                mockBrowser.history.mock(undefined as any);
                await downloadCleaner["cleanupUrl"](url);
            });
        });
        describe("with history API", () => {
            it("erases the download and the history entry", async () => {
                whitelistPropertyAccess(downloadCleaner, "cleanupUrl");
                mockBrowser.downloads.erase.expect({ url }).andResolve([]);
                mockBrowser.history.deleteUrl.expect({ url }).andResolve();
                await downloadCleaner["cleanupUrl"](url);
            });
        });
    });

    describe("clean", () => {
        describe("with typeSet.downloads=false", () => {
            describe.each.boolean("with %s", (history, startup) => {
                const typeSet = { downloads: false, history };
                it("should do nothing", async () => {
                    whitelistPropertyAccess(downloadCleaner, "clean");
                    await downloadCleaner.clean(typeSet, startup);
                });
            });
        });
        describe("with typeSet.downloads=true", () => {
            describe.each([
                [true, "startup.downloads.applyRules"],
                [false, "cleanAll.downloads.applyRules"],
            ])("with startup=%j and applyRules=%j", (startup, settingsKey) => {
                describe.each.boolean("with %s", (history, applyRules) => {
                    beforeEach(() => {
                        mocks.settings.get.expect(settingsKey as SettingsKey).andReturn(applyRules);
                    });
                    const typeSet = { downloads: true, history };
                    if (applyRules || !history) {
                        it("should delegate to performCleanup", async () => {
                            const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                                mock: ["performCleanup"],
                                whitelist: ["clean", "settings"],
                            });
                            mock.performCleanup.expect(startup, applyRules).andResolve();
                            await downloadCleaner.clean(typeSet, startup);
                        });
                    } else {
                        it("should do nothing", async () => {
                            whitelistPropertyAccess(downloadCleaner, "clean", "settings");
                            await downloadCleaner.clean(typeSet, startup);
                        });
                    }
                });
            });
        });
    });

    describe("performCleanup", () => {
        const downloads: Downloads.DownloadItem[] = [{ url: "url-a" }, { url: "url-b" }, { url: "url-c" }] as any;
        const urlsToClean = ["url-a", "url-c", "url-d"];
        describe.each.boolean("with %s", (startup, applyRules, protectOpenDomains) => {
            it("should perform cleanup correctly", async () => {
                const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                    mock: ["getUrlsToClean", "cleanupUrl", "addDownloadsToClean"],
                    whitelist: ["settings", "performCleanup"],
                });
                mockBrowser.downloads.search.expect({}).andResolve(downloads);
                if (!startup) mocks.settings.get.expect("cleanAll.protectOpenDomains").andReturn(protectOpenDomains);
                mock.addDownloadsToClean.expect(["url-a", "url-b", "url-c"]).andResolve();
                mock.getUrlsToClean.expect(startup, startup || protectOpenDomains, applyRules).andResolve(urlsToClean);
                mock.cleanupUrl.expect("url-a").andResolve();
                mock.cleanupUrl.expect("url-c").andResolve();
                mock.cleanupUrl.expect("url-d").andResolve();
                await downloadCleaner["performCleanup"](startup, applyRules);
            });
        });
    });

    describe("isDomainProtected", () => {
        beforeEach(() => {
            whitelistPropertyAccess(downloadCleaner, "tabWatcher", "ruleManager", "isDomainProtected");
        });
        describe.each.boolean("with %s", (ignoreStartupType) => {
            describe("with protectOpenDomains=true and containsDomain=true", () => {
                it("should return true", () => {
                    mocks.tabWatcher.containsDomain.expect("www.some-domain.com").andReturn(true);
                    expect(downloadCleaner["isDomainProtected"]("www.some-domain.com", ignoreStartupType, true)).toBe(
                        true
                    );
                });
            });
            describe.each([
                [true, false],
                [false, false],
                [false, true],
            ])("with protectOpenDomains=%j and containsDomain=%j", (protectOpenDomains, containsDomain) => {
                describe.each.boolean("with %s", (isDomainProtected) => {
                    it(`should return ${isDomainProtected}`, () => {
                        if (protectOpenDomains)
                            mocks.tabWatcher.containsDomain.expect("www.some-domain.com").andReturn(containsDomain);
                        mocks.ruleManager.isDomainProtected
                            .expect("www.some-domain.com", false, ignoreStartupType)
                            .andReturn(isDomainProtected);
                        expect(
                            downloadCleaner["isDomainProtected"](
                                "www.some-domain.com",
                                ignoreStartupType,
                                protectOpenDomains
                            )
                        ).toBe(isDomainProtected);
                    });
                });
            });
        });
    });

    describe("getUrlsToClean", () => {
        describe.each.boolean("with %s", (startup, protectOpenDomains) => {
            describe("with applyRules=false", () => {
                it("returns all URLs and empties downloadsToClean", async () => {
                    const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                        mock: ["updateDownloadsToClean"],
                        whitelist: ["settings", "getUrlsToClean"],
                    });
                    mocks.settings.get.expect("downloadsToClean").andReturn({ a: true, b: true });
                    mock.updateDownloadsToClean.expect({}).andResolve();
                    const result = await downloadCleaner["getUrlsToClean"](startup, protectOpenDomains, false);
                    expect(result).toEqual(["a", "b"]);
                });
            });
            describe("with applyRules=true", () => {
                it("returns filtered URLs and updates downloadsToClean", async () => {
                    const mock = mockAssimilate(downloadCleaner, "downloadCleaner", {
                        mock: ["updateDownloadsToClean", "isDomainProtected"],
                        whitelist: ["settings", "getUrlsToClean"],
                    });
                    mocks.settings.get.expect("downloadsToClean").andReturn({
                        "http://a.com": true,
                        "http://b.com": true,
                        "http://c.com": true,
                        "http://d.com": true,
                    });
                    mock.isDomainProtected.expect("a.com", startup, protectOpenDomains).andReturn(false);
                    mock.isDomainProtected.expect("b.com", startup, protectOpenDomains).andReturn(true);
                    mock.isDomainProtected.expect("c.com", startup, protectOpenDomains).andReturn(false);
                    mock.isDomainProtected.expect("d.com", startup, protectOpenDomains).andReturn(true);
                    mock.updateDownloadsToClean.expect({ "http://b.com": true, "http://d.com": true }).andResolve();
                    const result = await downloadCleaner["getUrlsToClean"](startup, protectOpenDomains, true);
                    expect(result).toEqual(["http://a.com", "http://c.com"]);
                });
            });
        });
    });
});
