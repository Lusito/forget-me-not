import { h } from "tsx-dom";
import { messageUtil } from "../../lib/messageUtil";
import { wetLayer } from "wet-layer";
import "./style.scss";
import { browserInfo } from "../../lib/browserInfo";
import { SnoozeDialog } from "../dialogs/snoozeDialog";

export function SnoozeButton() {
    const button = <button class="snooze_button" onClick={onClick} disabled={true}></button> as HTMLButtonElement;
    function toggleSnooze() {
        button.disabled = true;
        messageUtil.send("toggleSnoozingState");
    }

    function onClick() {
        if (browserInfo.mobile) {
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
        state.textContent = wetLayer.getMessage("button_toggle_snooze_" + snoozing);
    });
    messageUtil.send("getSnoozingState");

    return button;
}
