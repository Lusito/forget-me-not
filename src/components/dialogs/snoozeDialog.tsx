import { h } from "tsx-dom";

import { Dialog, showDialog, hideDialog } from "./dialog";
import { translateChildren } from "../../lib/htmlUtils";

interface SnoozeDialogProps {
    snoozing: boolean;
    toggle: () => void;
}

export function SnoozeDialog({ snoozing, toggle }: SnoozeDialogProps) {
    function onOK() {
        hideDialog(dialog);
        toggle();
    }
    function onCancel() {
        hideDialog(dialog);
    }
    const i18n = `button_toggle_snooze_${snoozing}`;
    const buttons = [
        <button data-i18n={i18n} onClick={onOK} />,
        <button data-i18n="confirm_cancel" onClick={onCancel} />,
    ] as HTMLButtonElement[];
    const dialog = (
        <Dialog className="snooze_dialog" titleI18nKey={i18n}>
            <div data-i18n="toggle_snooze_description?markdown" />
            <div class="split_equal split_wrap">{buttons}</div>
        </Dialog>
    );
    translateChildren(dialog);

    return showDialog(dialog, buttons[0]);
}
