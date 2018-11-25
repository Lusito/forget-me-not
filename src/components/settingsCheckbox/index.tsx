import { h } from "tsx-dom";
import { SettingsKey } from "../../lib/settingsSignature";
import { browserInfo } from "../../lib/browserInfo";
import "./style.scss";

interface SettingsCheckboxProps {
    key: SettingsKey;
    i18n?: string;
    enabledBy?: string;
}

const UNSUPPORTED = browserInfo.mobile ? [
    "cleanAll.localStorage", "cleanAll.localStorage.applyRules", "startup.localStorage", "startup.localStorage.applyRules", "domainLeave.localStorage",
    "cleanAll.history.applyRules", "startup.history.applyRules", "domainLeave.history", "instantly.history", "instantly.history.applyRules",
    "cleanAll.passwords", "startup.passwords",
    "cleanAll.indexedDB", "startup.indexedDB",
    "cleanAll.pluginData", "startup.pluginData",
    "cleanAll.serviceWorkers", "startup.serviceWorkers"
] : [];

export function SettingsCheckbox({ key, i18n, enabledBy }: SettingsCheckboxProps) {
    if (UNSUPPORTED.indexOf(key) >= 0)
        return <b class="unsupported_checkbox" data-i18n="settings_unsupported_checkbox?title">X</b>;
    return <label><input type="checkbox" data-settings-key={key} data-settings-enabled-by={enabledBy} /><span data-i18n={i18n} /></label>;
}
