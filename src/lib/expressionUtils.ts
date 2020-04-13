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

export function isValidExpression(exp: string) {
    const parts = exp.split("@");
    if (parts.length === 1) return isValidDomainExpression(exp);
    return parts.length === 2 && validCookieName.test(parts[0]) && isValidDomainExpression(parts[1]);
}
