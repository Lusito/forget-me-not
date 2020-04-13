/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser } from "webextension-polyfill-ts";

const vcsHost = "github";
const vcsUser = "lusito";
const vcsRepository = "forget-me-not";

window.addEventListener("message", (event) => {
    if (
        event.source === window &&
        event.data &&
        event.data.action === "WetApplyLanguage" &&
        vcsHost === event.data.vcsHost.toLowerCase() &&
        vcsUser === event.data.vcsUser.toLowerCase() &&
        vcsRepository === event.data.vcsRepository.toLowerCase()
    ) {
        browser.runtime.sendMessage({ action: "WetApplyLanguage", language: event.data.language });
    }
});
window.postMessage({ action: "EnableWebExtensionMode" }, "*");
