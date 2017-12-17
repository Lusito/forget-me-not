/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { on } from './htmlUtils';

const validHash = /^[a-z_]+$/;
export class TabSupport {
    private readonly pages: NodeListOf<HTMLElement>;
    private readonly tabs: NodeListOf<HTMLElement>;
    private readonly listener: undefined | ((name: string) => void);
    public constructor(listener?: (name: string) => void) {
        this.listener = listener;
        this.tabs = document.querySelectorAll('#tabs > div');
        this.pages = document.querySelectorAll('#pages > div');
        for (let i = 0; i < this.tabs.length; i++)
            this.linkTab(i);

        window.onhashchange = () => this.setTabFromHash();
        this.setTabFromHash();
    }

    private setTabFromHash() {
        this.setTab(document.location.hash.substr(1));
    }

    public setTab(name: string) {
        if (validHash.test(name)) {
            const tab = document.querySelector('[data-tab=' + name + ']') as HTMLElement;
            if (tab && !tab.classList.contains('active'))
                tab.click();
        }
    }

    public getTab() {
        const tab = document.querySelector('[data-tab].active') as HTMLElement;
        return tab && tab.dataset.tab;
    }

    private updateSelectedTab(index: number) {
        for (let i = 0; i < this.tabs.length; i++) {
            if (i === index) {
                const name = this.tabs[i].dataset.tab
                document.location.hash = '#' + name;
                this.tabs[i].classList.add('active');
                this.pages[i].classList.add('active');
                if (this.listener)
                    this.listener(name || '');
            } else {
                this.tabs[i].classList.remove('active');
                this.pages[i].classList.remove('active');
            }
        }
    }

    private linkTab(index: number) {
        on(this.tabs[index], 'click', () => this.updateSelectedTab(index));
    }
}
