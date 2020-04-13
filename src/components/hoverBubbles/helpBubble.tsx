import { h } from "tsx-dom";

import { HoverBubble } from "./hoverBubble";

interface HelpBubbleProps {
    button: HTMLElement;
}

export function HelpBubble({ button }: HelpBubbleProps) {
    return (
        <HoverBubble button={button}>
            <div data-i18n="help_button@title" />
        </HoverBubble>
    );
}
