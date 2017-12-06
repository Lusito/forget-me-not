// todo: check mdn compatibility
declare module 'webextension-polyfill' {
    ////////////////////
    // Events
    ////////////////////
    /**
     * The events namespace contains common types used by APIs dispatching events to notify you when something interesting happens. */
    export namespace events {
        /** Filters URLs for export various criteria. See event filtering. All criteria are case sensitive. */
        export interface UrlFilter {
            /** Optional. Matches if the scheme of the URL is equal to any of the schemes specified in the array.  */
            schemes?: string[];
            /**
             * Optional.
            * Matches if the URL (without fragment identifier) matches a specified regular expression. Port numbers are stripped from the URL if they match the default port number. The regular expressions use the RE2 syntax.
            */
            urlMatches?: string;
            /** Optional. Matches if the path segment of the URL contains a specified string.  */
            pathContains?: string;
            /** Optional. Matches if the host name of the URL ends with a specified string.  */
            hostSuffix?: string;
            /** Optional. Matches if the host name of the URL starts with a specified string.  */
            hostPrefix?: string;
            /** Optional. Matches if the host name of the URL contains a specified string. To test whether a host name component has a prefix 'foo', use hostContains: '.foo'. This matches 'www.foobar.com' and 'foo.com', because an implicit dot is added at the beginning of the host name. Similarly, hostContains can be used to match against component suffix ('foo.') and to exactly match against components ('.foo.'). Suffix- and exact-matching for the last components need to be done separately using hostSuffix, because no implicit dot is added at the end of the host name.  */
            hostContains?: string;
            /** Optional. Matches if the URL (without fragment identifier) contains a specified string. Port numbers are stripped from the URL if they match the default port number.  */
            urlContains?: string;
            /** Optional. Matches if the query segment of the URL ends with a specified string.  */
            querySuffix?: string;
            /** Optional. Matches if the URL (without fragment identifier) starts with a specified string. Port numbers are stripped from the URL if they match the default port number.  */
            urlPrefix?: string;
            /** Optional. Matches if the host name of the URL is equal to a specified string.  */
            hostEquals?: string;
            /** Optional. Matches if the URL (without fragment identifier) is equal to a specified string. Port numbers are stripped from the URL if they match the default port number.  */
            urlEquals?: string;
            /** Optional. Matches if the query segment of the URL contains a specified string.  */
            queryContains?: string;
            /** Optional. Matches if the path segment of the URL starts with a specified string.  */
            pathPrefix?: string;
            /** Optional. Matches if the path segment of the URL is equal to a specified string.  */
            pathEquals?: string;
            /** Optional. Matches if the path segment of the URL ends with a specified string.  */
            pathSuffix?: string;
            /** Optional. Matches if the query segment of the URL is equal to a specified string.  */
            queryEquals?: string;
            /** Optional. Matches if the query segment of the URL starts with a specified string.  */
            queryPrefix?: string;
            /** Optional. Matches if the URL (without fragment identifier) ends with a specified string. Port numbers are stripped from the URL if they match the default port number.  */
            urlSuffix?: string;
            /** Optional. Matches if the port of the URL is contained in any of the specified port lists. For example [80, 443, [1000, 1200]] matches all requests on port 80, 443 and in the range 1000-1200.  */
            ports?: any[];
            /**
             * Optional.
            * Matches if the URL without query segment and fragment identifier matches a specified regular expression. Port numbers are stripped from the URL if they match the default port number. The regular expressions use the RE2 syntax.
            */
            originAndPathMatches?: string;
        }

        /** An object which allows the addition and removal of listeners for a Chrome event. */
        export interface Event<T extends Function> {
            /**
             * Registers an event listener callback to an event.
             */
            addListener(callback: T): void;
            /**
             * Returns currently registered rules.
             * Parameter rules: Rules that were registered, the optional parameters are filled with values.
             */
            getRules(): Promise<Rule[]>;
            /**
             * Returns currently registered rules.
             * @param ruleIdentifiers If an array is passed, only rules with identifiers contained in this array are returned.
             * Parameter rules: Rules that were registered, the optional parameters are filled with values.
             */
            getRules(ruleIdentifiers: string[]): Promise<Rule[]>;
            /**
             * @param callback Listener whose registration status shall be tested.
             */
            hasListener(callback: T): boolean;
            /**
             * Unregisters currently registered rules.
             * @param ruleIdentifiers If an array is passed, only rules with identifiers contained in this array are unregistered.
             */
            removeRules(ruleIdentifiers?: string[]): Promise<void>;
            /**
             * Unregisters currently registered rules.
             */
            removeRules(): Promise<void>;
            /**
             * Registers rules to handle events.
             * @param rules Rules to be registered. These do not replace previously registered rules.
             * Parameter rules: Rules that were registered, the optional parameters are filled with values.
             */
            addRules(rules: Rule[]): Promise<Rule[]>;
            /**
             * Deregisters an event listener callback from an event.
             */
            removeListener(callback: T): void;
            hasListeners(): boolean;
        }

        /** Description of a declarative rule for handling events. */
        export interface Rule {
            /** Optional. Optional priority of this rule. Defaults to 100.  */
            priority?: number;
            /** List of conditions that can trigger the actions. */
            conditions: any[];
            /** Optional. Optional identifier that allows referencing this rule.  */
            id?: string;
            /** List of actions that are triggered if one of the condtions is fulfilled. */
            actions: any[];
            /**
             * Optional.
            * Tags can be used to annotate rules and perform operations on sets of rules.
            */
            tags?: string[];
        }
    }
}