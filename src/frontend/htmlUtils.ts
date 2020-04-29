import MarkdownIt from "markdown-it";
import { browser } from "webextension-polyfill-ts";
import { wetLayer } from "wet-layer";

const md = new MarkdownIt();
const domParser = new DOMParser();

function setMarkdown(element: HTMLElement, value: string) {
    const doc = domParser.parseFromString(md.render(value), "text/html");
    removeAllChildren(element);
    for (const child of doc.body.childNodes) element.appendChild(child);
    const links = element.querySelectorAll("a");
    for (const link of links) {
        link.target = "_blank";
        link.addEventListener("click", handleClickOpenNewTab);
    }
}

export function byId(id: string) {
    return document.getElementById(id);
}

export function on<T extends keyof HTMLElementEventMap>(
    node: Node,
    event: T,
    callback: (this: HTMLInputElement, ev: HTMLElementEventMap[T]) => any
) {
    node.addEventListener(event, callback as EventListener);
}

export function translateElement(element: HTMLElement) {
    const { i18n } = element.dataset;
    if (i18n) {
        let parts = i18n.split("?");
        const id = parts[0];
        parts.splice(0, 1);
        // default to text
        if (parts.length === 0) parts = ["text"];
        for (const attribute of parts) {
            if (attribute === "text") element.textContent = wetLayer.getMessage(id);
            else if (attribute === "markdown") setMarkdown(element, wetLayer.getMessage(id));
            else (element as any)[attribute] = wetLayer.getMessage(`${id}@${attribute}`);
        }
    }
}

export function translateChildren(parent: HTMLElement) {
    const elements = parent.querySelectorAll("[data-i18n]");
    for (const element of elements) translateElement(element as HTMLElement);
}

export function translateDocument() {
    document.head && translateChildren(document.head);
    document.body && translateChildren(document.body);
}

export function removeAllChildren(node: HTMLElement) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

export function handleClickOpenNewTab(e: MouseEvent) {
    e.stopImmediatePropagation();
    e.preventDefault();
    browser.tabs.create({
        active: true,
        url: (e.currentTarget as HTMLAnchorElement).href,
    });
    window.close();
}
