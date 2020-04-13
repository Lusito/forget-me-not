import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";

import { messageUtil } from "../../lib/messageUtil";
import "./style.scss";
import { SnoozeDialog } from "../dialogs/snoozeDialog";
import { ExtensionContextProps } from "../../lib/bootstrap";

export function SnoozeButton({ context: { browserInfo } }: ExtensionContextProps) {
    const button = (<button class="snooze_button" onClick={onClick} disabled />) as HTMLButtonElement;
    function toggleSnooze() {
        button.disabled = true;
        messageUtil.send("toggleSnoozingState");
    }

    function onClick() {
        if (browserInfo.mobile) {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            <SnoozeDialog snoozing={button.classList.contains("is-active")} toggle={toggleSnooze} />;
        } else {
            toggleSnooze();
        }
    }

    messageUtil.receive("onSnoozingState", (snoozing: boolean) => {
        button.disabled = false;
        button.className = snoozing ? "snooze_button is-active" : "snooze_button";
        // fixme: aria
        const state = document.querySelector("#snooze_bubble_state") as HTMLElement;
        state.textContent = wetLayer.getMessage(`button_toggle_snooze_${snoozing}`);
    });
    messageUtil.send("getSnoozingState");

    return button;
}
