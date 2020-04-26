/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { BrowsingData, History } from "webextension-polyfill-ts";
import { container } from "tsyringe";

import { HistoryCleaner } from "./historyCleaner";
import { mocks } from "../../testUtils/mocks";
import { mockEvent, EventMockOf } from "../../testUtils/mockBrowser";
import { booleanVariations } from "../../testUtils/testHelpers";

describe("HistoryCleaner", () => {
    let historyCleaner: HistoryCleaner | null = null;
    beforeEach(() => {
        mocks.settings.mockAllow();
        mocks.domainUtils.mockAllow();
        mocks.tabWatcher.mockAllow();
    });

    afterEach(() => {
        historyCleaner = null;
    });

    describe("without history API", () => {
        // eslint-disable-next-line jest/expect-expect
        it("does not add a listener", () => {
            mockBrowser.history.mock(undefined as any);
            historyCleaner = container.resolve(HistoryCleaner);
        });
    });

    // fixme: cleanDomainOnLeave

    describe("with history API", () => {
        let onVisited: EventMockOf<typeof mockBrowser.history.onVisited>;
        beforeEach(() => {
            onVisited = mockEvent(mockBrowser.history.onVisited);

            historyCleaner = container.resolve(HistoryCleaner);
        });

        describe("onVisited", () => {
            const url = `https://google.com/some/path.html`;

            it("adds listeners correctly", () => {
                expect(onVisited.addListener.mock.calls).toEqual([[historyCleaner!["onVisited"]]]);
            });

            // eslint-disable-next-line jest/expect-expect
            it("does nothing with an empty url", () => {
                historyCleaner!["onVisited"]({ id: "mock", url: "" });
            });
            it("does nothing with instantly.enabled = false", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(false);
                historyCleaner!["onVisited"]({ id: "mock", url });
            });
            it("does nothing with instantly.history = false", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(false);
                historyCleaner!["onVisited"]({ id: "mock", url });
            });
            it("does nothing without a valid hostname", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                mocks.domainUtils.getValidHostname.expect(url).andReturn("");
                historyCleaner!["onVisited"]({ id: "mock", url });
            });
            it("deletes the URL if applyRules = false", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                mocks.domainUtils.getValidHostname.expect(url).andReturn("google.com");
                mockBrowser.history.deleteUrl.expect({ url });
                mocks.settings.get.expect("instantly.history.applyRules").andReturn(false);
                historyCleaner!["onVisited"]({ id: "mock", url });
            });
            it("deletes the URL if applyRules = true, but the domain is blocked", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                mocks.domainUtils.getValidHostname.expect(url).andReturn("google.com");
                mockBrowser.history.deleteUrl.expect({ url });
                mocks.settings.get.expect("instantly.history.applyRules").andReturn(true);
                mocks.settings.isDomainBlocked.expect("google.com").andReturn(true);
                historyCleaner!["onVisited"]({ id: "mock", url });
            });
            it("does not delete the URL if applyRules = true and the domain is not blocked", () => {
                mocks.settings.get.expect("instantly.enabled").andReturn(true);
                mocks.settings.get.expect("instantly.history").andReturn(true);
                mocks.domainUtils.getValidHostname.expect(url).andReturn("google.com");
                mocks.settings.get.expect("instantly.history.applyRules").andReturn(true);
                mocks.settings.isDomainBlocked.expect("google.com").andReturn(false);
                historyCleaner!["onVisited"]({ id: "mock", url });
            });
        });

        describe("clean", () => {
            const typeSet: BrowsingData.DataTypeSet = {
                history: true,
            };
            beforeEach(() => {
                typeSet.history = true;
            });
            it.each(booleanVariations(1))("does nothing if typeset.history=false with startup=%j", async (startup) => {
                typeSet.history = false;
                await historyCleaner!.clean(typeSet, startup);
                expect(typeSet.history).toBe(false);
            });
            describe.each(booleanVariations(1))("with startup=%j", (startup) => {
                it("does nothing if the respective applyRules setting is false", async () => {
                    mocks.settings.get
                        .expect(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")
                        .andReturn(false);
                    await historyCleaner!.clean(typeSet, startup);
                    expect(typeSet.history).toBe(true);
                });
                describe.each(booleanVariations(1))("with protectOpenDomains=%j", (protectOpenDomains) => {
                    it("should clean up nothing if there are no history items", async () => {
                        mocks.settings.get
                            .expect(startup ? "startup.history.applyRules" : "cleanAll.history.applyRules")
                            .andReturn(true);
                        const historyItems: History.HistoryItem[] = [];
                        mockBrowser.history.search.expect({ text: "" }).andResolve(historyItems);
                        await historyCleaner!.clean(typeSet, startup);
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
                                mocks.settings.isDomainProtected
                                    .expect(entry.hostname, startup)
                                    .andReturn(entry.protected);
                            if (entry.deleted) mockBrowser.history.deleteUrl.expect({ url: entry.url }).andResolve();
                            mocks.domainUtils.getValidHostname.expect(entry.url).andReturn(entry.hostname);
                            if (startup || protectOpenDomains)
                                mocks.tabWatcher.containsDomain.expect(entry.hostname).andReturn(entry.tabExists);
                        });
                        await historyCleaner!.clean(typeSet, startup);
                        expect(typeSet.history).toBe(false);
                    });
                });
            });
        });
    });
});
