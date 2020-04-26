/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

// This file converts rule expressions to regular expressions

export function ruleToRegExString(rule: string) {
    if (rule === "*") return ".*";

    const parts = rule.split(".");

    let prefix;
    if (parts[0] === "*") {
        prefix = "(^|\\.)";
        parts.shift();
    } else {
        prefix = "^";
    }

    let suffix;
    if (parts.length > 0 && parts[parts.length - 1] === "*") {
        suffix = "($|\\..*)";
        parts.pop();
    } else {
        suffix = "$";
    }
    const middle = parts
        .map((part) => (part === "*" ? ".*" : part))
        .join("\\.")
        .replace(/\\.\.\*\\./g, "(\\..*\\.|\\.)");

    return `${prefix}${middle}${suffix}`;
}

export function getRegExForRule(rule: string) {
    return new RegExp(ruleToRegExString(rule));
}
