import { formatStackTrace } from "jest-message-util";
import { ValidationError } from "jest-validate";

const INVALID_STACK_FILE = /^deepMock[a-zA-Z]*\.(ts|js)$/;
const VALID_STACK_LINE = /^\s*at .* \((.+):([0-9]+):([0-9]+)\)$/;
const VALID_STACK_LINE2 = /^\s*at (.+):([0-9]+):([0-9]+)$/;

export function getCleanStack() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stack = new Error().stack!.split("\n");
    const firstValidLine = stack.findIndex((line) => {
        const result = VALID_STACK_LINE.exec(line) || VALID_STACK_LINE2.exec(line);
        if (result) {
            const fileParts = result[1].split(/[\\/]/);
            const filename = fileParts[fileParts.length - 1];
            return !INVALID_STACK_FILE.test(filename);
        }
        return false;
    });
    if (firstValidLine !== -1) return `\n${stack.slice(firstValidLine).join("\n")}`;
    return "Error analyzing stack trace";
}

export function colorizeStack(stack: string, noStackTrace = false) {
    return formatStackTrace(
        `  \n${stack}`,
        {
            rootDir: "",
            testMatch: [],
        },
        {
            noStackTrace,
        }
    );
}

export class DeepMockError extends ValidationError {
    public constructor(message: string, excludeStack?: boolean) {
        super("", "");
        this.message = excludeStack ? message : `${message}\n\nInvocation: \n${colorizeStack(getCleanStack())}\n`;
    }
}
