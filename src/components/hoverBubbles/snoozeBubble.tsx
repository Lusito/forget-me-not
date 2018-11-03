import { h } from "tsx-dom";
import { HoverBubble } from "./hoverBubble";

interface SnoozeBubbleProps {
    button: HTMLElement;
}

export function SnoozeBubble({ button }: SnoozeBubbleProps) {
    return <HoverBubble button={button}>
        <h3 id="snooze_bubble_state" />
        <div data-i18n="toggle_snooze_description?markdown" class="compact_markdown" />
    </HoverBubble>;
}
