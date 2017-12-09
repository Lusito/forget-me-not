/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import * as browser from 'webextension-polyfill';
import { settings } from "./lib/settings";
import { on, byId } from './lib/htmlUtils';
import { loadJSONFile, readJSONFile } from './lib/fileHelper';

settings.onReady(() => {
    const dropzone = byId('dropzone') as HTMLElement;
    function onFileLoaded(json: any) {
        if (json && settings.setAll(json))
            dropzone.textContent = browser.i18n.getMessage('import_success_close_now');
        else
            dropzone.textContent = browser.i18n.getMessage('import_failure') + ' ' + browser.i18n.getMessage('import_by_drop_or_click');
    }
    on(dropzone, 'dragover', (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
    });
    on(dropzone, 'drop', (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        if (evt.dataTransfer.files.length)
            readJSONFile(evt.dataTransfer.files[0], onFileLoaded);
    });

    on(dropzone, 'click', (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        loadJSONFile(onFileLoaded);
    });
    dropzone.textContent = browser.i18n.getMessage('import_by_drop_or_click');
});
