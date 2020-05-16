import { h } from "tsx-dom";
import { container } from "tsyringe";

import { Dialog, showDialog, hideDialog } from "./dialog";
import { Settings } from "../../shared/settings";

export function ResetDialog() {
    const settings = container.resolve(Settings);
    const getCleanupDataToKeep = () => ({
        "domainsToClean": settings.get("domainsToClean"),
        "domainsToClean.indexedDB": settings.get("domainsToClean.indexedDB"),
        "domainsToClean.serviceWorkers": settings.get("domainsToClean.serviceWorkers"),
        "downloadsToClean": settings.get("downloadsToClean"),
    });
    function onResetSettingsAndRules() {
        hideDialog(dialog);
        settings.setAll(getCleanupDataToKeep());
    }
    function onResetSettings() {
        hideDialog(dialog);
        settings.setAll({
            ...getCleanupDataToKeep(),
            rules: settings.get("rules"),
            fallbackRule: settings.get("fallbackRule"),
            whitelistNoTLD: settings.get("whitelistNoTLD"),
            whitelistFileSystem: settings.get("whitelistFileSystem"),
        });
    }
    function onCancel() {
        hideDialog(dialog);
    }
    const buttons = [
        <button data-i18n="confirm_settings_and_rules" onClick={onResetSettingsAndRules} />,
        <button data-i18n="confirm_settings_only" onClick={onResetSettings} />,
        <button data-i18n="confirm_cancel" onClick={onCancel} />,
    ];
    const dialog = (
        <Dialog className="reset_dialog" titleI18nKey="reset_dialog_title">
            <div data-i18n="reset_dialog_content" />
            <div class="split_equal split_wrap">{buttons}</div>
        </Dialog>
    );
    return showDialog(dialog, buttons[1]);
}
