import { browser } from "webextension-polyfill-ts";

export const manifestVersion = browser.runtime.getManifest().version;

const versionNumber = (major: number, minor = 0, patch = 0) => major * 1000000 + minor * 1000 + patch;
const versionNumberFromString = (version: string) => {
    const [major, minor, patch] = version.split(".").map((i) => parseInt(i));
    if (isNaN(major))
        return versionNumber(1);
    return versionNumber(major, minor, patch);
};

interface Migration {
    version: number;
    migrate(map: { [s: string]: any }): void;
}

const migrations: Migration[] = [
    {
        version: versionNumber(2),
        migrate(map) {
            if (map.hasOwnProperty("domainLeave.delay"))
                map["domainLeave.delay"] = Math.round((map["domainLeave.delay"] as number) * 60);
            if (map.hasOwnProperty("cleanThirdPartyCookies.delay"))
                map["cleanThirdPartyCookies.delay"] = Math.round((map["cleanThirdPartyCookies.delay"] as number) * 60);
        }
    }
];

export default function migrateSettings(previousVersion: string, map: { [s: string]: any }) {
    const previousVersionNumber = versionNumberFromString(previousVersion);
    for (const migration of migrations) {
        if (previousVersionNumber < migration.version)
            migration.migrate(map);
    }
}
