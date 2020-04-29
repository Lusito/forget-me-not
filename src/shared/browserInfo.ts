import { browser } from "webextension-polyfill-ts";

export enum BrowserType {
    FIREFOX,
    FENNEC,
    OPERA,
    NODE,
    IE,
    UNKNOWN,
}

function detectBrowserType(name: string) {
    const lowerBrowserName = name.toLowerCase();
    if (lowerBrowserName === "firefox") return BrowserType.FIREFOX;
    if (lowerBrowserName === "fennec") return BrowserType.FENNEC;
    return BrowserType.UNKNOWN;
}

export class BrowserInfo {
    constructor(
        public readonly name: string,
        public readonly version: string,
        public readonly versionAsNumber: number,
        public readonly type: BrowserType
    ) {}

    public isFirefox() {
        return this.type === BrowserType.FIREFOX || this.type === BrowserType.FENNEC;
    }

    public isMobile() {
        return this.type === BrowserType.FENNEC;
    }
}

export const isNodeTest = process.env.JEST_WORKER_ID !== undefined;

export async function getBrowserInfo() {
    // if not in a browser, assume we're in a test
    if (isNodeTest) return new BrowserInfo("NodeTest", "1.0.0", 1, BrowserType.NODE);

    if (browser.runtime.getBrowserInfo) {
        const browserInfo = await browser.runtime.getBrowserInfo();
        return new BrowserInfo(
            browserInfo.name,
            browserInfo.version,
            parseFloat(browserInfo.version),
            detectBrowserType(browserInfo.name)
        );
    }

    // Fallback to detecting old fashion style
    const ua = navigator.userAgent;
    let M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) ?? [];
    let tem;
    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) ?? [];
        const version = tem[1] || "";
        return new BrowserInfo("IE", version, parseFloat(version), BrowserType.IE);
    }
    if (M[1] === "Chrome") {
        tem = ua.match(/\bOPR|Edge\/(\d+)/);
        if (tem !== null) return new BrowserInfo("Opera", tem[1], parseFloat(tem[1]), BrowserType.OPERA);
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, "-?"];
    tem = ua.match(/version\/(\d+)/i);
    if (tem !== null) M.splice(1, 1, tem[1]);

    return new BrowserInfo(M[0], M[1], parseFloat(M[1]), detectBrowserType(M[0]));
}
