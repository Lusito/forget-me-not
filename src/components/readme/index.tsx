import { h } from "tsx-dom";
import { TabContainer, Tab } from "../tabContainer";
import { wetLayer } from "wet-layer";
import { translateDocument } from "../../lib/htmlUtils";
import { LogoWithLink } from "../logo/logoWithLink";
import "./style.scss";

const readme = <TabContainer defaultTab="tutorial">
    <Tab i18n="tabs_tutorial?title" name="tutorial" icon="graduate_cap.svg" panelClass="active"><div data-i18n="tutorial_page?markdown" /></Tab>
    <Tab i18n="tabs_experimental?title" name="experimental" icon="directions.svg"><div data-i18n="experimental_page?markdown" /></Tab>
    <Tab i18n="tabs_changelog?title" name="changelog" icon="history.svg"><div data-i18n="changelog_page?markdown" /></Tab>
    <Tab i18n="tabs_about?title" name="about" icon="info.svg"><div data-i18n="about_page?markdown" /></Tab>
</TabContainer>;

readme.insertBefore(<LogoWithLink />, readme.querySelector(".tabs_pages"));

document.body.appendChild(readme);

translateDocument();
wetLayer.addListener(translateDocument);

wetLayer.loadFromStorage();
