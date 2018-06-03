/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { on, getChildrenWithTagName, getFirstChildWithClass } from "./htmlUtils";
import { Key } from "ts-keycode-enum";

const validHash = /^[a-z_]+$/;
export class TabSupport {
    private readonly tabList: HTMLElement;
    private readonly pages: HTMLElement[];
    private readonly tabs: HTMLElement[];
    private readonly listener: undefined | ((name: string) => void);
    public constructor(container: HTMLElement, listener?: (name: string) => void) {
        this.listener = listener;
        this.tabList = getFirstChildWithClass(container, "tabsList");
        this.tabs = getChildrenWithTagName(this.tabList, "div");
        this.pages = getChildrenWithTagName(getFirstChildWithClass(container, "tabsPages"), "div");
        for (let i = 0; i < this.tabs.length; i++)
            this.linkTab(i);

        this.setAriaAttributes();

        window.onhashchange = () => this.setTabFromHash();
        if (!this.setTabFromHash())
            this.tabs[0].focus();
    }

    private setAriaAttributes() {
        this.tabList.setAttribute("role", "tablist");
        for (let i = 0; i < this.tabs.length; i++) {
            const tab = this.tabs[i];
            const page = this.pages[i];
            const active = tab.classList.contains("active");
            tab.id = "tab_" + tab.getAttribute("data-tab");
            page.id = tab.id + "_panel";
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-selected", active.toString());
            tab.setAttribute("aria-controls", page.id);
            tab.setAttribute("tabindex", active ? "0" : "-1");
            page.setAttribute("role", "tabpanel");
            page.setAttribute("aria-labelledby", tab.id);
            page.setAttribute("tabindex", active ? "0" : "-1");
        }
    }

    private setTabFromHash() {
        return this.setTab(document.location.hash.substr(1));
    }

    public setTab(name: string) {
        if (validHash.test(name)) {
            const tab = document.querySelector("[data-tab=" + name + "]") as HTMLElement;
            if (tab && !tab.classList.contains("active")) {
                tab.click();
                return true;
            }
        }
        return false;
    }

    public getTab() {
        const tab = document.querySelector("[data-tab].active") as HTMLElement;
        return tab && tab.dataset.tab;
    }

    private updateSelectedTab(index: number) {
        for (let i = 0; i < this.tabs.length; i++) {
            if (i === index) {
                const name = (this.tabs[i]).dataset.tab;
                document.location.hash = "#" + name;
                this.tabs[i].classList.add("active");
                this.pages[i].classList.add("active");
                if (this.listener)
                    this.listener(name || "");
            } else {
                this.tabs[i].classList.remove("active");
                this.pages[i].classList.remove("active");
            }
        }
        this.tabs[index].focus();
        this.setAriaAttributes();
    }

    private linkTab(index: number) {
        const tab = this.tabs[index];
        on(tab, "click", () => this.updateSelectedTab(index));
        on(tab, "keyup", (e) => this.onKeyUp(e, index));
        on(tab, "keydown", (e) => this.onKeyDown(e, index));
    }

    private onKeyUp(e: KeyboardEvent, index: number) {
        switch (e.keyCode) {
            case Key.LeftArrow:
                if (index === 0)
                    this.updateSelectedTab(this.tabs.length - 1);
                else
                    this.updateSelectedTab(index - 1);
                break;
            case Key.RightArrow:
                if (index === this.tabs.length - 1)
                    this.updateSelectedTab(0);
                else
                    this.updateSelectedTab(index + 1);
                break;
        }
    }

    private onKeyDown(e: KeyboardEvent, index: number) {
        switch (e.keyCode) {
            case Key.End:
                e.preventDefault();
                this.updateSelectedTab(this.tabs.length - 1);
                break;
            case Key.Home:
                e.preventDefault();
                this.updateSelectedTab(0);
                break;
        }
    }
}
