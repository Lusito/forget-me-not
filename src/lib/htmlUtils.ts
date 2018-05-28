/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as MarkdownIt from "markdown-it";
import { browser } from "webextension-polyfill-ts";

const md = new MarkdownIt();
const domParser = new DOMParser();

export function getFirstChildWithClass(element: HTMLElement, className: string) {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < element.children.length; i++) {
        if (element.children[i].classList.contains(className))
            return element.children[i] as HTMLElement;
    }
    throw new Error("Could not find child with class " + className);
}

export function getChildrenWithTagName(element: HTMLElement, tagName: string) {
    const list = [];
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < element.children.length; i++) {
        if (element.children[i].tagName.toLowerCase() === tagName)
            list.push(element.children[i] as HTMLElement);
    }
    return list;
}

export function makeLinkOpenAsTab(a: HTMLAnchorElement) {
    on(a, "click", (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        browser.tabs.create({
            active: true,
            url: a.href
        });
        window.close();
    });
}

function setMarkdown(element: HTMLElement, value: string) {
    const doc = domParser.parseFromString(md.render(value), "text/html");
    removeAllChildren(element);
    for (const child of doc.body.childNodes)
        element.appendChild(child);
    const links = element.querySelectorAll("a");
    for (const link of links)
        makeLinkOpenAsTab(link);
}

export function byId(id: string) {
    return document.getElementById(id);
}

export function on<K extends keyof HTMLElementEventMap>(node: Node, event: K, callback: (this: HTMLInputElement, ev: HTMLElementEventMap[K]) => any) {
    node.addEventListener(event, callback);
}

export function translateElement(element: HTMLElement) {
    const i18n = element.dataset.i18n;
    if (i18n) {
        let parts = i18n.split("?");
        const id = parts[0];
        parts.splice(0, 1);
        // default to text
        if (parts.length === 0)
            parts = ["text"];
        for (const attribute of parts) {
            if (attribute === "text")
                element.textContent = browser.i18n.getMessage(id);
            else if (attribute === "markdown")
                setMarkdown(element, browser.i18n.getMessage(id));
            else
                (element as any)[attribute] = browser.i18n.getMessage(id + "@" + attribute);
        }
    }
}

export function translateChildren(parent: NodeSelector) {
    const elements = parent.querySelectorAll("[data-i18n]");
    for (const element of elements)
        translateElement(element as HTMLElement);
}

function setHighlightElement(element: HTMLElement | null) {
    const highlighter = document.querySelector("#highlight_rect") as HTMLElement;
    if (element) {
        highlighter.style.display = "block";
        const rect = element.getBoundingClientRect();
        const padding = 5;
        highlighter.style.left = (rect.left - padding) + "px";
        highlighter.style.width = (rect.width + 2 * padding) + "px";
        highlighter.style.top = (rect.top - padding) + "px";
        highlighter.style.height = (rect.height + 2 * padding) + "px";
    } else {
        highlighter.style.display = "";
    }
}

export function connectHighlighter(element: HTMLElement) {
    const selector = element.getAttribute("data-highlight");
    const highlight = selector && document.querySelector(selector);
    if (highlight) {
        on(element, "mouseover", () => setHighlightElement(highlight as HTMLElement));
        on(element, "mouseout", () => setHighlightElement(null));
    }
}

export function connectHighlighters() {
    const elements = document.querySelectorAll("[data-highlight]");
    for (const element of elements)
        connectHighlighter(element as HTMLElement);
}

export function removeAllChildren(node: HTMLElement) {
    if (node.hasChildNodes()) {
        while (node.firstChild)
            node.removeChild(node.firstChild);
    }
}

type ElementAttributes = { [s: string]: string | number | boolean };

export function createElement<K extends keyof HTMLElementTagNameMap>(doc: Document, parent: HTMLElement | null, tagName: K, params?: ElementAttributes): HTMLElementTagNameMap[K] {
    const e = doc.createElement(tagName);
    if (params) {
        for (const key in params) {
            (e as any)[key] = params[key];
        }
    }
    if (parent)
        parent.appendChild(e);
    return e;
}

export function addLink(doc: Document, path: string) {
    const head = doc.querySelector("head");
    if (head) {
        createElement(doc, head, "link", {
            href: browser.runtime.getURL(path),
            type: "text/css",
            rel: "stylesheet"
        });
    }
}

export type MouseEventCallback = (this: HTMLInputElement, ev: MouseEvent) => any;

export function createButton(labelI18nKey: string, callback: MouseEventCallback) {
    const button = document.createElement("button");
    button.setAttribute("data-i18n", labelI18nKey);
    on(button, "click", callback);
    return button;
}
