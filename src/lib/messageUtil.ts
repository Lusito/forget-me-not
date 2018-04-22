/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Runtime } from "webextension-polyfill-ts";

// This file contains communication helpers

//fixme: types
export type Callback = (params: any, sender: Runtime.MessageSender) => any;
// export type Callback = (params: any, sender?: browser.runtime.MessageSender, sendResponse?: (response:any)=>void) => any;

type CallbacksMap = { [s: string]: Callback[] };

let callbacksMap: CallbacksMap | null = null;

export function send(name: string, params?: any, callback?: (value: any) => any) {
    let data = {
        action: name,
        params: params
    };
    let promise = browser.runtime.sendMessage(data);
    if (callback)
        promise.then(callback);
}

export function sendSelf(name: string, params: any) {
    if (callbacksMap) {
        const callbacks = callbacksMap[name];
        callbacks && callbacks.forEach((cb) => cb(params, {}));
    }
}

export function receive(name: string, callback: Callback) {
    if (callbacksMap === null) {
        callbacksMap = {};
        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (callbacksMap) {
                const callbacks = callbacksMap[request.action];
                callbacks && callbacks.forEach((cb) => cb(request.params, sender));
            }
        });
    }
    const callbacks = callbacksMap[name];
    if (callbacks)
        callbacks.push(callback);
    else
        callbacksMap[name] = [callback];
}
