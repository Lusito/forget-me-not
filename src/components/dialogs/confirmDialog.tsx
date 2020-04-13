import { h } from "tsx-dom";

import { Dialog, showDialog, hideDialog } from "./dialog";

interface ConfirmDialogProps {
    titleI18nKey: string;
    contentI18nKey?: string;
    content?: string;
    onClose: (value: boolean) => void;
}

export function ConfirmDialog({ titleI18nKey, contentI18nKey, content, onClose }: ConfirmDialogProps) {
    function onOK() {
        hideDialog(dialog);
        onClose(true);
    }
    function onCancel() {
        hideDialog(dialog);
        onClose(false);
    }
    const buttons = [
        <button data-i18n="confirm_ok" onClick={onOK} />,
        <button data-i18n="confirm_cancel" onClick={onCancel} />,
    ];
    const dialog = (
        <Dialog className="confirm_dialog" titleI18nKey={titleI18nKey}>
            <div data-i18n={contentI18nKey}>{content}</div>
            <div class="split_equal split_wrap">{buttons}</div>
        </Dialog>
    );
    return showDialog(dialog, buttons[0]);
}
