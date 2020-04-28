import { Browser } from "webextension-polyfill-ts";
import { MockzillaDeep } from "mockzilla";

declare global {
    export const mockBrowser: MockzillaDeep<Browser>;
}
