////////////////////
// i18n
////////////////////
/**
 * Use the browser.i18n infrastructure to implement internationalization across your whole app or extension.
 */
export namespace I18n {
    export type LanguageCode = string;

    /** Holds detected ISO language code and its percentage in the input string */
    export interface DetectedLanguage {
        /** An ISO language code such as 'en' or 'fr'.
         * For a complete list of languages supported by this method, see  [kLanguageInfoTable]{@link https://src.chromium.org/viewvc/browser/trunk/src/third_party/cld/languages/internal/languages.cc}.
         * For an unknown language, 'und' will be returned, which means that [percentage] of the text is unknown to CLD */
        language: string;

        /** The percentage of the detected language */
        percentage: number;
    }

    /** Holds detected language reliability and array of DetectedLanguage */
    export interface LanguageDetectionResult {
        /** CLD detected language reliability */
        isReliable: boolean;

        /** Array of detectedLanguage */
        languages: DetectedLanguage[];
    }

    export interface Static {
        /**
         * Gets the accept-languages of the browser. This is different from the locale used by the browser; to get the locale, use i18n.getUILanguage.
         * Parameter languages: Array of the accept languages of the browser, such as en-US,en,zh-CN
         */
        getAcceptLanguages(): Promise<LanguageCode[]>;
        /**
         * Gets the localized string for the specified message. If the message is missing, this method returns an empty string (''). If the format of the getMessage() call is wrong — for example, messageName is not a string or the substitutions array has more than 9 elements — this method returns undefined.
         * @param messageName The name of the message, as specified in the messages.json file.
         * @param substitutions Optional. Up to 9 substitution strings, if the message requires any.
         */
        getMessage(messageName: string, substitutions?: any): string;
        /**
         * Gets the browser UI language of the browser. This is different from i18n.getAcceptLanguages which returns the preferred user languages.
         */
        getUILanguage(): LanguageCode;

        /** Detects the language of the provided text using CLD.
         * @param text User input string to be translated.
         */
        detectLanguage(text: string): Promise<LanguageDetectionResult>;
    }
}