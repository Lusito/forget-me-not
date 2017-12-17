/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { translateChildren } from './lib/htmlUtils';
import { TabSupport } from './lib/tabSupport';

class Readme {
    private tabSupport = new TabSupport();
    public constructor() {
        this.tabSupport; // shut up typescript
        translateChildren(document.body);
    }
}

new Readme();