import { h } from "tsx-dom";
import { Dialog, hideDialog, showDialog } from "./dialog";

interface AlertDialogProps {
    titleI18nKey: string;
    contentI18nKey: string;
    content: string;
    onClose: () => void;
}

export function AlertDialog({ titleI18nKey, contentI18nKey, content, onClose }: AlertDialogProps) {
    function onOK() {
        onClose();
        hideDialog(dialog);
    }
    const okButton = <button data-i18n="alert_ok" onClick={onOK} />;
    const dialog = <Dialog className="alert_dialog" titleI18nKey={titleI18nKey}>
        <div data-i18n={contentI18nKey}>{content}</div>
        <div class="split_equal split_wrap">{okButton}</div>
    </Dialog>;
    return showDialog(dialog, okButton);
}
