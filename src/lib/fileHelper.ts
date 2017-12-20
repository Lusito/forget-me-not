/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { createElement } from "./htmlUtils";

export function readJSONFile(file: File, callback: (json: any) => void) {
    var reader = new FileReader();
    reader.onload = () => {
        try {
            callback(JSON.parse(reader.result));
        }
        catch (e) {
            callback(null);
            console.error('Error reading json: ', e);
        }
    };
    reader.readAsText(file);
}

export function loadJSONFile(callback: (json: any) => void) {
    let input = createElement(document, document.body, 'input', { type: 'file', style: "display:none" });
    input.onchange = () => {
        if (!input.files)
            return;
        readJSONFile(input.files[0], callback);
    };
    input.click();
    document.body.removeChild(input);
}

export function saveJSONFile(json: any, filename: string) {
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json, null, 2));
    let a = createElement(document, document.body, 'a', { href: dataStr, download: filename, style: "display:none" });
    a.click();
    document.body.removeChild(a);
}
