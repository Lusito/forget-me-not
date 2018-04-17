/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

export default class DelayedExecution {
    callback: () => void;
    private _execute: () => void;
    private instance: number | null = null;

    constructor(callback: () => void) {
        this.callback = callback;
        this._execute = this.execute.bind(this);
    }

    restart(ms: number) {
        this.cancel();
        this.instance = setTimeout(this._execute, ms);
    }

    execute() {
        this.cancel();
        this.callback();
    }

    cancel() {
        if (this.instance) {
            clearTimeout(this.instance);
            this.instance = null;
        }
    }
}
