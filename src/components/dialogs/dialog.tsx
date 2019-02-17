import { h, BaseProps } from "tsx-dom";
import { translateChildren } from "../../lib/htmlUtils";
import "./style.scss";
import { Logo } from "../logo";

interface DialogProps extends BaseProps {
    className: string;
    titleI18nKey: string;
}

export function Dialog({ className, titleI18nKey, children }: DialogProps) {
    return <div class={"dialog " + className}>
        <h2>
            <span data-i18n={titleI18nKey} />
            <Logo />
        </h2>
        {children}
    </div>;
}

export function showDialog(dialog: HTMLElement, focus: HTMLElement) {
    translateChildren(dialog);
    document.body.insertBefore(dialog, document.body.firstChild);
    focus.focus();
    return dialog;
}

export function hideDialog(dialog: HTMLElement) {
    document.body.removeChild(dialog);
}
