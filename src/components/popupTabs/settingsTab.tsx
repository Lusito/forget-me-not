import { h } from "tsx-dom";

import { TabContainer, Tab } from "../tabContainer";
import { GeneralTab } from "./settingsTabs/generalTab";
import { CleanupTab } from "./settingsTabs/cleanupTab";
import { ExperimentalTab } from "./settingsTabs/experimentalTab";

export function SettingsTab() {
    return (
        <TabContainer defaultTab="settings/cleanup">
            <Tab i18n="tabs_settings_general" name="settings/general">
                <GeneralTab />
            </Tab>
            <Tab i18n="tabs_settings_cleanup" name="settings/cleanup">
                <CleanupTab />
            </Tab>
            <Tab i18n="tabs_settings_experimental" name="settings/experimental">
                <ExperimentalTab />
            </Tab>
        </TabContainer>
    );
}
