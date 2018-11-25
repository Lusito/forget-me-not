import { h } from "tsx-dom";
import { Dialog, showDialog, hideDialog } from "./dialog";
import { on } from "../../lib/htmlUtils";
import { HelpLink } from "../helpLink";
import { SettingsCheckbox } from "../settingsCheckbox";
import { connectSettings, permanentDisableSettings } from "../../lib/htmlSettings";
import { isFirefox, browserInfo } from "../../lib/browserInfo";
import { messageUtil } from "../../lib/messageUtil";
import { SettingsKey } from "../../lib/settingsSignature";

const removeLocalStorageByHostname = isFirefox && browserInfo.versionAsNumber >= 58;

interface CleanDialogProps {
    button: HTMLElement;
}

type CleanupRow = [string, SettingsKey, SettingsKey | null];
const CLEANUP_SETTINGS: CleanupRow[] = [
    // i18n, manualCleanup, manualCleanupRules
    ["setting_cookies", "cleanAll.cookies", "cleanAll.cookies.applyRules"],
    ["setting_local_storage", "cleanAll.localStorage", "cleanAll.localStorage.applyRules"],
    ["setting_history", "cleanAll.history", "cleanAll.history.applyRules"],
    ["setting_downloads", "cleanAll.downloads", "cleanAll.downloads.applyRules"],
    ["setting_form_data", "cleanAll.formData", null],
    ["setting_passwords", "cleanAll.passwords", null],
    ["setting_indexed_db", "cleanAll.indexedDB", null],
    ["setting_plugin_data", "cleanAll.pluginData", null],
    ["setting_service_workers", "cleanAll.serviceWorkers", null]
];

export function CleanDialog({ button }: CleanDialogProps) {
    function onOK() {
        hideDialog(dialog);
        messageUtil.send("cleanAllNow");
    }
    function onCancel() {
        hideDialog(dialog);
    }

    const rows = CLEANUP_SETTINGS.map(([i18n, manualCleanup, manualCleanupRules]) => {
        return <tr>
            <td data-i18n={i18n} />
            <td>{manualCleanup && <SettingsCheckbox key={manualCleanup} />}</td>
            <td>{manualCleanupRules && <SettingsCheckbox key={manualCleanupRules} enabledBy={manualCleanup || undefined} />}</td>
        </tr>;
    });
    const buttons = [
        <button data-i18n="button_clean_now" onClick={onOK} />,
        <button data-i18n="prompt_cancel" onClick={onCancel} />
    ];

    const legend = !browserInfo.mobile && <ul class="settings_legend">
        <li><img src="../icons/tabs/delete.svg" /> <span data-i18n="perform_manual_cleanup" /></li>
        <li><img src="../icons/tabs/shield.svg" /> <span data-i18n="setting_apply_rules@title" /></li>
        <li><b class="unsupported_checkbox">X</b> <span data-i18n="settings_unsupported_checkbox@title" /></li>
    </ul>;

    const dialog = <Dialog className="clean_dialog" titleI18nKey="perform_manual_cleanup">
        <div>
            { legend }
            <table class="settings_table">
                <thead>
                    <tr>
                        <th><span>Cleanable Data</span><HelpLink i18n="types_of_cleanup?title" href="readme.html#tutorial" /></th>
                        <th><img src="../icons/tabs/delete.svg" /></th>
                        <th><img src="../icons/tabs/shield.svg" /></th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
            <div><SettingsCheckbox key="cleanAll.protectOpenDomains" i18n="setting_protect_open_domains" /></div>
        </div>
        <div class="split_equal split_wrap">{buttons}</div>
    </Dialog>;
    on(button, "click", () =>  showDialog(dialog, buttons[0]));
    connectSettings(dialog);
    if (!removeLocalStorageByHostname)
        permanentDisableSettings(["cleanAll.localStorage.applyRules"], true);
    return dialog;
}
