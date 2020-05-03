const isAlNum = /^[a-z0-9]+$/;
const isAlNumDash = /^[a-z0-9-]+$/;
const validCookieName = /^[!,#,$,%,&,',*,+,\-,.,0-9,:,;,A-Z,\\,^,_,`,a-z,|,~]+$/i;

function isValidExpressionPart(part: string) {
    if (part.length === 0) return false;
    if (part === "*") return true;
    return isAlNum.test(part[0]) && isAlNum.test(part[part.length - 1]) && isAlNumDash.test(part);
}

function isValidDomainExpression(exp: string) {
    const parts = exp.split(".");
    return parts.length > 0 && parts.findIndex((p) => !isValidExpressionPart(p)) === -1;
}

export interface SplitExpression {
    domain: string;
    cookie?: string;
    container?: string;
}

export function splitExpression(exp: string) {
    const result: SplitExpression = { domain: exp };
    const containerSplitIndex = result.domain.indexOf("#");
    if (containerSplitIndex >= 0) {
        result.container = result.domain.substr(0, containerSplitIndex);
        result.domain = result.domain.substr(containerSplitIndex + 1);
    }
    const cookieSplitIndex = result.domain.lastIndexOf("@");
    if (cookieSplitIndex >= 0) {
        result.cookie = result.domain.substr(0, cookieSplitIndex);
        result.domain = result.domain.substr(cookieSplitIndex + 1);
    }
    return result;
}

export function isValidExpression(exp: string) {
    const split = splitExpression(exp);
    if (typeof split.cookie === "string" && !validCookieName.test(split.cookie)) return false;
    return isValidDomainExpression(split.domain);
}
