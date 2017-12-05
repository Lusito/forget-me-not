/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { on, translateChildren } from './lib/htmlUtils';
import { isFirefox } from './lib/browserInfo';

const validHash = /^[a-z]+$/;
class Readme {
    private pages: NodeListOf<HTMLElement>;
    private tabs: NodeListOf<HTMLElement>;
    public constructor() {
        browser;
        if (isFirefox)
            document.body.className += " firefox";

        this.tabs = document.querySelectorAll('#tabs > div');
        this.pages = document.querySelectorAll('#pages > div');
        for (let i = 0; i < this.tabs.length; i++)
            this.linkTab(i);

        translateChildren(document.body);

        window.onhashchange = () => this.setTabFromHash();
        this.setTabFromHash();
    }

    private setTabFromHash() {
        var hash = document.location.hash.substr(1);
        if (validHash.test(hash)) {
            const tab = document.querySelector('[data-tab=' + hash + ']') as HTMLElement;
            if (tab && tab.classList.contains('active'))
                tab.click();
        }
    }

    private updateSelectedTab(index: number) {
        for (let i = 0; i < this.tabs.length; i++) {
            if(i === index) {
                document.location.hash = '#' + this.tabs[i].dataset.tab;
                this.tabs[i].classList.add('active');
                this.pages[i].classList.add('active');
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

new Readme();