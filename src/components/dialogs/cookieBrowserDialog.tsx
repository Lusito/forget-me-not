import { h } from "tsx-dom";
import { Cookies, browser, ContextualIdentities } from "webextension-polyfill-ts";
import { getDomain } from "tldjs";
import { wetLayer } from "wet-layer";

import { Dialog, showDialog, hideDialog } from "./dialog";
import { on, removeAllChildren } from "../../frontend/htmlUtils";
import { connectSettings } from "../../frontend/htmlSettings";
import { getBadgeForCleanupType, BadgeInfo } from "../../background/backgroundHelpers";
import { appendPunycode, showAddRuleDialog, getSuggestedRuleExpression } from "../helpers";
import { ExtensionContext } from "../../lib/bootstrap";

interface CookieListCookie {
    badge: BadgeInfo;
    cookie: Cookies.Cookie;
}

interface CookieListForDomain {
    badge: BadgeInfo;
    domain: string;
    firstPartyDomain: string;
    cookies: CookieListCookie[];
}

function compareCaseInsensitive(a: string, b: string) {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    if (lowerA < lowerB) return -1;
    if (lowerA > lowerB) return 1;
    return 0;
}

function compareDomain(a: CookieListForDomain, b: CookieListForDomain) {
    const value = compareCaseInsensitive(a.firstPartyDomain, b.firstPartyDomain);
    if (value !== 0) return value;
    return compareCaseInsensitive(a.domain, b.domain);
}

function compareCookieName(a: CookieListCookie, b: CookieListCookie) {
    return compareCaseInsensitive(a.cookie.name, b.cookie.name);
}

const noopToArray = () => [];

async function getCookieList({ settings, supports, storeUtils }: ExtensionContext) {
    const cookieStores = await storeUtils.getAllCookieStoreIds();
    const nestedCookies = await Promise.all(
        cookieStores.map((storeId) => {
            const details: Cookies.GetAllDetailsType = { storeId };
            if (supports.firstPartyIsolation) details.firstPartyDomain = null;
            return browser.cookies.getAll(details).catch(noopToArray);
        })
    );
    const cookies = ([] as Cookies.Cookie[]).concat(...nestedCookies);

    const cookiesByDomain: { [s: string]: CookieListForDomain } = {};
    for (const cookie of cookies) {
        const rawDomain = cookie.domain.startsWith(".") ? cookie.domain.substr(1) : cookie.domain;
        const firstPartyDomain = getDomain(rawDomain) || rawDomain;
        const cleanupTypeForCookie = settings.getCleanupTypeForCookie(rawDomain, cookie.name);
        const badge = getBadgeForCleanupType(cleanupTypeForCookie);
        const byDomain = cookiesByDomain[cookie.domain];
        const mapped = { badge, cookie };
        if (byDomain) {
            byDomain.cookies.push(mapped);
        } else {
            cookiesByDomain[cookie.domain] = {
                badge: getBadgeForCleanupType(settings.getCleanupTypeForDomain(rawDomain)),
                domain: cookie.domain,
                firstPartyDomain,
                cookies: [mapped],
            };
        }
    }
    const cookiesByDomainList = Object.keys(cookiesByDomain)
        .map((domain) => cookiesByDomain[domain])
        .sort(compareDomain);
    for (const a of cookiesByDomainList) a.cookies.sort(compareCookieName);
    return cookiesByDomainList;
}

let contextualIdentities: { [s: string]: ContextualIdentities.ContextualIdentity } = {};

async function updateContextualIdentities() {
    contextualIdentities = {};
    if (browser.contextualIdentities) {
        try {
            const list = await browser.contextualIdentities.query({});
            for (const ci of list) contextualIdentities[ci.cookieStoreId] = ci;
        } catch (e) {
            console.error("Can't get storeNames", e);
        }
    }
}

