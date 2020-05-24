import { browser } from "webextension-polyfill-ts";
import { singleton } from "tsyringe";

import { CookieDomainInfo } from "./types";

type Callback = (...args: any[]) => any;

type CallbacksMap = { [s: string]: Callback[] };

export interface ReceiverHandle {
    destroy(): void;
}

export interface CleanUrlNowConfig {
    hostname: string;
    cookieStoreId: string;
}

interface EventMessage {
    action: string;
    params: any;
}

@singleton()
export class MessageUtil {
    private callbacksMap: CallbacksMap = {};

    public readonly settingsChanged = this.register<(changedKeys: string[]) => void>("settingsChanged");

    public readonly cleanAllNow = this.register<() => void>("cleanAllNow");

    public readonly cleanUrlNow = this.register<(config: CleanUrlNowConfig) => void>("cleanUrlNow");

    public readonly cookieRemoved = this.register<(domain: string) => void>("cookieRemoved");

    public readonly getRecentlyAccessedDomains = this.register<() => void>("getRecentlyAccessedDomains");

    public readonly toggleSnoozingState = this.register<() => void>("toggleSnoozingState");

    public readonly getSnoozingState = this.register<() => void>("getSnoozingState");

    public readonly onSnoozingState = this.register<(snoozing: boolean) => void>("onSnoozingState");

    public readonly importSettings = this.register<(json: any) => void>("importSettings");

    public readonly onRecentlyAccessedDomains = this.register<(domains: CookieDomainInfo[]) => void>(
        "onRecentlyAccessedDomains"
    );

    public constructor() {
        browser.runtime.onMessage.addListener((request: undefined | EventMessage) => {
            if (request) this.emitCallbacks(request.action, request.params);
        });
    }

    private register<T extends (...args: any[]) => void>(name: string) {
        return {
            receive: (callback: (...params: Parameters<T>) => any) => this.receive(name, callback),
            send: (...params: Parameters<T>) => this.send(name, params),
            sendSelf: (...params: Parameters<T>) => this.emitCallbacks(name, params),
        };
    }

    private getCallbacksList(name: string) {
        let callbacks = this.callbacksMap[name];
        if (!callbacks) {
            callbacks = [];
            this.callbacksMap[name] = callbacks;
        }
        return callbacks;
    }

    private async send(action: string, ...params: any[]) {
        try {
            const message: EventMessage = {
                action,
                params,
            };
            await browser.runtime.sendMessage(message);
        } catch (e) {
            // ignore
        }
    }

    private emitCallbacks(name: string, params: any[]) {
        const callbacks = this.callbacksMap[name];
        callbacks?.forEach((cb) => cb(...params));
    }

    private receive(name: string, callback: Callback): ReceiverHandle {
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
