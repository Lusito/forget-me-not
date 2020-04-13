/**
 * License: zlib/libpng
 * @author Santo Pfingsten
 * @see https://github.com/Lusito/forget-me-not
 */

import { wetLayer } from "wet-layer";
import { h } from "tsx-dom";
import "typeface-open-sans";

import { settings } from "../../lib/settings";
import { translateDocument } from "../../lib/htmlUtils";
import { browserInfo } from "../../lib/browserInfo";
import { connectSettings, updateFromSettings } from "../../lib/htmlSettings";
import { messageUtil } from "../../lib/messageUtil";
import { LogTab } from "../popupTabs/logTab";
import { RulesTab } from "../popupTabs/rulesTab";
import { SettingsTab } from "../popupTabs/settingsTab";
import { StartTab } from "../popupTabs/startTab";
import { TabContainer, Tab, validHash } from "../tabContainer";
import { SnoozeButton } from "../snoozeButton";
import { SnoozeBubble } from "../hoverBubbles/snoozeBubble";
import { ManualCleanupBubble } from "../hoverBubbles/manualCleanupBubble";
import { HelpBubble } from "../hoverBubbles/helpBubble";
import { LogoWithLink } from "../logo/logoWithLink";
import "./style.scss";
import { CleanDialog } from "../dialogs/cleanDialog";
import { EXPORT_IGNORE_KEYS, SettingsKey } from "../../lib/settingsSignature";
import { CookieBrowserDialog } from "../dialogs/cookieBrowserDialog";
import { CookieBrowserBubble } from "../hoverBubbles/cookieBrowserBubble";
import icons from "../../icons";

settings.onReady(() => {
    if (browserInfo.mobile) (document.querySelector("html") as HTMLHtmlElement).classList.add("fullscreen");
    else if (window.innerWidth <= 350) (document.querySelector("html") as HTMLHtmlElement).classList.add("small_size");

    if (document.location && !validHash.test(document.location.hash.substr(1))) {
        const initialTab = settings.get("initialTab");
        if (initialTab === "last_active_tab") document.location.hash = `#${settings.get("lastTab")}`;
        else if (initialTab) document.location.hash = `#${initialTab}`;
    }

    const popup = (
        <TabContainer helpUrl="readme.html#tutorial" defaultTab="this_tab">
            <Tab i18n="tabs_this_tab?title" name="this_tab" icon={icons.location}>
                <StartTab />
            </Tab>
            <Tab i18n="tabs_rules?title" name="rules" icon={icons.shield}>
                <RulesTab />
            </Tab>
            <Tab i18n="tabs_settings?title" name="settings" icon={icons.settings} panelClass="tab_with_subtabs">
                <SettingsTab />
            </Tab>
            <Tab i18n="tabs_log?title" name="log" icon={icons.list}>
                <LogTab />
            </Tab>
        </TabContainer>
    );

    connectSettings(popup);

    messageUtil.receive("settingsChanged", (changedKeys: SettingsKey[]) => {
        if (changedKeys.some((key) => !EXPORT_IGNORE_KEYS.includes(key))) updateFromSettings();
    });

    document.body.appendChild(popup);

    const cookieBrowserButton = <button class="cookie_browser_button">{/* fixme:title/aria */}</button>;
    const cleanupButton = <button class="manual_cleanup_button">{/* fixme:title/aria */}</button>;
    const snoozeButton = <SnoozeButton />;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    <CookieBrowserDialog button={cookieBrowserButton} />;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    <CleanDialog button={cleanupButton} />;

    popup.insertBefore(
        <div id="toolbar">
            {cookieBrowserButton}
            {cleanupButton}
            {snoozeButton}
        </div>,
        popup.querySelector(".tabs_pages")
    );

    popup.insertBefore(<LogoWithLink target="_blank" />, popup.querySelector(".tabs_pages"));

    if (!browserInfo.mobile) {
        document.body.appendChild(<HelpBubble button={popup.querySelector("#help_button") as HTMLElement} />);
        document.body.appendChild(<CookieBrowserBubble button={cookieBrowserButton} />);
        document.body.appendChild(<ManualCleanupBubble button={cleanupButton} />);
        document.body.appendChild(<SnoozeBubble button={snoozeButton} />);
    }

    function updateTranslations() {
        translateDocument();
        [...document.body.querySelectorAll("input[placeholder]")].forEach((e) =>
            e.setAttribute("aria-label", e.getAttribute("placeholder") ?? "")
        );
    }
    updateTranslations();
    wetLayer.addListener(updateTranslations);
    wetLayer.loadFromStorage();
});
