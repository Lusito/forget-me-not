import { h } from "tsx-dom";

import { SettingsCheckbox } from "../../settingsCheckbox";
import { SettingsNumber } from "../../settingsNumber";
import { HelpLink } from "../../helpLink";
import "./style.scss";
import { browserInfo } from "../../../lib/browserInfo";
import { SettingsKey } from "../../../lib/settingsSignature";

type CleanupRow = [string, SettingsKey, SettingsKey | null, SettingsKey | null, SettingsKey | null, SettingsKey | null];
// prettier-ignore
const CLEANUP_SETTINGS: CleanupRow[] = [
    // i18n, startup, startupRules, domainLeave, instantly, instantlyRules
    ["setting_cookies", "startup.cookies", "startup.cookies.applyRules", "domainLeave.cookies", "instantly.cookies", null],
    ["setting_local_storage", "startup.localStorage", "startup.localStorage.applyRules", "domainLeave.localStorage", null, null],
    ["setting_history", "startup.history", "startup.history.applyRules", "domainLeave.history", "instantly.history", "instantly.history.applyRules"],
    ["setting_downloads", "startup.downloads", "startup.downloads.applyRules", "domainLeave.downloads", "instantly.downloads", "instantly.downloads.applyRules"],
    ["setting_form_data", "startup.formData", null, null, null, null],
    ["setting_passwords", "startup.passwords", null, null, null, null],
    ["setting_indexed_db", "startup.indexedDB", null, null, null, null],
    ["setting_plugin_data", "startup.pluginData", null, null, null, null],
    ["setting_service_workers", "startup.serviceWorkers", null, null, null, null],
    ["setting_cache", "startup.cache", null, null, null, null],
];

export function CleanupTab() {
    const rows = CLEANUP_SETTINGS.map(([i18n, startup, startupRules, domainLeave, instantly, instantlyRules]) => {
        return (
            <tr>
                <td data-i18n={i18n} />
                <td class="cleanup_type_startup">
                    {startup && (
                        <SettingsCheckbox
                            key={startup}
                            enabledBy="startup.enabled"
                            i18n="cleanup_type_startup_button?title"
                        />
                    )}
                </td>
                <td class="cleanup_type_startup apply_rules_checkbox">
                    {startupRules && (
                        <SettingsCheckbox
                            key={startupRules}
                            enabledBy={`startup.enabled ${startup}`}
                            i18n="setting_apply_rules?title"
                            i18nUnchecked="setting_ignore_rules?title"
                        />
                    )}
                </td>
                <td class="cleanup_type_leave">
                    {domainLeave && (
                        <SettingsCheckbox
                            key={domainLeave}
                            enabledBy="domainLeave.enabled"
                            i18n="cleanup_type_leave_button?title"
                        />
                    )}
                </td>
                <td class="cleanup_type_instantly">
                    {instantly && (
                        <SettingsCheckbox
                            key={instantly}
                            enabledBy="instantly.enabled"
                            i18n="cleanup_type_instantly_button?title"
                        />
                    )}
                </td>
                <td class="cleanup_type_instantly apply_rules_checkbox">
                    {instantlyRules && (
                        <SettingsCheckbox
                            key={instantlyRules}
                            enabledBy={`instantly.enabled ${instantly}`}
                            i18n="setting_apply_rules?title"
                            i18nUnchecked="setting_ignore_rules?title"
                        />
                    )}
                </td>
            </tr>
        );
    });

    const legend = browserInfo.mobile && (
        <ul class="settings_legend">
            <li>
                <img src="../icons/tabs/power.svg" /> <span data-i18n="cleanup_type_startup_button@title" />
            </li>
            <li>
                <img src="../icons/tabs/shield.svg" /> <span data-i18n="setting_apply_rules@title" />
            </li>
            <li>
                <img src="../icons/tabs/exit.svg" /> <span data-i18n="cleanup_type_leave_button@title" />
            </li>
            <li>
                <img src="../icons/tabs/stop.svg" /> <span data-i18n="cleanup_type_instantly_button@title" />
            </li>
            <li>
                <b class="unsupported_checkbox">X</b> <span data-i18n="settings_unsupported_checkbox@title" />
            </li>
        </ul>
    );

    return (
        <div class="active">
            {legend}
            <table class="settings_table">
                <thead>
                    <tr>
                        <th>
                            <span data-i18n="settings_cleanable_data" />
                            <HelpLink i18n="types_of_cleanup?title" href="readme.html#tutorial" />
                        </th>
                        <th class="cleanup_type_startup" data-i18n="cleanup_type_startup_button?title">
                            <span data-i18n="cleanup_type_startup_badge" />
                        </th>
                        <th class="cleanup_type_startup">
                            <img src="../icons/tabs/shield_white.svg" data-i18n="setting_apply_rules?title" />
                        </th>
                        <th class="cleanup_type_leave" data-i18n="cleanup_type_leave_button?title">
                            <span data-i18n="cleanup_type_leave_badge" />
                        </th>
                        <th class="cleanup_type_instantly" data-i18n="cleanup_type_instantly_button?title">
                            <span data-i18n="cleanup_type_instantly_badge" />
                        </th>
                        <th class="cleanup_type_instantly">
                            <img src="../icons/tabs/shield_white.svg" data-i18n="setting_apply_rules?title" />
                        </th>
                    </tr>
                    <tr>
                        <th data-i18n="settings_enable" />
                        <th class="cleanup_type_startup">
                            <SettingsCheckbox key="startup.enabled" i18n="cleanup_type_startup_button?title" />
                        </th>
                        <th class="cleanup_type_startup" />
                        <th class="cleanup_type_leave">
                            <SettingsCheckbox key="domainLeave.enabled" i18n="cleanup_type_leave_button?title" />
                        </th>
                        <th class="cleanup_type_instantly">
                            <SettingsCheckbox key="instantly.enabled" i18n="cleanup_type_instantly_button?title" />
                        </th>
                        <th class="cleanup_type_instantly" />
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>

            <div class="split_equal">
                <div />
                <SettingsNumber
                    key="domainLeave.delay"
                    i18n="setting_delay_domain_leave_cleanup_in_seconds"
                    class="align_right"
                />
            </div>
            <div class="split_equal">
                <SettingsCheckbox key="cleanThirdPartyCookies.enabled" i18n="setting_remove_thirdparty" />
                <SettingsNumber
                    key="cleanThirdPartyCookies.delay"
                    i18n="setting_delay_in_seconds"
                    class="align_right"
                />
            </div>
        </div>
    );
}
