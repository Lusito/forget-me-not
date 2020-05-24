import { container } from "tsyringe";
import { mockEvent } from "mockzilla-webextension";

import { Settings, SettingsMap } from "./settings";
import { clone } from "../testUtils/testHelpers";
import { SettingsKey, DefaultSettingsProvider } from "./defaultSettings";
import { CleanupType } from "./types";
import { mocks } from "../testUtils/mocks";

describe("Settings", () => {
    let settings: Settings;
    const defaultSettings = new DefaultSettingsProvider({ get: () => [] } as any, { version: "2.0.0" } as any).get();

    // generate settings map that is unequal to default settings
    const testOverrides: SettingsMap = {};
    const invalidOverrides: SettingsMap = {};
    for (const key of Object.keys(defaultSettings)) {
        const type = typeof defaultSettings[key as SettingsKey];
        if (type === "boolean") testOverrides[key] = !defaultSettings[key as SettingsKey];
        else if (type === "number") testOverrides[key] = (defaultSettings[key as SettingsKey] as number) + 1;
        else if (key === "version") testOverrides[key] = "2.0.0";
        else if (type === "string") testOverrides[key] = "test-override";
        else if (key === "rules") testOverrides[key] = [{ rule: "*.test-override.com", type: CleanupType.LEAVE }];
        else if (type === "object") testOverrides[key] = { "test-override.com": true };
        else throw new Error("Unknown settings type");

        if (type === "boolean" || type === "number" || type === "object") invalidOverrides[key] = "test-override";
        else if (type === "string") invalidOverrides[key] = 42;
        else if (key === "rules") {
            invalidOverrides[key] = [{ rule: "@@@", type: CleanupType.LEAVE }, "sadasd"] as any;
        }
    }

    async function expectSave() {
        mockBrowser.storage.local.set.expect(expect.anything());
        await settings.save();
    }

    beforeEach(() => {
        mockEvent(mockBrowser.storage.onChanged);
        mockBrowser.storage.local.mockAllow();
        mocks.defaultSettings.get.expect().andReturn(defaultSettings);
        mocks.messageUtil.importSettings.receive.expect(expect.anything());
        settings = container.resolve(Settings);
    });

    describe("testOverrides", () => {
        it("should all be unequal to defaultSettings", () => {
            expect(defaultSettings).not.toEqual(testOverrides);
        });
    });

    describe("getAll", () => {
        it("should initially return default settings", () => {
            expect(settings.getAll()).toEqual(defaultSettings);
        });
        it("should return overriden values", async () => {
            for (const key of Object.keys(defaultSettings)) settings.set(key as SettingsKey, clone(testOverrides[key]));
            await expectSave();
            expect(settings.getAll()).toEqual(testOverrides);
        });
    });

    describe("get", () => {
        it("should initially return default settings for each key", () => {
            for (const key of Object.keys(defaultSettings))
                expect(settings.get(key as SettingsKey)).toEqual(defaultSettings[key as SettingsKey]);
        });
    });

    describe("set", () => {
        it("should override the default settings", async () => {
            for (const key of Object.keys(defaultSettings)) {
                settings.set(key as SettingsKey, clone(testOverrides[key]));
                // eslint-disable-next-line no-await-in-loop
                await expectSave();
                expect(settings.get(key as SettingsKey)).toEqual(testOverrides[key]);
            }
        });
    });

    describe("setAll", () => {
        it("should override the default settings", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            await settings.setAll(clone(testOverrides));
            expect(settings.getAll()).toEqual(testOverrides);
        });
        it("should not override the default settings if the values are invalid types", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            mockBrowser.storage.local.remove.expect(expect.anything());
            await settings.setAll(clone(invalidOverrides));
            expect(settings.getAll()).toEqual(defaultSettings);
        });
    });

    describe("restoreDefaults", () => {
        it("should restore the default settings", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            await settings.setAll(clone(testOverrides));
            mockBrowser.storage.local.set.expect(expect.anything());
            mockBrowser.storage.local.clear.expect();
            await settings.restoreDefaults();
            expect(settings.getAll()).toEqual(defaultSettings);
        });
    });

    describe("setRule", () => {
        it("should save rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything());
            await settings.setRule("*.com", CleanupType.INSTANTLY, false);
            expect(settings.get("rules")).toEqual([{ rule: "*.com", type: CleanupType.INSTANTLY }]);
        });
        it("should override existing rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings.setRule("*.com", CleanupType.NEVER, false);
            await settings.setRule("*.de", CleanupType.NEVER, false);
            await settings.setRule("*.com", CleanupType.INSTANTLY, false);
            expect(settings.get("rules")).toEqual([
                { rule: "*.com", type: CleanupType.INSTANTLY },
                { rule: "*.de", type: CleanupType.NEVER },
            ]);
        });
    });

    describe("removeRule", () => {
        it("should save rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(2);
            await settings.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings.removeRule("*.com");
            expect(settings.get("rules")).toHaveLength(0);
        });
        it("should keep other rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings.setRule("*.de", CleanupType.NEVER, false);
            await settings.removeRule("*.com");
            expect(settings.get("rules")).toEqual([{ rule: "*.de", type: CleanupType.NEVER }]);
        });
    });

    describe("removeRules", () => {
        it("should save rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(2);
            await settings.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings.removeRules(["*.com"]);
            expect(settings.get("rules")).toHaveLength(0);
        });
        it("should keep other rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings.setRule("*.com", CleanupType.INSTANTLY, false);
            await settings.setRule("*.de", CleanupType.NEVER, false);
            await settings.removeRules(["*.com"]);
            expect(settings.get("rules")).toEqual([{ rule: "*.de", type: CleanupType.NEVER }]);
        });
    });

    describe("removeTemporaryRules", () => {
        it("should remove only temporary rules", async () => {
            mockBrowser.storage.local.set.expect(expect.anything()).times(3);
            await settings.setRule("*.com", CleanupType.INSTANTLY, true);
            await settings.setRule("*.de", CleanupType.INSTANTLY, false);
            await settings.removeTemporaryRules();
            expect(settings.get("rules")).toEqual([{ rule: "*.de", type: CleanupType.INSTANTLY }]);
        });
    });
});
