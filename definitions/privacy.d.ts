/// <reference path="types.d.ts"/>

declare module 'webextension-polyfill' {
    ////////////////////
    // Privacy
    ////////////////////
    /**
     * Use the browser.privacy API to control usage of the features in Chrome that can affect a user's privacy. This API relies on the BrowserSetting prototype of the type API for getting and setting Chrome's configuration.
     * Permissions:  "privacy"
     * The Chrome Privacy Whitepaper gives background detail regarding the features which this API can control.
     */
    export namespace privacy {
        export interface Services {
            passwordSavingEnabled: types.BrowserSetting;
        }

        export interface Network {
            networkPredictionEnabled: types.BrowserSetting;
            peerConnectionEnabled: types.BrowserSetting;
            webRTCIPHandlingPolicy: types.BrowserSetting;
        }

        export interface Websites {
            firstPartyIsolate: types.BrowserSetting;
            thirdPartyCookiesAllowed: types.BrowserSetting;
            referrersEnabled: types.BrowserSetting;
            hyperlinkAuditingEnabled: types.BrowserSetting;
            protectedContentEnabled: types.BrowserSetting;
            resistFingerprinting: types.BrowserSetting;
            trackingProtectionMode: types.BrowserSetting;
        }

        /** Settings that enable or disable features that require third-party network services provided by Google and your default search provider. */
        export var services: Services;
        /** Settings that influence Chrome's handling of network connections in general. */
        export var network: Network;
        /** Settings that determine what information Chrome makes available to websites. */
        export var websites: Websites;
    }
}