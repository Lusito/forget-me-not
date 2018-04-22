/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { assert } from "chai";
import { createSpy, browserMock, SpyData } from "./BrowserMock";
import { settings, defaultSettings, SettingsMap, localStorageDefault, Settings } from "../src/lib/settings";
import { Runtime } from "webextension-polyfill-ts/src/generated/runtime";
import { SettingsTypeMap, RuleType } from "../src/lib/settingsSignature";

interface CalledWithData {
    index: number;
    sender: Runtime.MessageSender;
    data: any;
}

// generate settings map that is unequal to default settings
const testOverrides = {};
for (const key in defaultSettings) {
    const type = typeof (defaultSettings[key]);
    if (type === 'boolean')
        testOverrides[key] = !defaultSettings[key];
    else if (type === 'number')
        testOverrides[key] = defaultSettings[key] as number + 1;
    else if (type === 'string')
        testOverrides[key] = 'test-override';
    else if (key === 'rules')
        testOverrides[key] = [{ rule: '*.test-override.com', type: RuleType.FORGET }];
    else if (type === 'object')
        testOverrides[key] = { 'test-override.com': true };
    else
        throw 'Unknown settings type';
}

describe("Settings", () => {
    afterEach(() => {
        settings.restoreDefaults();
    });

    describe("testOverrides", () => {
        it("should all be unequal to defaultSettings", () => {
            for (const key in defaultSettings)
                assert.notDeepEqual(testOverrides[key], defaultSettings[key]);
        });
    });

    describe("getAll", () => {
        it("should initially return default settings", () => {
            assert.deepEqual(settings.getAll(), defaultSettings);
        });
        it("should return overriden values", () => {
            for (const key in defaultSettings)
                settings.set(key as keyof SettingsTypeMap, testOverrides[key]);
            const all = settings.getAll();
            for (const key in all)
                assert.deepEqual(all[key], testOverrides[key]);
        });
    });

    describe("get", () => {
        it("should initially return default settings for each key", () => {
            for (const key in defaultSettings)
                assert.deepEqual(settings.get(key as keyof SettingsTypeMap), defaultSettings[key]);
        });
    });

    describe("set", () => {
        it("should override the default settings", () => {
            for (const key in defaultSettings) {
                settings.set(key as keyof SettingsTypeMap, testOverrides[key]);
                assert.equal(settings.get(key as keyof SettingsTypeMap), testOverrides[key]);
            }
        });
    });

    describe("setAll", () => {
        it("should override the default settings", () => {
            const overrides = {};
            for (const key in defaultSettings) {
                overrides[key] = testOverrides[key];
            }
            settings.setAll(overrides);
            const all = settings.getAll();
            for (const key in all)
                assert.deepEqual(all[key], testOverrides[key], `${key} has unexpected value`);
        });
        //fixme: test sanitizing settings
    });

    describe("restoreDefaults", () => {
        it("should restore the default settings", () => {
            settings.setAll(testOverrides);
            settings.restoreDefaults();
            assert.deepEqual(settings.getAll(), defaultSettings);
        });
    });

    describe("save", () => {
        let settings2: Settings;
        before(() => {
            if (!settings2)
                settings2 = new Settings();
        });
        after(() => {
            if (settings2) {
                settings2.destroy();
                settings2 = null;
            }
        });
        it("should affect other settings instances", (done) => {
            assert.deepEqual(settings.get('version'), settings2.get('version'));
            settings.set('version', 'woot');
            settings.save();

            // promise takes at least a frame until it works
            setTimeout(()=> {
                assert.equal(settings.get('version'), 'woot');
                assert.equal(settings2.get('version'), 'woot');
                done();
            }, 10);
        });
    });

    //Fixme: getRuleType*, hasBlockingRule, getMatchingRules, etc.
});
