/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// Detect browser information

export interface BrowserInfo {
    name: string;
    version: string;
    versionAsNumber: number;
    mobile: boolean;
}

export const isNodeTest = typeof window === 'undefined';

export const browserInfo = function (): BrowserInfo {
    // if not in a browser, assume we're in a test
    if (isNodeTest)
        return { name: 'NodeTest', version: '1.0.0', versionAsNumber: 1, mobile: false };

    const ua = navigator.userAgent;
    const mobile = /android|iphone|ipad|ipod/i.test(ua);
    let tem, M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        const version = (tem[1] || '');
        return { name: 'IE', version: version, versionAsNumber: parseFloat(version), mobile };
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\bOPR|Edge\/(\d+)/)
        if (tem != null) { return { name: 'Opera', version: tem[1], versionAsNumber: parseFloat(tem[1]), mobile }; }
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = ua.match(/version\/(\d+)/i)) != null) { M.splice(1, 1, tem[1]); }
    return {
        name: M[0],
        version: M[1],
        versionAsNumber: parseFloat(M[1]),
        mobile
    };
}();

export const isFirefox = browserInfo.name.toLocaleLowerCase() === 'firefox';
