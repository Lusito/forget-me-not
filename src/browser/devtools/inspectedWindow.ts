////////////////////
// Dev Tools - Inspected Window
////////////////////
/**
 * Use the browser.devtools.inspectedWindow API to interact with the inspected window: obtain the tab ID for the inspected page, evaluate the code in the context of the inspected window, reload the page, or obtain the list of resources within the page. */
export namespace DevtoolsInspectedWindow {
    export interface ReloadOptions {
        /** Optional. If specified, the string will override the value of the User-Agent HTTP header that's sent while loading the resources of the inspected page. The string will also override the value of the navigator.userAgent property that's returned to any scripts that are running within the inspected page.  */
        userAgent?: string;
        /** Optional. When true, the loader will ignore the cache for all inspected page resources loaded before the load event is fired. The effect is similar to pressing Ctrl+Shift+R in the inspected window or within the Developer Tools window.  */
        ignoreCache?: boolean;
        /** Optional. If specified, the script will be injected into every frame of the inspected page immediately upon load, before any of the frame's scripts. The script will not be injected after subsequent reloads—for example, if the user presses Ctrl+R.  */
        injectedScript?: string;
    }

    export interface EvaluationOptions {
        /** The URL of the frame in which to evaluate the expression. If this is omitted, the expression is evaluated in the main frame of the window. */
        frameURL?: string;
        /** If true, evaluate the expression in the context of any content scripts that this extension has attached to the page. If you set this option, then you must have actually attached some content scripts to the page, or a Devtools error will be thrown. */
        useContentScriptContext?: boolean;
        /** Evaluate the expression in the context of a content script attached by a different extension, whose origin matches the value given here. This overrides useContentScriptContext. */
        contextSecurityOrigin?: string;
    }

    export interface EvaluationExceptionInfo {
        /** Set if the error occurred on the DevTools side before the expression is evaluated. */
        isError: boolean;
        /** Set if the error occurred on the DevTools side before the expression is evaluated. */
        code: string;
        /** Set if the error occurred on the DevTools side before the expression is evaluated. */
        description: string;
        /** Set if the error occurred on the DevTools side before the expression is evaluated, contains the array of the values that may be substituted into the description string to provide more information about the cause of the error. */
        details: any[];
        /** Set if the evaluated code produces an unhandled exception. */
        isException: boolean;
        /** Set if the evaluated code produces an unhandled exception. */
        value: string;
    }

    export interface Static {
        /** The ID of the tab being inspected. This ID may be used with tabs.* API. */
        tabId: number;

        /** Reloads the inspected page. */
        reload(reloadOptions: ReloadOptions): void;
        /**
         * Evaluates a JavaScript expression in the context of the main frame of the inspected page. The expression must evaluate to a JSON-compliant object, otherwise an exception is thrown. The eval export function can report either a DevTools-side error or a JavaScript exception that occurs during evaluation. In either case, the result parameter of the callback is undefined. In the case of a DevTools-side error, the isException parameter is non-null and has isError set to true and code set to an error code. In the case of a JavaScript error, isException is set to true and value is set to the string value of thrown object.
         * @param expression An expression to evaluate.
         * Parameter result: The result of evaluation.
         * Parameter exceptionInfo: An object providing details if an exception occurred while evaluating the expression.
         */
        eval(expression: string, options: EvaluationOptions): Promise<[Object, EvaluationExceptionInfo]>;
    }
}