import { h } from "tsx-dom";
import { container } from "tsyringe";

import { TabContainer, Tab } from "../tabContainer";
import { GeneralTab } from "./settingsTabs/generalTab";
import { CleanupTab } from "./settingsTabs/cleanupTab";
import { ExperimentalTab } from "./settingsTabs/experimentalTab";
import { Settings } from "../../shared/settings";

export function SettingsTab() {
    const settings = container.resolve(Settings);
    const onTabSelected = (name: string) => {
        settings.set("lastTab", name);
        settings.save();
    };
    return (
        <TabContainer defaultTab="settings/cleanup" onTabSelected={onTabSelected}>
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
