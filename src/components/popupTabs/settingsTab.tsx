import { h } from "tsx-dom";

import { TabContainer, Tab } from "../tabContainer";
import { GeneralTab } from "./settingsTabs/generalTab";
import { CleanupTab } from "./settingsTabs/cleanupTab";
import { ExperimentalTab } from "./settingsTabs/experimentalTab";
import { ExtensionContextProps } from "../../lib/bootstrap";

export function SettingsTab({ context }: ExtensionContextProps) {
    const onTabSelected = (name: string) => {
        context.settings.set("lastTab", name);
        context.settings.save();
    };
    return (
        <TabContainer defaultTab="settings/cleanup" onTabSelected={onTabSelected}>
            <Tab i18n="tabs_settings_general" name="settings/general">
                <GeneralTab context={context} />
            </Tab>
            <Tab i18n="tabs_settings_cleanup" name="settings/cleanup">
                <CleanupTab context={context} />
            </Tab>
            <Tab i18n="tabs_settings_experimental" name="settings/experimental">
                <ExperimentalTab context={context} />
            </Tab>
        </TabContainer>
    );
}
