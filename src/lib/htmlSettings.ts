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
    let key = element.dataset.settingsKey;
    if (key) {
        if (settingsInfoMap[key]) {
            console.error('Setting already registered: ' + key, element, settingsInfoMap[key].element);
            return;
        }
        settingsInfoMap[key] = {
            element: element
        };
        if (element.type === "checkbox") {
            on(element, 'click', () => {
                settings.set(key as any, (element as HTMLInputElement).checked);
                settings.save();
            });
        } else {
            on(element, 'change', () => {
                const value = element.type === 'number' ? parseFloat(element.value) : element.value;
                settings.set(key as any, value);
                settings.save();
            });
        }
    } else {
        console.error('data-settings-key is empty for element', element);
    }
}

export function updateFromSettings() {
    for (let key in settingsInfoMap) {
        let info = settingsInfoMap[key];
        if (info) {
            if (!info.permanentlyUnchecked) {
                if (info.element.type === 'checkbox')
                    (info.element as HTMLInputElement).checked = settings.get(key as any);
                else
                    info.element.value = settings.get(key as any);
            }
        }
    }
}

export function connectSettings(parent: NodeSelector) {
    let elements = parent.querySelectorAll('input[data-settings-key]');
    for (let i = 0; i < elements.length; i++)
        connectInputSetting(elements[i] as HTMLInputElement);
    elements = parent.querySelectorAll('select[data-settings-key]');
    for (let i = 0; i < elements.length; i++)
        connectInputSetting(elements[i] as HTMLSelectElement);
    updateFromSettings();
}

export function permanentDisableSettings(keys: string[], uncheck?: boolean) {
    for (let key of keys) {
        let info = settingsInfoMap[key];
        if (info) {
            info.permanentlyDisabled = true;
            info.element.disabled = true;
            if (uncheck && info.element.type === 'checkbox') {
                (info.element as HTMLInputElement).checked = false;
                info.permanentlyUnchecked = true;
            }
        } else {
            console.error('Element not found: ', key);
        }
    }
}
