/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */
import { getDomain } from "tldjs";

const FRAME_IDLE_TIME = 1000;

export class FrameInfo {
    private lastTimeStamp = 0;
    private hostname = "";
    private hostnameFP = "";
    private nextHostname = "";
    private nextHostnameFP = "";
    private navigating = false;

    public collectHostnames(collector: Set<string>) {
        this.hostname && collector.add(this.hostname);
        this.navigating && this.nextHostname && collector.add(this.nextHostname);
    }

    public matchHostname(hostname: string, checkNext: boolean) {
        return hostname === this.hostname || checkNext && this.navigating && hostname === this.nextHostname;
    }

    public matchHostnameFP(hostnameFP: string) {
        return hostnameFP === this.hostnameFP || (this.navigating && hostnameFP === this.nextHostnameFP);
    }

    public prepareNavigation(hostname: string) {
        this.lastTimeStamp = Date.now();
        if (this.navigating && this.nextHostname === hostname)
            return "";
        const lastHostname = this.nextHostname;
        this.navigating = true;
        this.nextHostname = hostname;
        this.nextHostnameFP = (hostname && getDomain(hostname)) || hostname;
        return lastHostname;
    }

    public commitNavigation(hostname: string) {
        if (this.hostname !== hostname) {
            this.hostname = hostname;
            this.hostnameFP = getDomain(hostname) || hostname;
        }
        this.nextHostname = this.nextHostnameFP = "";
        this.navigating = false;
        this.lastTimeStamp = Date.now();
    }

    public isIdle() {
        return !this.navigating && (Date.now() - this.lastTimeStamp) >= FRAME_IDLE_TIME;
    }

    public isNavigating() {
        return this.navigating;
    }
}
