import { h } from "tsx-dom";
import "typeface-open-sans";
import { wetLayer } from "wet-layer";

import { TabContainer, Tab } from "../tabContainer";
import { translateDocument } from "../../frontend/htmlUtils";
import { LogoWithLink } from "../logo/logoWithLink";
import icons from "../../icons";

const readme = (
    <TabContainer defaultTab="tutorial">
        <Tab i18n="tabs_tutorial?title" name="tutorial" icon={icons.graduateCap} panelClass="active">
            <div data-i18n="tutorial_page?markdown" />
        </Tab>
        <Tab i18n="tabs_experimental?title" name="experimental" icon={icons.directions}>
            <div data-i18n="experimental_page?markdown" />
        </Tab>
        <Tab i18n="tabs_changelog?title" name="changelog" icon={icons.history}>
            <div data-i18n="changelog_page?markdown" />
        </Tab>
        <Tab i18n="tabs_about?title" name="about" icon={icons.info}>
            <div data-i18n="about_page?markdown" />
        </Tab>
    </TabContainer>
);

readme.insertBefore(<LogoWithLink />, readme.querySelector(".tabs_pages"));

document.body.appendChild(readme);

translateDocument();
wetLayer.addListener(translateDocument);

wetLayer.loadFromStorage();
