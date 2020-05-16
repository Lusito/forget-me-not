import { h } from "tsx-dom";
import { container } from "tsyringe";

import { Dialog, showDialog, hideDialog } from "./dialog";
import { on } from "../../frontend/htmlUtils";
import { HelpLink } from "../helpLink";
import { SettingsCheckbox } from "../settingsCheckbox";
import { connectSettings } from "../../frontend/htmlSettings";
import { MessageUtil } from "../../shared/messageUtil";
import { SettingsKey } from "../../shared/defaultSettings";
import icons from "../../icons";
import { BrowserInfo } from "../../shared/browserInfo";

interface CleanDialogProps {
    button: HTMLElement;
}

interface CleanupRow {
    i18n: string;
    manualCleanup: SettingsKey;
    manualCleanupRules?: SettingsKey;
}

const CLEANUP_SETTINGS: CleanupRow[] = [
    { i18n: "setting_cookies", manualCleanup: "cleanAll.cookies", manualCleanupRules: "cleanAll.cookies.applyRules" },
    {
        i18n: "setting_local_storage",
        manualCleanup: "cleanAll.localStorage",
        manualCleanupRules: "cleanAll.localStorage.applyRules",
    },
    { i18n: "setting_history", manualCleanup: "cleanAll.history", manualCleanupRules: "cleanAll.history.applyRules" },
    {
        i18n: "setting_downloads",
        manualCleanup: "cleanAll.downloads",
        manualCleanupRules: "cleanAll.downloads.applyRules",
    },
    { i18n: "setting_form_data", manualCleanup: "cleanAll.formData" },
    { i18n: "setting_passwords", manualCleanup: "cleanAll.passwords" },
    {
        i18n: "setting_indexed_db",
        manualCleanup: "cleanAll.indexedDB",
        manualCleanupRules: "cleanAll.indexedDB.applyRules",
    },
    { i18n: "setting_plugin_data", manualCleanup: "cleanAll.pluginData" },
    {
        i18n: "setting_service_workers",
        manualCleanup: "cleanAll.serviceWorkers",
        manualCleanupRules: "cleanAll.serviceWorkers.applyRules",
    },
    { i18n: "setting_cache", manualCleanup: "cleanAll.cache" },
];

export function CleanDialog({ button }: CleanDialogProps) {
    function onOK() {
        hideDialog(dialog);
        container.resolve(MessageUtil).send("cleanAllNow");
    }
    function onCancel() {
        hideDialog(dialog);
    }

    const rows = CLEANUP_SETTINGS.map(({ i18n, manualCleanup, manualCleanupRules }) => {
        return (
            <tr>
                <td data-i18n={i18n} />
                <td class="cleanup_type_manual">{manualCleanup && <SettingsCheckbox key={manualCleanup} />}</td>
                <td class="cleanup_type_manual apply_rules_checkbox">
                    {manualCleanupRules && (
                        <SettingsCheckbox
                            key={manualCleanupRules}
                            enabledBy={manualCleanup || undefined}
                            i18n="setting_apply_rules?title"
                            i18nUnchecked="setting_ignore_rules?title"
                        />
                    )}
                </td>
            </tr>
        );
    });
    const buttons = [
        <button data-i18n="button_clean_now" onClick={onOK} />,
        <button data-i18n="prompt_cancel" onClick={onCancel} />,
    ];

    const browserInfo = container.resolve(BrowserInfo);
    const legend = browserInfo.isMobile() && (
        <ul class="settings_legend">
            <li>
                <img src={icons.trash} /> <span data-i18n="perform_manual_cleanup" />
            </li>
            <li>
                <img src={icons.shield} /> <span data-i18n="setting_apply_rules@title" />
            </li>
            <li>
                <b class="unsupported_checkbox">X</b> <span data-i18n="settings_unsupported_checkbox@title" />
            </li>
        </ul>
    );

    const dialog = (
        <Dialog className="clean_dialog" titleI18nKey="perform_manual_cleanup">
            <div>
                {legend}
                <table class="settings_table">
                    <thead>
                        <tr>
                            <th>
                                <span data-i18n="settings_cleanable_data" />
                                <HelpLink i18n="types_of_cleanup?title" href="readme.html#tutorial" />
                            </th>
                            <th class="cleanup_type_manual">
                                <img src={icons.trashWhite} />
                            </th>
                            <th class="cleanup_type_manual">
                                <img src={icons.shieldWhite} data-i18n="setting_apply_rules?title" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
                <div>
                    <SettingsCheckbox key="cleanAll.protectOpenDomains" i18n="setting_protect_open_domains" />
                </div>
            </div>
            <div class="split_equal split_wrap">{buttons}</div>
        </Dialog>
    );
    on(button, "click", () => showDialog(dialog, buttons[0]));
    connectSettings(dialog);
    return dialog;
}
