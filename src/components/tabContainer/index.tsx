import { Key } from "ts-keycode-enum";
import { h } from "tsx-dom";

import { handleClickOpenNewTab } from "../../frontend/htmlUtils";
import "./style.scss";

export const validHash = /^[a-z_/]+$/;

interface TabProps {
    children: HTMLElement;
    i18n: string;
    name: string;
    icon?: string;
    panelClass?: string;
}

export function Tab({ i18n, name, icon, panelClass, children }: TabProps) {
    return (
        <div
            data-i18n={i18n}
            data-name={name}
            data-icon={icon}
            class={panelClass}
            role="tabpanel"
            aria-labelledby={`tab_${name}`}
            id={`tab_${name}_panel`}
        >
            {children}
        </div>
    );
}

interface TabContainerProps {
    children: HTMLElement[];
    helpUrl?: string;
    defaultTab: string;
    onTabSelected?: (name: string) => void;
}

class TabContainerManager {
    public readonly container: HTMLElement;

    private tabsList: HTMLElement;

    private tabs: HTMLElement[];

    private panels: HTMLElement[];

    private initialized = false;

    private readonly onTabSelected?: (name: string) => void;

    public constructor(props: TabContainerProps) {
        this.panels = props.children || [];
        this.onTabSelected = props.onTabSelected;

        this.tabs = this.panels.map((panel, index) => {
            const className = panel.classList.contains("active") ? "active" : "";
            const { i18n, name, icon } = panel.dataset;
            const style = icon ? `background-image: url('${icon}');` : "";
            panel.removeAttribute("data-i18n");

            return (
                <div
                    data-tab={name}
                    data-i18n={i18n}
                    class={className}
                    style={style}
                    id={`tab_${name}`}
                    role="tab"
                    aria-controls={`tab_${name}_panel`}
                    onClick={() => this.updateSelectedTab(index)}
                    onKeyDown={(e) => this.onKeyDown(e)}
                    onKeyUp={(e) => this.onKeyUp(e, index)}
                />
            );
        });
        const extraClass = this.panels.find((child) => !!child.dataset.icon)
            ? "tabs_list_as_icons"
            : "tabs_list_as_text";

        this.tabsList = (
            <div class={`tabs_list ${extraClass}`}>
                {this.tabs}
                {/* fixme: aria */}
                {props.helpUrl ? (
                    <a
                        href={props.helpUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        id="help_button"
                        onClick={handleClickOpenNewTab}
                    >
                        ?
                    </a>
                ) : null}
            </div>
        );

        this.container = (
            <div class="tab_container">
                {this.tabsList}
                <div class="tabs_pages">{this.panels}</div>
            </div>
        );

        this.setAriaAttributes();

        if (!this.setTabFromHash()) this.setTab(props.defaultTab);

        window.addEventListener("hashchange", () => this.setTabFromHash());
        this.initialized = true;
    }

    private setAriaAttributes() {
        this.tabsList.setAttribute("role", "tablist");
        this.panels.forEach((panel, index) => {
            const tab = this.tabs[index];
            const active = tab.classList.contains("active");
            tab.setAttribute("aria-selected", active.toString());
            tab.setAttribute("tabindex", active ? "0" : "-1");
            panel.setAttribute("aria-labelledby", tab.id);
            panel.setAttribute("tabindex", active ? "0" : "-1");
        });
    }

    public updateSelectedTab(index: number) {
        this.panels.forEach((panel, i) => {
            const tab = this.tabs[i];
            const active = i === index;
            panel.classList.toggle("active", active);
            tab.classList.toggle("active", active);
            if (i === index) {
                const name = tab.dataset.tab ?? "";
                const { location } = document;
                if (this.initialized && location && !location.hash.startsWith(`#${name}/`)) location.hash = `#${name}`;
                tab.classList.add("active");
                panel.classList.add("active");
                if (this.onTabSelected) this.onTabSelected(name);
            }
        });
        this.tabs[index].focus();
        this.setAriaAttributes();
    }

    private setTab(name: string) {
        if (validHash.test(name)) {
            let tab = this.tabsList.querySelector(`[data-tab="${name}"]`) as HTMLElement;
            if (!tab) tab = this.tabsList.querySelector(`[data-tab="${name.split("/")[0]}"]`) as HTMLElement;

            if (tab && !tab.classList.contains("active")) {
                tab.click();
                return true;
            }
        }
        return false;
    }

    private setTabFromHash() {
        if (!document.location) return false;
        return this.setTab(document.location.hash.substr(1));
    }

    public onKeyUp(e: KeyboardEvent, index: number) {
        switch (e.keyCode) {
            case Key.LeftArrow:
                if (index === 0) this.updateSelectedTab(this.tabs.length - 1);
                else this.updateSelectedTab(index - 1);
                break;
            case Key.RightArrow:
                if (index === this.tabs.length - 1) this.updateSelectedTab(0);
                else this.updateSelectedTab(index + 1);
                break;
        }
    }

    public onKeyDown(e: KeyboardEvent) {
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

export function TabContainer(props: TabContainerProps) {
    const manager = new TabContainerManager(props);
    return manager.container;
}
