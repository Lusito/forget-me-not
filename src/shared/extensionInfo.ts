import { browser } from "webextension-polyfill-ts";
import { singleton } from "tsyringe";

@singleton()
export class ExtensionInfo {
    public readonly version = browser.runtime.getManifest().version;
}
