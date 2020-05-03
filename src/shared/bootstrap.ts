import { container } from "tsyringe";

import { Settings } from "./settings";
import { BrowserInfo, getBrowserInfo } from "./browserInfo";
import { getSupports, SupportsInfo } from "./supportsInfo";
import { RuleManager } from "./ruleManager";

export default async function () {
    const browserInfo = await getBrowserInfo();
    const supports = getSupports(browserInfo);

    container.registerInstance(BrowserInfo, browserInfo);
    container.registerInstance(SupportsInfo, supports);

    await container.resolve(RuleManager).init();
    await container.resolve(Settings).load();
}
