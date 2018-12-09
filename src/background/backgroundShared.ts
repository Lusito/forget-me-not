/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { isFirefox, browserInfo, isNodeTest } from "../lib/browserInfo";

export const removeLocalStorageByHostname = isNodeTest || isFirefox && browserInfo.versionAsNumber >= 58;

export function someItemsMatch<T>(changedKeys: T[], acceptedKeys: T[]) {
    return acceptedKeys.some((s) => changedKeys.indexOf(s) !== -1);
}
