/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { h } from "tsx-dom";

export function readJSONFile(file: File, callback: (json: any) => void) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            callback(JSON.parse(reader.result as string));
        }
        catch (e) {
            callback(null);
            console.error("Error reading json: ", e);
        }
    };
    reader.readAsText(file);
}

export function loadJSONFile(callback: (json: any) => void) {
    const input = document.body.appendChild(<input type="file" style="display: none" />) as HTMLInputElement;
    input.onchange = () => {
        if (!input.files)
            return;
        readJSONFile(input.files[0], callback);
    };
    input.click();
    document.body.removeChild(input);
}

export function saveJSONFile(json: any, filename: string) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json, null, 2));
    const a = document.body.appendChild(<a href={dataStr} download={filename} style= "display:none" />);
    a.click();
    document.body.removeChild(a);
}
