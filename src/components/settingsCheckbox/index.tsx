import { h } from "tsx-dom";

import { SettingsKey, getUnsupportedSettings } from "../../lib/defaultSettings";
import "./style.scss";
import { on, translateElement } from "../../frontend/htmlUtils";
import { ExtensionContext } from "../../lib/bootstrap";

interface SettingsCheckboxProps {
    key: SettingsKey;
    i18n?: string;
    i18nUnchecked?: string;
    enabledBy?: string;
    context: ExtensionContext;
}

export function SettingsCheckbox({ key, i18n, i18nUnchecked, enabledBy, context }: SettingsCheckboxProps) {
    const unsupported = getUnsupportedSettings(context);
    if (unsupported.includes(key))
        return (
            <b class="unsupported_checkbox" data-i18n="settings_unsupported_checkbox?title">
                X
            </b>
        );
    const input = (
        <input type="checkbox" data-settings-key={key} data-settings-enabled-by={enabledBy} />
    ) as HTMLInputElement;
    const span = <span data-i18n={i18n} />;
    if (i18n && i18nUnchecked) {
        on(input, "change", () => {
            span.setAttribute("data-i18n", input.checked ? i18n : i18nUnchecked);
            translateElement(span);
        });
    }
    return (
        <label>
            {input}
            {span}
        </label>
    );
}
