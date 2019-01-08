/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { browser } from "webextension-polyfill-ts";
import { FrameInfo } from "./frameInfo";

// Fixme: Unit Test for this entire file
const MIN_DEAD_FRAME_CHECK_INTERVAL = 1000;

function frameDead(tabId: number, frameId: number) {
    return browser.tabs.executeScript(tabId, { frameId, code: "1" }).then(() => null).catch(() => frameId);
}

export class TabInfo {
    public readonly tabId: number;
    public readonly cookieStoreId: string;
    private readonly frameInfos: { [s: string]: FrameInfo } = {};
    private readonly checkDomainLeave: (cookieStoreId: string, hostnames: Set<string>) => void;
    private lastDeadFrameCheck = 0;
    private scheduledDeadFrameCheck = 0;

    public constructor(tabId: number, hostname: string, cookieStoreId: string, checkDomainLeave: (cookieStoreId: string, hostnames: Set<string>) => void) {
        this.tabId = tabId;
        this.cookieStoreId = cookieStoreId;
        this.getFrameInfo(0).commitNavigation(hostname);
        this.checkDomainLeave = checkDomainLeave;
        this.checkDeadFrames = this.checkDeadFrames.bind(this);
    }

    private checkDeadFrames() {
        this.scheduledDeadFrameCheck = 0;
        this.lastDeadFrameCheck = Date.now();
        const allFramesIdle = this.allFramesIdle();
        Promise.all(Object.getOwnPropertyNames(this.frameInfos)
            .filter((key) => key !== "0" && this.frameInfos[key].isIdle())
            .map((key) => parseInt(key))
            .map((id) => (frameDead(this.tabId, id)))
        ).then((frameIds) => {
            if (frameIds.length) {
                const deadFrameHostnames = new Set<string>();
                const deadFrameIds = frameIds.filter((id) => id !== null) as number[];
                for (const frameId of deadFrameIds) {
                    const frameInfo = this.frameInfos[frameId];
                    if (frameInfo) {
                        delete this.frameInfos[frameId];
                        frameInfo.collectHostnames(deadFrameHostnames);
                    } else {
                        console.warn("frame info not found: " + frameId);
                    }
                }
                if (deadFrameHostnames.size)
                    this.checkDomainLeave(this.cookieStoreId, deadFrameHostnames);
            }
            if (!allFramesIdle)
                this.scheduleDeadFramesCheck();
        });
    }

    public scheduleDeadFramesCheck() {
        if (!this.scheduledDeadFrameCheck) {
            // Fixme: also call for the active tab every once in a while
            // fixme: browser.tabs.executeScript mock
            const delta = Date.now() - this.lastDeadFrameCheck;
            if (delta > MIN_DEAD_FRAME_CHECK_INTERVAL)
                this.checkDeadFrames();
            else
                this.scheduledDeadFrameCheck = setTimeout(this.checkDeadFrames, MIN_DEAD_FRAME_CHECK_INTERVAL - delta);
        }
    }

    public allFramesIdle() {
        for (const key in this.frameInfos) {
            if (!this.frameInfos[key].isIdle())
                return false;
        }
        return true;
    }

    private getFrameInfo(frameId: number) {
        let frameInfo = this.frameInfos[frameId];
        if (!frameInfo)
            frameInfo = this.frameInfos[frameId] = new FrameInfo();
        return frameInfo;
    }

    public prepareNavigation(frameId: number, hostname: string) {
        return this.getFrameInfo(frameId).prepareNavigation(hostname);
    }

    public commitNavigation(frameId: number, hostname: string) {
        const hostnames = new Set<string>();
        const frameInfo = this.getFrameInfo(frameId);
        if (frameId === 0) {
            for (const key in this.frameInfos) {
                this.frameInfos[key].collectHostnames(hostnames);
                delete this.frameInfos[key];
            }
            this.frameInfos[0] = frameInfo;
        } else {
            frameInfo.collectHostnames(hostnames);
        }
        frameInfo.commitNavigation(hostname);
        return hostnames;
    }

    public contains(hostname: string, checkNext: boolean) {
        for (const key in this.frameInfos) {
            if (this.frameInfos[key].matchHostname(hostname, checkNext))
                return true;
        }
        return false;
    }

    public matchHostnameFP(hostnameFP: string) {
        return this.getFrameInfo(0).matchHostnameFP(hostnameFP);
    }

    public containsHostnameFP(hostnameFP: string) {
        for (const key in this.frameInfos) {
            if (this.frameInfos[key].matchHostnameFP(hostnameFP))
                return true;
        }
        return false;
    }
}
