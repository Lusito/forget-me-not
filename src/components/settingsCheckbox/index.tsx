import { h } from "tsx-dom";

interface SettingsCheckboxProps {
    key: string;
    i18n?: string;
    enabledBy?: string;
}

export function SettingsCheckbox({ key, i18n, enabledBy }: SettingsCheckboxProps) {
    return <label><input type="checkbox" data-settings-key={key} data-settings-enabled-by={enabledBy} /><span data-i18n={i18n} /></label>;
}
