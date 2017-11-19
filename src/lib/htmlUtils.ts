/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';

export function byId(id: string) {
    return document.getElementById(id);
}

export function on<K extends keyof HTMLElementEventMap>(node: Node, event: K, callback: (this: HTMLInputElement, ev: HTMLElementEventMap[K]) => any) {
    node.addEventListener(event, callback);
}

export function translateElement(element: HTMLElement) {
    let id = element.dataset.l10nId;
    if (id) {
        let content = browser.i18n.getMessage(id);
        if (content)
            element.textContent = content;
        let title = browser.i18n.getMessage(id + "__title");
        if (title)
            element.title = title;
        let placeholder = browser.i18n.getMessage(id + "__placeholder");
        if (placeholder)
            (element as HTMLInputElement).placeholder = placeholder;
    }
}

export function translateChildren(parent: NodeSelector) {
    let elements = parent.querySelectorAll('[data-l10n-id]');
    for (let i = 0; i < elements.length; i++)
        translateElement(elements[i] as HTMLElement);
}

export function removeAllChildren(node: HTMLElement) {
    if (node.hasChildNodes()) {
        while (node.firstChild)
            node.removeChild(node.firstChild);
    }
}

type ElementAttributes = { [s: string]: string | number | boolean };

export function createElement(doc: Document, parent: HTMLElement | null, tagName: string, params?: ElementAttributes) {
    let e = doc.createElement(tagName);
    if (params) {
        for (let key in params) {
            (e as any)[key] = params[key];
        }
    }
    if (parent)
        parent.appendChild(e);
    return e;
}

export function addLink(doc: Document, path: string) {
    let head = doc.querySelector('head');
    if (head) {
        createElement(doc, head, 'link', {
            href: browser.runtime.getURL(path),
            type: "text/css",
            rel: "stylesheet"
        });
    }
}

export type MouseEventCallback = (this: HTMLInputElement, ev: MouseEvent) => any;

export function createButton(labelL10nKey: string, callback: MouseEventCallback) {
    let button = document.createElement('button');
    button.setAttribute('data-l10n-id', labelL10nKey);
    on(button, 'click', callback);
    return button;
}
