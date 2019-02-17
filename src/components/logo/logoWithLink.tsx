import { h } from "tsx-dom";
import "./style.scss";

interface LogoWithLinkProps {
    target?: "_blank";
}

export function LogoWithLink({ target }: LogoWithLinkProps) {
    return <a class="logo_area" data-i18n="tabs_about?title" href="readme.html#about" target={target} />;
}
