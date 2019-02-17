import { h } from "tsx-dom";
import { Dialog, showDialog, hideDialog } from "./dialog";
import { Key } from "ts-keycode-enum";

interface PromptDialogProps {
    titleI18nKey: string;
    value: string;
    onClose: (value: string | null) => void;
}

export function PromptDialog({ titleI18nKey, value, onClose }: PromptDialogProps) {
    const input = <input value={value} onKeyDown={(e) => e.keyCode === Key.Enter && onOK()} /> as HTMLButtonElement;
    function onOK() {
        hideDialog(dialog);
        onClose(input.value);
    }
    function onCancel() {
        hideDialog(dialog);
        onClose(null);
    }
    const buttons = [
        <button data-i18n="prompt_ok" onClick={onOK} />,
        <button data-i18n="prompt_cancel" onClick={onCancel} />
    ];
    const dialog = <Dialog className="prompt_dialog" titleI18nKey={titleI18nKey}>
        <div>{input}</div>
        <div class="split_equal split_wrap">{buttons}</div>
    </Dialog>;
    return showDialog(dialog, input);
}
