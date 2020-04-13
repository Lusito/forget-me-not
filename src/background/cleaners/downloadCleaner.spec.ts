/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// FIXME:
describe("DownloadCleaner", () => {
    // browser.downloads.onCreated:
    // - create download
    // - if instantly enabled and instantly downloads enabled and domain for url (otherwise nothing)
    // - if apply rules or domain is blocked
    //     erase download and, if history api exists, delete history url
    // - else if startup enabled and startup downloads and domain is not protected
    //     add to downloadsToClean storage

    // cleanup:
    // - if downloads and (apply rules or not history)
    //     remove downloads flag
    //     search downloads and get urls to clean
    //       if not protected
    //         erase download and, if history api exists, delete history url
    //       else
    //         re-add to downloadsToClean
});
