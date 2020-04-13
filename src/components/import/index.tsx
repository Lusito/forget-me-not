/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";

import { settings } from "../../lib/settings";
import { on } from "../../lib/htmlUtils";
import { loadJSONFile, readJSONFile } from "../../lib/fileHelper";
import "./style.scss";

wetLayer.loadFromStorage();

settings.onReady(() => {
    const dropzone = <div id="dropzone" />;
    function onFileLoaded(json: any) {
        if (json && settings.setAll(json)) dropzone.textContent = wetLayer.getMessage("import_success_close_now");
        else
            dropzone.textContent = `${wetLayer.getMessage("import_failure")} ${wetLayer.getMessage(
                "import_by_drop_or_click"
            )}`;
    }
    on(dropzone, "dragover", (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        if (evt.dataTransfer) evt.dataTransfer.dropEffect = "copy";
    });
    on(dropzone, "drop", (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        const file = evt.dataTransfer && evt.dataTransfer.files[0];
        file && readJSONFile(file, onFileLoaded);
    });

    on(dropzone, "click", (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        loadJSONFile(onFileLoaded);
    });
    dropzone.textContent = wetLayer.getMessage("import_by_drop_or_click");
    document.title = wetLayer.getMessage("extensionName");
    document.body.appendChild(dropzone);
});
