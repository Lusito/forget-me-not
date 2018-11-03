import { h } from "tsx-dom";
import { Dialog, showDialog, hideDialog } from "./dialog";
import { settings } from "../../lib/settings";

export function ResetDialog() {
    function onResetSettingsAndRules() {
        hideDialog(dialog);
        settings.setAll({
            domainsToClean: settings.get("domainsToClean")
        });
    }
    function onResetSettings() {
        hideDialog(dialog);
        settings.setAll({
            domainsToClean: settings.get("domainsToClean"),
            rules: settings.get("rules"),
            fallbackRule: settings.get("fallbackRule"),
            whitelistNoTLD: settings.get("whitelistNoTLD"),
            whitelistFileSystem: settings.get("whitelistFileSystem")
        });
    }
    function onCancel() {
        hideDialog(dialog);
    }
    const buttons = [
        <button data-i18n="confirm_settings_and_rules" onClick={onResetSettingsAndRules} />,
        <button data-i18n="confirm_settings_only" onClick={onResetSettings} />,
        <button data-i18n="confirm_cancel" onClick={onCancel} />
    ];
    const dialog = <Dialog className="reset_dialog" titleI18nKey="reset_dialog_title">
        <div data-i18n="reset_dialog_content"></div>
        <div class="split_equal split_wrap">{buttons}</div>
    </Dialog>;
    return showDialog(dialog, buttons[1]);
}
