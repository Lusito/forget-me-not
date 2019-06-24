/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "./settings";
import { on } from "./htmlUtils";

interface SettingsInfo {
    element: HTMLInputElement | HTMLSelectElement;
    permanentlyDisabled?: boolean;
    permanentlyUnchecked?: boolean;
}
const settingsInfoMap: { [s: string]: SettingsInfo } = {};

function connectInputSetting(element: HTMLInputElement | HTMLSelectElement) {
    const key = element.dataset.settingsKey;
    if (key) {
        if (settingsInfoMap[key]) {
            console.error("Setting already registered: " + key, element, settingsInfoMap[key].element);
            return;
        }
        settingsInfoMap[key] = { element };

        if (element.type === "checkbox") {
            on(element, "click", () => {
                settings.set(key as any, (element as HTMLInputElement).checked);
                settings.save();
            });
        } else {
            on(element, "change", () => {
                const value = element.type === "number" ? parseFloat(element.value) : element.value;
                settings.set(key as any, value);
                settings.save();
            });
        }
    } else {
        console.error("data-settings-key is empty for element", element);
    }
}

export function updateFromSettings() {
    for (const key in settingsInfoMap) {
        const info = settingsInfoMap[key];
        if (info) {
            if (!info.permanentlyUnchecked) {
                if (info.element.type === "checkbox") {
                    const input = (info.element as HTMLInputElement);
                    input.checked = settings.get(key as any);
                    input.dispatchEvent(new Event("change"));
                } else
                    info.element.value = settings.get(key as any);

                const enabledBy = info.element.dataset.settingsEnabledBy;
                if (enabledBy)
                    info.element.disabled = !enabledBy.split(" ").every((key2) => settings.get(key2 as any) === true);
            }
        }
    }
}

export function connectSettings(parent: HTMLElement) {
    for (const element of parent.querySelectorAll("input[data-settings-key]"))
        connectInputSetting(element as HTMLInputElement);
    for (const element of parent.querySelectorAll("select[data-settings-key]"))
        connectInputSetting(element as HTMLSelectElement);
    updateFromSettings();
}

export function permanentDisableSettings(keys: string[], uncheck?: boolean) {
    for (const key of keys) {
        const info = settingsInfoMap[key];
        if (info) {
            info.permanentlyDisabled = true;
            info.element.disabled = true;
            if (uncheck && info.element.type === "checkbox") {
                (info.element as HTMLInputElement).checked = false;
                info.permanentlyUnchecked = true;
            }
        } else {
            console.error("Element not found: ", key);
        }
    }
}
