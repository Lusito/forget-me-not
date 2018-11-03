import { h } from "tsx-dom";
import { HoverBubble } from "./hoverBubble";

interface ManualCleanupBubbleProps {
    button: HTMLElement;
}

export function ManualCleanupBubble({ button }: ManualCleanupBubbleProps) {
    return <HoverBubble button={button}>
        <div data-i18n="manual_cleanup_description?markdown" class="compact_markdown" />
    </HoverBubble>;
}
