import { h, BaseProps } from "tsx-dom";
import { on } from "../../lib/htmlUtils";
import "./style.scss";

interface HoverBubbleProps extends BaseProps {
    button: HTMLElement;
}

export function HoverBubble({ children, button }: HoverBubbleProps) {
    const arrow = <div class="hover_bubble_arrow" />;
    const bubble = <div class="hover_bubble">
        {arrow}
        {children}
    </div>;

    function focus() {
        document.querySelectorAll(".hover_bubble").forEach((e) => e.classList.remove("is-active"));
        const buttonRect = button.getBoundingClientRect();
        arrow.style.left = (buttonRect.left + buttonRect.width / 2) + "px";
        requestAnimationFrame(() => {
            const bubbleRect = bubble.getBoundingClientRect();
            document.body.style.minHeight = (bubbleRect.top + bubbleRect.height + 1) + "px";
        });
        bubble.classList.add("is-active");
    }

    function blur() {
        document.body.style.minHeight = "";
        bubble.classList.remove("is-active");
    }

    on(button, "focus", focus);
    on(button, "blur", blur);
    on(button, "mouseover", focus);
    on(button, "mouseout", blur);
    return bubble;
}
