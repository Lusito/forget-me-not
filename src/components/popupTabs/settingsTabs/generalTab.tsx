import { h } from "tsx-dom";
import { SettingsCheckbox } from "../../settingsCheckbox";
import { isFirefox, browserInfo } from "../../../lib/browserInfo";
import { browser } from "webextension-polyfill-ts";
import { loadJSONFile, saveJSONFile } from "../../../lib/fileHelper";
import { settings } from "../../../lib/settings";
import { ResetDialog } from "../../dialogs/resetDialog";
import { EXPORT_IGNORE_KEYS } from "../../../lib/settingsSignature";

function onImport() {
    // desktop firefox closes popup when dialog is shown
    if (isFirefox && !browserInfo.mobile) {
        browser.tabs.create({
            url: browser.runtime.getURL("views/import.html"),
            active: true
        });
        window.close();
    } else {
        loadJSONFile((json) => {
            json && settings.setAll(json);
        });
    }
}

function onExport() {
    const exported = settings.getAll();
    EXPORT_IGNORE_KEYS.forEach((key) => delete exported[key]);
    saveJSONFile(exported, "forget-me-not-settings.json");
}

function onReset() {
    <ResetDialog />;
}

export function GeneralTab() {
    return <div>
        <div><SettingsCheckbox key="showUpdateNotification" i18n="setting_show_update_notification" /></div>
        <div><SettingsCheckbox key="showCookieRemovalNotification" i18n="setting_show_cookie_removal_notification" /></div>
        <div><SettingsCheckbox key="showBadge" i18n="setting_show_badge" /></div>
        <div><label><span data-i18n="setting_initialTab" /><select data-settings-key="initialTab">
            <option data-i18n="initial_tab_last_active" value="last_active_tab" />
            <option data-i18n="initial_tab_this_tab" value="this_tab" />
            <option data-i18n="initial_tab_rules" value="rules" />
            <option data-i18n="initial_tab_settings" value="settings" />
            <option data-i18n="initial_tab_log" value="log" />
        </select></label></div>
        <div class="split_equal split_wrap top_margin">
            <button data-i18n="button_import" onClick={onImport} />
            <button data-i18n="button_export" onClick={onExport} />
            <button data-i18n="button_reset" onClick={onReset} />
        </div>
    </div>;
}
