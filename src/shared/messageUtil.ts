/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser, Runtime } from "webextension-polyfill-ts";
import { singleton } from "tsyringe";

// This file contains communication helpers

// fixme: types
export type Callback = (params: any, sender: Runtime.MessageSender) => any;
// export type Callback = (params: any, sender?: browser.runtime.MessageSender) => any;

type CallbacksMap = { [s: string]: Callback[] };

export interface ReceiverHandle {
    destroy(): void;
}

// fixme: rather implement specific methods in order to have type safety?
@singleton()
export class MessageUtil {
    private callbacksMap: CallbacksMap = {};

    public constructor() {
        browser.runtime.onMessage.addListener((request, sender) => {
            this.emitCallbacks(request.action, request.params, sender);
        });
    }

    private getCallbacksList(name: string) {
        let callbacks = this.callbacksMap[name];
        if (!callbacks) {
            callbacks = [];
            this.callbacksMap[name] = callbacks;
        }
        return callbacks;
    }

    public async send(name: string, params?: any) {
        const data = {
            action: name,
            params,
        };
        try {
            await browser.runtime.sendMessage(data);
        } catch (e) {
            // ignore
        }
    }

    private emitCallbacks(name: string, params: any, sender: any) {
        const callbacks = this.callbacksMap[name];
        callbacks?.forEach((cb) => cb(params, sender));
    }

    public sendSelf(name: string, params?: any) {
        this.emitCallbacks(name, params, {});
    }

    public receive(name: string, callback: Callback): ReceiverHandle {
        const callbacks = this.getCallbacksList(name);
        callbacks.push(callback);
        return {
            destroy() {
                const index = callbacks.indexOf(callback);
                if (index !== -1) callbacks.splice(index, 1);
            },
        };
    }
}
