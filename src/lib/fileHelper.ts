import { createElement } from "./htmlUtils";

export function loadJSONFile(callback: (json: any) => void) {
    let input = createElement(document, document.body, 'input', { type: 'file', style: "display:none" }) as HTMLInputElement;
    input.onchange = () => {
        if (!input.files)
            return;
        var reader = new FileReader();
        reader.onload = () => {
            callback(reader.result);
            try {
                callback(JSON.parse(reader.result));
            } catch (e) {
                callback(null);
                console.error('Error reading json: ', e);
            }
        };
        reader.readAsText(input.files[0]);
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