function mapToCookieItem(context: ExtensionContext, entry: CookieListCookie, updateList: () => void) {
    const expires = entry.cookie.session
        ? "On Session End"
        : new Date((entry.cookie.expirationDate ?? 0) * 1000).toLocaleString() || "?";
    const contextualIdentity = contextualIdentities[entry.cookie.storeId];
    const cookieStoreValue = contextualIdentity ? (
        <span class="cookie_list_value" style={`border-bottom: 1px solid ${contextualIdentity.colorCode}`}>
            {contextualIdentity.name}
        </span>
    ) : (
        <span class="cookie_list_value">{entry.cookie.storeId}</span>
    );

    const cookieAttributes = (
        <ul class="collapsed cookie_attributes" data-tree-node-id={`cookie-${entry.cookie.name}`}>
            <li class="cookie_list_split">
                <b>Value:</b>
                <span class="cookie_list_value" data-searchable title={entry.cookie.value}>
                    {entry.cookie.value}
                </span>
            </li>
            <li class="cookie_list_split">
                <b>Expires:</b>
                <span class="cookie_list_value">{expires}</span>
            </li>
            <li class="cookie_list_split">
                <b>Store:</b>
                {cookieStoreValue}
            </li>
            <li class="cookie_list_split">
                <b>Secure:</b>
                <span class="cookie_list_value">{entry.cookie.secure ? "Yes" : "No"}</span>
            </li>
        </ul>
    );
    const toggleCookieAttributes = (e: MouseEvent) => {
        const collapsed = cookieAttributes.classList.toggle("collapsed");
        (e.currentTarget as HTMLElement).textContent = collapsed ? "+" : "-";
    };

    function addCookieRule() {
        showAddRuleDialog(context, getSuggestedRuleExpression(entry.cookie.domain, entry.cookie.name), updateList);
    }
    const title = wetLayer.getMessage(`${entry.badge.i18nButton}@title`);
    return (
        <li>
            <div class="cookie_list_split">
                <span class="cookie_list_toggle" onClick={toggleCookieAttributes}>
                    +
                </span>
                <span class={entry.badge.className} title={title}>
                    {wetLayer.getMessage(entry.badge.i18nBadge)}
                </span>
                <i class="cookie_list_label" data-searchable>
                    {entry.cookie.name}
                </i>
                <button class="cookie_list_add_rule" onClick={addCookieRule}>
                    + Add Rule
                </button>
            </div>
            {cookieAttributes}
        </li>
    );
}

function mapToDomainItem(context: ExtensionContext, entry: CookieListForDomain, updateList: () => void) {
    const mapToCookieItemWrapped = (e: CookieListCookie) => mapToCookieItem(context, e, updateList);
    const cookiesList = (
        <ul class="collapsed" data-tree-node-id={`domain-${entry.domain}`}>
            {entry.cookies.map(mapToCookieItemWrapped)}
        </ul>
    );

    const toggler = (
        <span class="cookie_list_toggle" onClick={toggleCookiesList}>
            +
        </span>
    );
    function toggleCookiesList() {
        const collapsed = cookiesList.classList.toggle("collapsed");
        toggler.textContent = collapsed ? "+" : "-";
    }

    function addDomainRule() {
        showAddRuleDialog(context, getSuggestedRuleExpression(entry.domain), updateList);
    }
    const punified = appendPunycode(entry.domain);
    const title = wetLayer.getMessage(`${entry.badge.i18nButton}@title`);
    return (
        <li>
            <div class="cookie_list_split">
                {toggler}
                <span class={entry.badge.className} title={title}>
                    {wetLayer.getMessage(entry.badge.i18nBadge)}
                </span>
                <b title={punified} data-searchable>
                    {punified}
                </b>
                <button class="cookie_list_add_rule" onClick={addDomainRule}>
                    + Add Rule
                </button>
            </div>
            {cookiesList}
        </li>
    );
}

interface CookieBrowserDialogProps {
    button: HTMLElement;
    context: ExtensionContext;
}

export function CookieBrowserDialog({ button, context }: CookieBrowserDialogProps) {
    const buttons = [<button data-i18n="dialog_back" onClick={() => hideDialog(dialog)} />];

    const cookieList = <ul class="cookie_list" />;
    const searchField = (<input class="cookie_list_search" placeholder="Search.." />) as HTMLInputElement;
    function filterList() {
        const needle = searchField.value.trim().toLowerCase();
        if (needle) {
            for (const child of cookieList.children) {
                const searchables = [...child.querySelectorAll("*[data-searchable]")];
                const collapsed = searchables.every((s) => !(s.textContent ?? "").toLowerCase().includes(needle));
                child.classList.toggle("collapsed", collapsed);
            }
        } else {
            for (const child of cookieList.children) child.classList.toggle("collapsed", false);
        }
    }
    on(searchField, "input", filterList);

    const dialog = (
        <Dialog className="clean_dialog" titleI18nKey="cookie_browser_title">
            <div>{searchField}</div>
            {cookieList}
            <div class="split_equal split_wrap">{buttons}</div>
        </Dialog>
    );
    async function updateList() {
        const expanded = [...cookieList.querySelectorAll("ul:not(.collapsed)")].map((e) =>
            e.getAttribute("data-tree-node-id")
        );
        removeAllChildren(cookieList);
        const list = await getCookieList(context);
        await updateContextualIdentities();
        for (const byDomain of list)
            cookieList.appendChild(
                mapToDomainItem(context, byDomain, () => {
                    updateList();
                })
            );
        filterList();
        for (const key of expanded) {
            const element = cookieList.querySelector(`ul.collapsed[data-tree-node-id='${key}']`);
            element?.classList.remove("collapsed");
        }
    }
    on(button, "click", () => {
        updateList();
        showDialog(dialog, buttons[0]);
    });
    connectSettings(dialog, context.settings);
    return dialog;
}
