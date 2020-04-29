import { WebRequest, Cookies, Tabs } from "webextension-polyfill-ts";

let nextTabId = 1000;

export function quickTab(url: string, cookieStoreId: string, incognito = false): Tabs.Tab {
    return {
        active: true,
        cookieStoreId,
        highlighted: false,
        id: nextTabId++,
        incognito,
        index: 1,
        isArticle: false,
        isInReaderMode: false,
        lastAccessed: Date.now(),
        pinned: false,
        url,
        windowId: 1,
    };
}

export function quickCookie(
    domain: string,
    name: string,
    path: string,
    storeId: string,
    firstPartyDomain: string,
    secure = false
): Cookies.Cookie {
    return {
        name,
        domain,
        path,
        storeId,
        firstPartyDomain,
        value: "",
        hostOnly: false,
        secure,
        httpOnly: false,
        session: false,
        sameSite: "no_restriction",
    };
}

export function quickHeadersReceivedDetails(
    url: string,
    tabId: number,
    responseHeaders?: WebRequest.HttpHeaders
): WebRequest.OnHeadersReceivedDetailsType {
    return {
        url,
        tabId,
        responseHeaders,
        requestId: "mock",
        method: "get",
        frameId: 0,
        parentFrameId: -1,
        type: "main_frame",
        thirdParty: false,
        timeStamp: Date.now(),
        statusLine: "HTTP/0.9 200 OK",
        statusCode: 200,
    };
}

export function quickBeforeRedirectDetails(
    url: string,
    redirectUrl: string,
    tabId: number,
    frameId = 0
): WebRequest.OnBeforeRedirectDetailsType {
    return {
        requestId: "request",
        url,
        method: "get",
        frameId,
        parentFrameId: -1,
        tabId,
        type: frameId === 0 ? "main_frame" : "sub_frame",
        thirdParty: false,
        timeStamp: -1,
        fromCache: false,
        statusCode: 200,
        redirectUrl,
        statusLine: "OK",
    };
}
