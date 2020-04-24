import { Browser } from "webextension-polyfill-ts";

import { DeepMock } from "./deepMockTypes";

declare global {
    export const mockBrowser: DeepMock<Browser>;
}
