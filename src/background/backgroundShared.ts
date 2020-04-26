/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export function someItemsMatch<T>(changedKeys: T[], acceptedKeys: T[]) {
    return acceptedKeys.some((s) => changedKeys.includes(s));
}
