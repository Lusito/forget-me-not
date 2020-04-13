import { TabWatcher } from "./tabWatcher";
import { IncognitoWatcher } from "./incognitoWatcher";
import { ExtensionContext } from "../lib/bootstrap";
import { CookieUtils } from "./cookieUtils";

/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export function someItemsMatch<T>(changedKeys: T[], acceptedKeys: T[]) {
    return acceptedKeys.some((s) => changedKeys.includes(s));
}

export interface ExtensionBackgroundContext extends ExtensionContext {
    tabWatcher: TabWatcher;
    incognitoWatcher: IncognitoWatcher;
    cookieUtils: CookieUtils;
}
