import { h } from "tsx-dom";

import { HoverBubble } from "./hoverBubble";

interface CookieBrowserBubbleProps {
    button: HTMLElement;
}

export function CookieBrowserBubble({ button }: CookieBrowserBubbleProps) {
    return (
        <HoverBubble button={button}>
            <div data-i18n="cookie_browser_description?markdown" class="compact_markdown" />
        </HoverBubble>
    );
}
