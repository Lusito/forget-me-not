/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { translateChildren, byId } from "./lib/htmlUtils";
import { TabSupport } from "./lib/tabSupport";

class Readme {
    private tabSupport = new TabSupport(byId('mainTabContainer') as HTMLElement);
    public constructor() {
        this.tabSupport; // shut up typescript
        translateChildren(document.body);
    }
}

new Readme();
