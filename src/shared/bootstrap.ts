import { container } from "tsyringe";

import { Settings } from "./settings";
import { BrowserInfo, getBrowserInfo } from "./browserInfo";
import { getSupports, SupportsInfo } from "./supportsInfo";

export default async function () {
    const browserInfo = await getBrowserInfo();
    const supports = getSupports(browserInfo);

    container.registerInstance(BrowserInfo, browserInfo);
    container.registerInstance(SupportsInfo, supports);

    const settings = container.resolve(Settings);
    container.registerInstance(Settings, settings);
    await settings.load();
}
