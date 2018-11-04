import { h } from "tsx-dom";
import { SettingsCheckbox } from "../../settingsCheckbox";
import { SettingsNumber } from "../../settingsNumber";
import { HelpLink } from "../../helpLink";
import "./style.scss";
import { browserInfo } from "../../../lib/browserInfo";

export const CLEANUP_SETTINGS = [
    // i18n, startup, startupRules, domainLeave, manualCleanup, manualCleanupRules
    ["setting_cookies", "startup.cookies", "startup.cookies.applyRules", "domainLeave.cookies", "cleanAll.cookies", "cleanAll.cookies.applyRules"],
    ["setting_local_storage", "startup.localStorage", "startup.localStorage.applyRules", "domainLeave.localStorage", "cleanAll.localStorage", "cleanAll.localStorage.applyRules"],
    ["setting_history", "startup.history", null, null, "cleanAll.history", null],
    ["setting_downloads", "startup.downloads", null, null, "cleanAll.downloads", null],
    ["setting_form_data", "startup.formData", null, null, "cleanAll.formData", null],
    ["setting_passwords", "startup.passwords", null, null, "cleanAll.passwords", null],
    ["setting_indexed_db", "startup.indexedDB", null, null, "cleanAll.indexedDB", null],
    ["setting_plugin_data", "startup.pluginData", null, null, "cleanAll.pluginData", null],
    ["setting_service_workers", "startup.serviceWorkers", null, null, "cleanAll.serviceWorkers", null]
];

export function CleanupTab() {
    const rows = CLEANUP_SETTINGS.map(([i18n, startup, startupRules, domainLeave, manualCleanup, manualCleanupRules]) => {
        return <tr>
            <td data-i18n={i18n} />
            <td>{startup && <SettingsCheckbox key={startup} enabledBy="startup.enabled" i18n="cleanup_type_startup?title" />}</td>
            <td>{startupRules && <SettingsCheckbox key={startupRules} enabledBy={`startup.enabled ${startup}`} i18n="setting_apply_rules?title" />}</td>
            <td>{domainLeave && <SettingsCheckbox key={domainLeave} enabledBy="domainLeave.enabled" i18n="cleanup_type_leave?title" />}</td>
        </tr>;
    });

    const legend = browserInfo.mobile && <ul class="settings_legend">
        <li><img src="../icons/tabs/power.svg" /> <span data-i18n="cleanup_type_startup@title" /></li>
        <li><img src="../icons/tabs/shield.svg" /> <span data-i18n="setting_apply_rules@title" /></li>
        <li><img src="../icons/tabs/exit.svg" /> <span data-i18n="cleanup_type_leave@title" /></li>
    </ul>;

    return <div class="active">
        { legend }
        <table class="settings_table">
            <thead>
                <tr>
                    <th><span>Cleanable Data</span><HelpLink i18n="types_of_cleanup?title" href="readme.html#tutorial" /></th>
                    <th><img src="../icons/tabs/power.svg" data-i18n="cleanup_type_startup?title" /></th>
                    <th><img src="../icons/tabs/shield.svg" data-i18n="setting_type_apply_rules?title" /></th>
                    <th><img src="../icons/tabs/exit.svg" data-i18n="cleanup_type_leave?title" /></th>
                </tr>
                <tr>
                    <th>Enable</th>
                    <th><SettingsCheckbox key="startup.enabled" i18n="cleanup_type_startup?title" /></th>
                    <th />
                    <th><SettingsCheckbox key="domainLeave.enabled" i18n="cleanup_type_leave?title" /></th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>

        <div class="split_equal">
            <div />
            <SettingsNumber key="domainLeave.delay" i18n="setting_delay_domain_leave_cleanup_in_minutes" class="align_right" />
        </div>
        <div class="split_equal">
            <SettingsCheckbox key="cleanThirdPartyCookies.enabled" i18n="setting_remove_thirdparty" />
            <SettingsNumber key="cleanThirdPartyCookies.delay" i18n="setting_delay_in_minutes" class="align_right" />
        </div>
    </div>;
}
