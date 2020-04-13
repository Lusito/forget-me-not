import { h } from "tsx-dom";
import { browser } from "webextension-polyfill-ts";

import { SettingsCheckbox } from "../../settingsCheckbox";
import { loadJSONFile, saveJSONFile } from "../../../lib/fileHelper";
import { ResetDialog } from "../../dialogs/resetDialog";
import { EXPORT_IGNORE_KEYS } from "../../../lib/defaultSettings";
import { ExtensionContext, ExtensionContextProps } from "../../../lib/bootstrap";

function onImport({ browserInfo, settings }: ExtensionContext) {
    // desktop firefox closes popup when dialog is shown
    if (browserInfo.firefox && !browserInfo.mobile) {
        browser.tabs.create({
            url: browser.runtime.getURL("dist/import.html"),
            active: true,
        });
        window.close();
    } else {
        loadJSONFile((json) => {
            json && settings.setAll(json);
        });
    }
}

function onExport({ settings }: ExtensionContext) {
    const exported = settings.getAll();
    EXPORT_IGNORE_KEYS.forEach((key) => delete exported[key]);
    // Remove temporary rules
    exported.rules = exported.rules.filter((rule) => !rule.temporary);
    saveJSONFile(exported, "forget-me-not-settings.json");
}

function onReset(context: ExtensionContext) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    <ResetDialog context={context} />;
}

export function GeneralTab({ context }: ExtensionContextProps) {
    return (
        <div>
            <div>
                <SettingsCheckbox
                    key="showUpdateNotification"
                    i18n="setting_show_update_notification"
                    context={context}
                />
            </div>
            <div>
                <SettingsCheckbox
                    key="showCookieRemovalNotification"
                    i18n="setting_show_cookie_removal_notification"
                    context={context}
                />
            </div>
            <div>
                <SettingsCheckbox key="showBadge" i18n="setting_show_badge" context={context} />
            </div>
            <div>
                <label>
                    <span data-i18n="setting_initialTab" />
                    <select data-settings-key="initialTab">
                        <option data-i18n="initial_tab_last_active" value="last_active_tab" />
                        <option data-i18n="initial_tab_this_tab" value="this_tab" />
                        <option data-i18n="initial_tab_rules" value="rules" />
                        <option data-i18n="initial_tab_settings" value="settings" />
                        <option data-i18n="initial_tab_log" value="log" />
                    </select>
                </label>
            </div>
            <div class="split_equal split_wrap top_margin">
                <button data-i18n="button_import" onClick={() => onImport(context)} />
                <button data-i18n="button_export" onClick={() => onExport(context)} />
                <button data-i18n="button_reset" onClick={() => onReset(context)} />
            </div>
        </div>
    );
}
