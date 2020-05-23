import { BrowsingData, History } from "webextension-polyfill-ts";
import { container } from "tsyringe";
import { mockEvent, MockzillaEventOf } from "mockzilla-webextension";
import { whitelistPropertyAccess, mockAssimilate } from "mockzilla";

import { HistoryCleaner } from "./historyCleaner";
import { mocks } from "../../testUtils/mocks";

describe("HistoryCleaner", () => {
    let historyCleaner: HistoryCleaner;
    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.ruleManager.mockAllow();
        mocks.tabWatcher.mockAllow();
    });

    describe("without history API", () => {
        // eslint-disable-next-line jest/expect-expect
        it("does not add a listener", () => {
            mockBrowser.history.mock(undefined as any);
            historyCleaner = container.resolve(HistoryCleaner);
        });
    });

    describe("with history API", () => {
        let onVisited: MockzillaEventOf<typeof mockBrowser.history.onVisited>;
        beforeEach(() => {
            onVisited = mockEvent(mockBrowser.history.onVisited);

            historyCleaner = container.resolve(HistoryCleaner);
        });

        describe("onVisited", () => {
            const url = "https://google.com/some/path.html";

            it("adds listeners correctly", () => {
                expect(onVisited.addListener.mock.calls).toEqual([[historyCleaner["onVisited"]]]);
            });

            // eslint-disable-next-line jest/expect-expect
            it("does nothing with an empty url", () => {
                historyCleaner["onVisited"]({ id: "mock", url: "" });
            });
            it("does nothing with instantly.enabled = false", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(false);
                historyCleaner["onVisited"]({ id: "mock", url });
            });
            it("does nothing with instantly.history = false", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(false);
                historyCleaner["onVisited"]({ id: "mock", url });
            });
            it("does nothing without a valid hostname", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                historyCleaner["onVisited"]({ id: "mock", url: "nope://hello.com" });
            });
            it("deletes the URL if applyRules = false", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                mockBrowser.history.deleteUrl.expect({ url });
                mocks.settings.get.expect("instantly.history.applyRules").andReturn(false);
                historyCleaner["onVisited"]({ id: "mock", url });
            });
            it("deletes the URL if applyRules = true, but the domain is blocked", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                mockBrowser.history.deleteUrl.expect({ url });
                mocks.settings.get.expect("instantly.history.applyRules").andReturn(true);
                mocks.ruleManager.isDomainInstantly.expect("google.com", false).andReturn(true);
                historyCleaner["onVisited"]({ id: "mock", url });
            });
            it("does not delete the URL if applyRules = true and the domain is not blocked", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                mocks.settings.get.expect("instantly.history.applyRules").andReturn(true);
                mocks.ruleManager.isDomainInstantly.expect("google.com", false).andReturn(false);
                historyCleaner["onVisited"]({ id: "mock", url });
            });
        });

        describe("clean", () => {
            const typeSet: BrowsingData.DataTypeSet = {
                history: true,
            };
            beforeEach(() => {
                typeSet.history = true;
            });
            it.each.boolean("does nothing if typeset.history=false with %s", async (startup) => {
                typeSet.history = false;
                await historyCleaner.clean(typeSet, startup);
                expect(typeSet.history).toBe(false);
            });
            describe.each.boolean("with %s", (startup) => {
                it("does nothing if the respective applyRules setting is false", async () => {
                    mocks.settings.get
                        .expect(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")
                        .andReturn(false);
                    await historyCleaner.clean(typeSet, startup);
                    expect(typeSet.history).toBe(true);
                });
                describe.each.boolean("with %s", (protectOpenDomains) => {
                    it("should clean up nothing if there are no history items", async () => {
                        mocks.settings.get
                            .expect(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")
                            .andReturn(true);
                        const historyItems: History.HistoryItem[] = [];
                        mockBrowser.history.search.expect({ text: "" }).andResolve(historyItems);
                        await historyCleaner.clean(typeSet, startup);
                        expect(typeSet.history).toBe(false);
                    });
                    // fixme: this is an unreadable mess.. split into multiple its?
                    it("should clean up if the respective applyRules setting is true", async () => {
                        mocks.settings.get
                            .expect(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")
                            .andReturn(true);
                        const data = [
                            {
                                url: "http://www.google.com/path1.html",
                                hostname: "www.google.com",
                                tabExists: true,
                                protected: true,
                                deleted: false,
                            },
                            {
                                url: "http://www.google.com/path2.html",
                                hostname: "www.google.com",
                                tabExists: false,
                                protected: true,
                                deleted: false,
                            },
                            {
                                url: "http://www.amazon.com/path1.html",
                                hostname: "www.amazon.com",
                                tabExists: false,
                                protected: false,
                                deleted: true,
                            },
                            {
                                url: "http://www.amazon.com/path2.html",
                                hostname: "www.amazon.com",
                                tabExists: true,
                                protected: false,
                                deleted: !(startup || protectOpenDomains),
                            },
                        ];
                        const historyItems: History.HistoryItem[] = data.map((entry) => ({ url: entry.url } as any));
                        mockBrowser.history.search.expect({ text: "" }).andResolve(historyItems);
                        if (!startup)
                            mocks.settings.get.expect("cleanAll.protectOpenDomains").andReturn(protectOpenDomains);
                        data.forEach((entry) => {
                            if (!(startup || protectOpenDomains) || entry.tabExists)
                                mocks.ruleManager.isDomainProtected
                                    .expect(entry.hostname, false, startup)
                                    .andReturn(entry.protected);
                            if (entry.deleted) mockBrowser.history.deleteUrl.expect({ url: entry.url }).andResolve();
                            if (startup || protectOpenDomains)
                                mocks.tabWatcher.containsDomain.expect(entry.hostname).andReturn(entry.tabExists);
                        });
                        await historyCleaner.clean(typeSet, startup);
                        expect(typeSet.history).toBe(false);
                    });
                });
            });
        });
        describe("cleanDomainOnLeave", () => {
            it("does nothing if domainLeave.enabled=false", async () => {
                whitelistPropertyAccess(historyCleaner, "settings", "cleanDomainOnLeave");
                mocks.settings.get.expect("domainLeave.enabled").andReturn(false);
                await historyCleaner.cleanDomainOnLeave("mock", "www.some-domain.com");
            });
            it("does nothing if domainLeave.history=false", async () => {
                whitelistPropertyAccess(historyCleaner, "settings", "cleanDomainOnLeave");
                mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
                mocks.settings.get.expect("domainLeave.history").andReturn(false);
                await historyCleaner.cleanDomainOnLeave("mock", "www.some-domain.com");
            });
            it("does nothing if tabWatcher.containsDomain returns true", async () => {
                whitelistPropertyAccess(historyCleaner, "settings", "tabWatcher", "cleanDomainOnLeave");
                mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
                mocks.settings.get.expect("domainLeave.history").andReturn(true);
                mocks.tabWatcher.containsDomain.expect("www.some-domain.com").andReturn(true);
                await historyCleaner.cleanDomainOnLeave("mock", "www.some-domain.com");
            });
            it("deletes history entries if tabWatcher.containsDomain returns false", async () => {
                const mock = mockAssimilate(historyCleaner, "historyCleaner", {
                    mock: ["getUrlsToClean"],
                    whitelist: ["settings", "tabWatcher", "cleanDomainOnLeave"],
                });
                mocks.settings.get.expect("domainLeave.enabled").andReturn(true);
                mocks.settings.get.expect("domainLeave.history").andReturn(true);
                mocks.tabWatcher.containsDomain.expect("www.some-domain.com").andReturn(false);

                const items = [
                    { url: "http://www.some-domain.com", id: "0" },
                    { url: "http://xxx.some-domain.com", id: "1" },
                    { url: "http://www.other-domain.com", id: "2" },
                    { url: "", id: "3" },
                ];
                mockBrowser.history.search.expect({ text: "some-domain.com" }).andResolve(items);

                const urlsToClean = ["http://www.some-domain.com", "http://xxx.some-domain.com"];
                mock.getUrlsToClean.expect(items.slice(0, 2), false, true).andReturn(urlsToClean);

                mockBrowser.history.deleteUrl.expect({ url: "http://www.some-domain.com" }).andResolve();
                mockBrowser.history.deleteUrl.expect({ url: "http://xxx.some-domain.com" }).andResolve();

                await historyCleaner.cleanDomainOnLeave("mock", "www.some-domain.com");
            });
        });
    });
});
