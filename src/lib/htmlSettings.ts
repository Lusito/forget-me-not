/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { settings } from "./settings";
import { on } from "./htmlUtils";

interface SettingsInfo {
    element: HTMLInputElement;
    permanentlyDisabled?: boolean;
    permanentlyUnchecked?: boolean;
    enablesSetting?: string;
}
const settingsInfoMap: { [s: string]: SettingsInfo } = {};

function setSettingDisabled(key: string, disabled: boolean) {
    let el = settingsInfoMap[key];
    if (el) {
        if(!el.permanentlyDisabled)
            el.element.disabled = disabled;
    } else {
        console.error('Element not found: ', key);
    }
}

function connectInputSetting(element: HTMLInputElement) {
    let key = element.dataset.settingsKey;
    if (key) {
        if (settingsInfoMap[key]) {
            console.error('Setting already registered: ' + key, element, settingsInfoMap[key].element);
            return;
        }
        let info = settingsInfoMap[key] = {
            element: element,
            enablesSetting: element.dataset.enablesSetting
        };
        if (element.type === "checkbox") {
            on(element, 'click', () => {
                if(info.enablesSetting)
                    setSettingDisabled(info.enablesSetting, !element.checked);
                settings.set(key as any, element.checked);
                settings.save();
            });
        } else {
            on(element, 'change', () => {
                settings.set(key as any, element.value);
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
            if(!info.permanentlyUnchecked) {
                if (info.element.type === 'checkbox')
                    info.element.checked = settings.get(key as any);
                else
                    info.element.value = settings.get(key as any);
            }
            if(info.enablesSetting)
                setSettingDisabled(info.enablesSetting, !info.element.checked);
        }
    }
}

export function connectSettings(parent: NodeSelector) {
    let elements = parent.querySelectorAll('input[data-settings-key]');
    for (let i = 0; i < elements.length; i++)
        connectInputSetting(elements[i] as HTMLInputElement);
    updateFromSettings();
}

export function permanentDisableSettings(keys: string[], uncheck?: boolean) {
    for (let key of keys) {
        let info = settingsInfoMap[key];
        if (info) {
            info.permanentlyDisabled = true;
            info.element.disabled = true;
            if (uncheck) {
                info.element.checked = false;
                info.permanentlyUnchecked = true;
            }
        } else {
            console.error('Element not found: ', key);
        }
    }
}