/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { translateChildren, byId } from "./lib/htmlUtils";
import { TabSupport } from "./lib/tabSupport";
import { wetLayer } from "wet-layer";

class Readme {
    private tabSupport = new TabSupport(byId("mainTabContainer") as HTMLElement);
    public constructor() {
        this.tabSupport; // shut up typescript
        wetLayer.addListener(() => translateChildren(document));
        wetLayer.loadFromStorage();
        translateChildren(document);
    }
}

new Readme();
