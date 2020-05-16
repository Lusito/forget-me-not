import { h } from "tsx-dom";
import { container } from "tsyringe";

import { SettingsCheckbox } from "../../settingsCheckbox";
import { SettingsNumber } from "../../settingsNumber";
import { HelpLink } from "../../helpLink";
import "./style.scss";
import { SettingsKey } from "../../../shared/defaultSettings";
import icons from "../../../icons";
import { BrowserInfo } from "../../../shared/browserInfo";

interface CleanupRow {
    i18n: string;
    startup: SettingsKey;
    startupRules?: SettingsKey;
    domainLeave?: SettingsKey;
    instantly?: SettingsKey;
    instantlyRules?: SettingsKey;
}

const CLEANUP_SETTINGS: CleanupRow[] = [
    {
        i18n: "setting_cookies",
        startup: "startup.cookies",
        startupRules: "startup.cookies.applyRules",
        domainLeave: "domainLeave.cookies",
        instantly: "instantly.cookies",
    },
    {
        i18n: "setting_local_storage",
        startup: "startup.localStorage",
        startupRules: "startup.localStorage.applyRules",
        domainLeave: "domainLeave.localStorage",
    },
    {
        i18n: "setting_history",
        startup: "startup.history",
        startupRules: "startup.history.applyRules",
        domainLeave: "domainLeave.history",
        instantly: "instantly.history",
        instantlyRules: "instantly.history.applyRules",
    },
    {
        i18n: "setting_downloads",
        startup: "startup.downloads",
        startupRules: "startup.downloads.applyRules",
        domainLeave: "domainLeave.downloads",
        instantly: "instantly.downloads",
        instantlyRules: "instantly.downloads.applyRules",
    },
    { i18n: "setting_form_data", startup: "startup.formData" },
    { i18n: "setting_passwords", startup: "startup.passwords" },
    {
        i18n: "setting_indexed_db",
        startup: "startup.indexedDB",
        startupRules: "startup.indexedDB.applyRules",
        domainLeave: "domainLeave.indexedDB",
    },
    { i18n: "setting_plugin_data", startup: "startup.pluginData" },
    {
        i18n: "setting_service_workers",
        startup: "startup.serviceWorkers",
        startupRules: "startup.serviceWorkers.applyRules",
        domainLeave: "domainLeave.serviceWorkers",
    },
    { i18n: "setting_cache", startup: "startup.cache" },
];

export function CleanupTab() {
    const rows = CLEANUP_SETTINGS.map(({ i18n, startup, startupRules, domainLeave, instantly, instantlyRules }) => {
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

    const browserInfo = container.resolve(BrowserInfo);
    const legend = browserInfo.isMobile() && (
        <ul class="settings_legend">
            <li>
                <img src={icons.power} /> <span data-i18n="cleanup_type_startup_button@title" />
            </li>
            <li>
                <img src={icons.shield} /> <span data-i18n="setting_apply_rules@title" />
            </li>
            <li>
                <img src={icons.exit} /> <span data-i18n="cleanup_type_leave_button@title" />
            </li>
            <li>
                <img src={icons.stop} /> <span data-i18n="cleanup_type_instantly_button@title" />
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
                            <img src={icons.shieldWhite} data-i18n="setting_apply_rules?title" />
                        </th>
                        <th class="cleanup_type_leave" data-i18n="cleanup_type_leave_button?title">
                            <span data-i18n="cleanup_type_leave_badge" />
                        </th>
                        <th class="cleanup_type_instantly" data-i18n="cleanup_type_instantly_button?title">
                            <span data-i18n="cleanup_type_instantly_badge" />
                        </th>
                        <th class="cleanup_type_instantly">
                            <img src={icons.shieldWhite} data-i18n="setting_apply_rules?title" />
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
