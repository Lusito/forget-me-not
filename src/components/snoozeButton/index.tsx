import { h } from "tsx-dom";
import { wetLayer } from "wet-layer";
import { container } from "tsyringe";

import { SnoozeDialog } from "../dialogs/snoozeDialog";
import { MessageUtil } from "../../shared/messageUtil";
import "./style.scss";
import { BrowserInfo } from "../../shared/browserInfo";

export function SnoozeButton() {
    const messageUtil = container.resolve(MessageUtil);
    const browserInfo = container.resolve(BrowserInfo);

    const button = (<button class="snooze_button" onClick={onClick} disabled />) as HTMLButtonElement;
    function toggleSnooze() {
        button.disabled = true;
        messageUtil.toggleSnoozingState.send();
    }

    function onClick() {
        if (browserInfo.isMobile()) {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            <SnoozeDialog snoozing={button.classList.contains("is-active")} toggle={toggleSnooze} />;
        } else {
            toggleSnooze();
        }
    }

    messageUtil.onSnoozingState.receive((snoozing: boolean) => {
        button.disabled = false;
        button.className = snoozing ? "snooze_button is-active" : "snooze_button";
        // fixme: aria
        const state = document.querySelector("#snooze_bubble_state") as HTMLElement;
        state.textContent = wetLayer.getMessage(`button_toggle_snooze_${snoozing}`);
    });
    messageUtil.getSnoozingState.send();

    return button;
}
