/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { MouseEventCallback, createButton, translateChildren, on } from "../lib/htmlUtils";

export function createDialog(className: string, titleI18nKey: string, buttons: { [s: string]: MouseEventCallback }) {
    let overlay = document.createElement('div');
    overlay.className = 'dialogOverlay';
    let dialog = document.createElement('div');
    dialog.className = 'dialog ' + className;
    let titleNode = document.createElement('h2');
    titleNode.setAttribute('data-i18n', titleI18nKey);
    let contentNode = document.createElement('div');
    let buttonsNode = document.createElement('div');
    buttonsNode.className = 'dialogButtons';
    dialog.appendChild(titleNode);
    dialog.appendChild(contentNode);
    dialog.appendChild(buttonsNode);
    let buttonNodes: { [s: string]: HTMLButtonElement } = {};
    for (let key in buttons) {
        let button = createButton(key, buttons[key]);
        buttonNodes[key] = button;
        buttonsNode.appendChild(button);
    }
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    return {
        domNode: dialog,
        contentNode: contentNode,
        buttonNodes: buttonNodes,
        close: () => document.body.removeChild(overlay)
    };
}

export function alert(titleI18nKey: string, contentI18nKey: string, content?: string, callback?: () => void) {
    let dialog = createDialog('alert', titleI18nKey, {
        'alert_ok': () => {
            dialog.close();
            if (callback)
                callback();
        }
    });
    if (contentI18nKey)
        dialog.contentNode.setAttribute('data-i18n', contentI18nKey);
    if (content)
        dialog.contentNode.textContent = content;
    dialog.buttonNodes.alert_ok.focus();
    translateChildren(dialog.domNode);
}

export function confirm(titleI18nKey: string, contentI18nKey: string | null, content: string | null, callback: (value: boolean) => void) {
    let dialog = createDialog('confirm', titleI18nKey, {
        'confirm_ok': () => {
            dialog.close();
            callback(true);
        },
        'confirm_cancel': () => {
            dialog.close();
            callback(false);
        }
    });
    if (contentI18nKey)
        dialog.contentNode.setAttribute('data-i18n', contentI18nKey);
    if (content)
        dialog.contentNode.textContent = content;
    dialog.buttonNodes.confirm_ok.focus();
    translateChildren(dialog.domNode);
}

export function prompt(titleI18nKey: string, value: string, callback: (value: string | null) => void) {
    let input = document.createElement('input');
    input.value = value;
    let dialog = createDialog('prompt', titleI18nKey, {
        'prompt_ok': () => {
            dialog.close();
            callback(input.value);
        },
        'prompt_cancel': () => {
            dialog.close();
            callback(null);
        }
    });
    dialog.contentNode.appendChild(input);
    input.focus();
    input.addEventListener('keydown', (e) => { })
    on(input, 'keydown', (e) => {
        if (e.keyCode === 13) {
            dialog.close();
            callback(input.value);
        }
    });
    translateChildren(dialog.domNode);
}
