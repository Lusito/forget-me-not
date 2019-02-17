import { h } from "tsx-dom";
import { handleClickOpenNewTab } from "../../lib/htmlUtils";

interface HelpLinkProps {
    href: string;
    i18n: string;
}

export function HelpLink({ href, i18n }: HelpLinkProps) {
    return <a href={href} onClick={handleClickOpenNewTab} target="_blank" class="help_link" data-i18n={i18n}>?</a>;
}
