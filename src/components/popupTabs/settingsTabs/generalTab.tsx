import { h } from "tsx-dom";
import { browser } from "webextension-polyfill-ts";
import { container } from "tsyringe";

import { SettingsCheckbox } from "../../settingsCheckbox";
import { loadJSONFile, saveJSONFile } from "../../../shared/fileHelper";
import { ResetDialog } from "../../dialogs/resetDialog";
import { EXPORT_IGNORE_KEYS } from "../../../shared/defaultSettings";
import { Settings } from "../../../shared/settings";
import { BrowserInfo, BrowserType } from "../../../shared/browserInfo";

function onImport() {
    const browserInfo = container.resolve(BrowserInfo);

    // desktop firefox closes popup when dialog is shown
    if (browserInfo.type === BrowserType.FIREFOX) {
        browser.tabs.create({
            url: browser.runtime.getURL("dist/import.html"),
            active: true,
        });
        window.close();
    } else {
        loadJSONFile((json) => {
            json && container.resolve(Settings).setAll(json);
        });
    }
}

function onExport() {
    const settings = container.resolve(Settings);
    const exported = settings.getAll();
    EXPORT_IGNORE_KEYS.forEach((key) => delete exported[key]);
    // Remove temporary rules
    exported.rules = exported.rules.filter((rule) => !rule.temporary);
    saveJSONFile(exported, "forget-me-not-settings.json");
}

function onReset() {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    <ResetDialog />;
}

export function GeneralTab() {
    return (
        <div>
            <div>
                <SettingsCheckbox key="showUpdateNotification" i18n="setting_show_update_notification" />
            </div>
            <div>
                <SettingsCheckbox key="showCookieRemovalNotification" i18n="setting_show_cookie_removal_notification" />
            </div>
            <div>
                <SettingsCheckbox key="showBadge" i18n="setting_show_badge" />
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
                <button data-i18n="button_import" onClick={() => onImport()} />
                <button data-i18n="button_export" onClick={() => onExport()} />
                <button data-i18n="button_reset" onClick={() => onReset()} />
            </div>
        </div>
    );
}
