import { h } from "tsx-dom";
import { SettingsCheckbox } from "../../settingsCheckbox";
import { SettingsNumber } from "../../settingsNumber";
import { HelpLink } from "../../helpLink";
import "./style.scss";
import { browserInfo } from "../../../lib/browserInfo";
import { SettingsKey } from "../../../lib/settingsSignature";

type CleanupRow = [string, SettingsKey, SettingsKey | null, SettingsKey | null, SettingsKey | null, SettingsKey | null];
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
    ["setting_cache", "startup.cache", null, null, null, null]
];

export function CleanupTab() {
    const rows = CLEANUP_SETTINGS.map(([i18n, startup, startupRules, domainLeave, instantly, instantlyRules]) => {
        return <tr>
            <td data-i18n={i18n} />
            <td>{startup && <SettingsCheckbox key={startup} enabledBy="startup.enabled" i18n="cleanup_type_startup_button?title" />}</td>
            <td>{startupRules && <SettingsCheckbox key={startupRules} enabledBy={`startup.enabled ${startup}`} i18n="setting_apply_rules?title" />}</td>
            <td>{domainLeave && <SettingsCheckbox key={domainLeave} enabledBy="domainLeave.enabled" i18n="cleanup_type_leave_button?title" />}</td>
            <td>{instantly && <SettingsCheckbox key={instantly} enabledBy="instantly.enabled" i18n="cleanup_type_instantly_button?title" />}</td>
            <td>{instantlyRules && <SettingsCheckbox key={instantlyRules} enabledBy={`instantly.enabled ${instantly}`} i18n="setting_apply_rules?title" />}</td>
        </tr>;
    });

    const legend = browserInfo.mobile && <ul class="settings_legend">
        <li><img src="../icons/tabs/power.svg" /> <span data-i18n="cleanup_type_startup_button@title" /></li>
        <li><img src="../icons/tabs/shield.svg" /> <span data-i18n="setting_apply_rules@title" /></li>
        <li><img src="../icons/tabs/exit.svg" /> <span data-i18n="cleanup_type_leave_button@title" /></li>
        <li><img src="../icons/tabs/stop.svg" /> <span data-i18n="cleanup_type_instantly_button@title" /></li>
        <li><b class="unsupported_checkbox">X</b> <span data-i18n="settings_unsupported_checkbox@title" /></li>
    </ul>;

    return <div class="active">
        {legend}
        <table class="settings_table">
            <thead>
                <tr>
                    <th><span>Cleanable Data</span><HelpLink i18n="types_of_cleanup?title" href="readme.html#tutorial" /></th>
                    <th><img src="../icons/tabs/power.svg" data-i18n="cleanup_type_startup_button?title" /></th>
                    <th><img src="../icons/tabs/shield.svg" data-i18n="setting_apply_rules?title" /></th>
                    <th><img src="../icons/tabs/exit.svg" data-i18n="cleanup_type_leave_button?title" /></th>
                    <th><img src="../icons/tabs/stop.svg" data-i18n="cleanup_type_instantly_button?title" /></th>
                    <th><img src="../icons/tabs/shield.svg" data-i18n="setting_apply_rules?title" /></th>
                </tr>
                <tr>
                    <th>Enable</th>
                    <th><SettingsCheckbox key="startup.enabled" i18n="cleanup_type_startup_button?title" /></th>
                    <th />
                    <th><SettingsCheckbox key="domainLeave.enabled" i18n="cleanup_type_leave_button?title" /></th>
                    <th><SettingsCheckbox key="instantly.enabled" i18n="cleanup_type_instantly_button?title" /></th>
                    <th />
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>

        <div class="split_equal">
            <div />
            <SettingsNumber key="domainLeave.delay" i18n="setting_delay_domain_leave_cleanup_in_seconds" class="align_right" />
        </div>
        <div class="split_equal">
            <SettingsCheckbox key="cleanThirdPartyCookies.enabled" i18n="setting_remove_thirdparty" />
            <SettingsNumber key="cleanThirdPartyCookies.delay" i18n="setting_delay_in_seconds" class="align_right" />
        </div>
    </div>;
}
