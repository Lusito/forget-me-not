import { ExtensionBackgroundContext } from "../background/backgroundShared";
import { DeepMockNode } from "./deepMockNode";
import { deepMock } from "./deepMock";

const mockContextNode = new DeepMockNode("context");

afterEach(() => {
    mockContextNode.verifyAndDisable();
});

beforeEach(() => {
    mockContextNode.enable();
});

export const testContext: ExtensionBackgroundContext = mockContextNode.getProxy();
export const mockContext = deepMock<ExtensionBackgroundContext>(mockContextNode);
