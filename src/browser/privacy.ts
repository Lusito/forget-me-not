import { Types } from "./types";

////////////////////
// Privacy
////////////////////
/**
 * Use the browser.privacy API to control usage of the features in Chrome that can affect a user's privacy. This API relies on the BrowserSetting prototype of the type API for getting and setting Chrome's configuration.
 * Permissions:  "privacy"
 * The Chrome Privacy Whitepaper gives background detail regarding the features which this API can control.
 */
export namespace Privacy {
    export interface Services {
        passwordSavingEnabled: Types.BrowserSetting;
    }

    export interface Network {
        networkPredictionEnabled: Types.BrowserSetting;
        peerConnectionEnabled: Types.BrowserSetting;
        webRTCIPHandlingPolicy: Types.BrowserSetting;
    }

    export interface Websites {
        firstPartyIsolate: Types.BrowserSetting;
        thirdPartyCookiesAllowed: Types.BrowserSetting;
        referrersEnabled: Types.BrowserSetting;
        hyperlinkAuditingEnabled: Types.BrowserSetting;
        protectedContentEnabled: Types.BrowserSetting;
        resistFingerprinting: Types.BrowserSetting;
        trackingProtectionMode: Types.BrowserSetting;
    }

    export interface Static {
        /** Settings that enable or disable features that require third-party network services provided by Google and your default search provider. */
        services: Services;
        /** Settings that influence Chrome's handling of network connections in general. */
        network: Network;
        /** Settings that determine what information Chrome makes available to websites. */
        websites: Websites;
    }
}