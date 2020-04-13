import { h } from "tsx-dom";

import { SettingsKey } from "../../lib/settingsSignature";
import { isFirefox, browserInfo } from "../../lib/browserInfo";
import "./style.scss";
import { on, translateElement } from "../../lib/htmlUtils";

interface SettingsCheckboxProps {
    key: SettingsKey;
    i18n?: string;
    i18nUnchecked?: string;
    enabledBy?: string;
}

const UNSUPPORTED = browserInfo.mobile
    ? [
          "cleanAll.localStorage",
          "cleanAll.localStorage.applyRules",
          "startup.localStorage",
          "startup.localStorage.applyRules",
          "domainLeave.localStorage",
          "cleanAll.history.applyRules",
          "startup.history.applyRules",
          "domainLeave.history",
          "instantly.history",
          "instantly.history.applyRules",
          "cleanAll.passwords",
          "startup.passwords",
          "cleanAll.indexedDB",
          "startup.indexedDB",
          "cleanAll.pluginData",
          "startup.pluginData",
          "cleanAll.serviceWorkers",
          "startup.serviceWorkers",
      ]
    : [];

const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

if (!removeLocalStorageByHostname) {
    UNSUPPORTED.push("cleanAll.localStorage.applyRules");
    UNSUPPORTED.push("domainLeave.localStorage");
    UNSUPPORTED.push("startup.localStorage.applyRules");
}

export function SettingsCheckbox({ key, i18n, i18nUnchecked, enabledBy }: SettingsCheckboxProps) {
    if (UNSUPPORTED.includes(key))
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
