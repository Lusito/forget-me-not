export function someItemsMatch<T>(changedKeys: T[], acceptedKeys: T[]) {
    return acceptedKeys.some((s) => changedKeys.includes(s));
}
