import { browser, ContextualIdentities } from "webextension-polyfill-ts";
import { singleton } from "tsyringe";

import { RuleDefinition } from "./defaultSettings";
import { CleanupType } from "./types";
import { getRegExForRule } from "./regexUtils";
import { splitExpression } from "./expressionUtils";
import {
    CompiledRuleDefinition,
    matchStore,
    matchCookie,
    matchDomain,
    toRuleDefinition,
    matchNoStore,
    matchStoreOrNoStore,
    matchNoCookie,
} from "./ruleUtils";

const CHOSEN_RULES_ORDER = [CleanupType.INSTANTLY, CleanupType.LEAVE, CleanupType.NEVER, CleanupType.STARTUP];

interface RuleManagerConfig {
    whitelistFileSystem: boolean;
    whitelistNoTLD: boolean;
    fallbackRule: CleanupType;
    rules: RuleDefinition[];
}

@singleton()
export class RuleManager {
    private config: RuleManagerConfig = {
        whitelistFileSystem: true,
        whitelistNoTLD: false,
        fallbackRule: CleanupType.LEAVE,
        rules: [],
    };

    private identities: ContextualIdentities.ContextualIdentity[] = [];

    private nonCookieRules: CompiledRuleDefinition[] = [];

    private temporaryRules: CompiledRuleDefinition[] = [];

    private goodRules: CompiledRuleDefinition[] = [];

    private allRules: CompiledRuleDefinition[] = [];

    public async init() {
        this.identities = await browser.contextualIdentities.query({});
        const updateIdentities = () => {
            this.updateIdentities();
        };
        browser.contextualIdentities.onCreated.addListener(updateIdentities);
        browser.contextualIdentities.onRemoved.addListener(updateIdentities);
        browser.contextualIdentities.onUpdated.addListener(updateIdentities);
    }

    private async updateIdentities() {
        this.identities = await browser.contextualIdentities.query({});
        this.performUpdate();
    }

    public update(config: RuleManagerConfig) {
        this.config = config;
        this.performUpdate();
    }

    private performUpdate() {
        this.nonCookieRules = [];
        this.temporaryRules = [];
        this.goodRules = [];
        this.allRules = [];

        for (const rule of this.config.rules) {
            const split = splitExpression(rule.rule);
            const compiledRule: CompiledRuleDefinition = {
                definition: rule,
                regex: getRegExForRule(split.domain),
            };
            if (typeof split.container === "string") {
                const containerName = split.container.toLowerCase();
                const identity = this.identities.find((id) => id.name.toLowerCase() === containerName);
                // fixme: show a warning to user in the rule list
                if (identity) compiledRule.storeId = identity.cookieStoreId;
                else compiledRule.error = `Could not find container with name ${split.container}`;
            }

            if (typeof split.cookie === "string") compiledRule.cookieName = split.cookie.toLowerCase();
            else this.nonCookieRules.push(compiledRule);

            this.allRules.push(compiledRule);

            if (!compiledRule.error) {
                this.goodRules.push(compiledRule);

                if (compiledRule.definition.temporary) this.temporaryRules.push(compiledRule);
            }
        }
    }

    public getExactRuleDefinition(expression: string) {
        const rule = this.allRules.find((crd) => crd.definition.rule === expression);
        return rule ? rule.definition : null;
    }

    public getExactCleanupType(expression: string) {
        const definition = this.getExactRuleDefinition(expression);
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
        return definition && definition.type;
    }

    public hasBlockingRule() {
        return (
            this.config.fallbackRule === CleanupType.INSTANTLY ||
            !!this.allRules.find((r) => r.definition.type === CleanupType.INSTANTLY)
        );
    }

    private getCleanupTypeFromMatchingRules(matchingRules: RuleDefinition[]) {
        if (matchingRules.find((r) => r.type === CleanupType.INSTANTLY)) return CleanupType.INSTANTLY;
        if (matchingRules.find((r) => r.type === CleanupType.LEAVE)) return CleanupType.LEAVE;
        if (matchingRules.find((r) => r.type === CleanupType.NEVER)) return CleanupType.NEVER;
        return CleanupType.STARTUP;
    }

    private filterRules(
        rules: CompiledRuleDefinition[],
        filter: ((rule: CompiledRuleDefinition) => boolean) | false,
        fallbackFilter: (rule: CompiledRuleDefinition) => boolean
    ) {
        if (filter !== false) {
            const cookieRules = rules.filter(filter);
            if (cookieRules.length) return cookieRules;
        }
        return rules.filter(fallbackFilter);
    }

    public getCleanupTypeFor(domain: string, storeId: string | false, cookieName: string | false) {
        if (this.config.whitelistFileSystem && domain.length === 0) return CleanupType.NEVER;
        if (this.config.whitelistNoTLD && domain.length > 0 && !domain.includes(".")) return CleanupType.NEVER;

        let rules = cookieName === false ? this.nonCookieRules : this.goodRules;
        rules = rules.filter(matchDomain(domain));

        // container rules are more important than cookie rules
        rules = this.filterRules(rules, storeId !== false && matchStore(storeId), matchNoStore);

        // cookie rules are more important than generic rules
        rules = this.filterRules(rules, cookieName !== false && matchCookie(cookieName.toLowerCase()), matchNoCookie);

        return rules.length
            ? this.getCleanupTypeFromMatchingRules(rules.map(toRuleDefinition))
            : this.config.fallbackRule;
    }

    public isDomainProtected(domain: string, storeId: string | false, ignoreStartupType: boolean) {
        const type = this.getCleanupTypeFor(domain, storeId, false);
        return type === CleanupType.NEVER || (type === CleanupType.STARTUP && !ignoreStartupType);
    }

    public isDomainInstantly(domain: string, storeId: string | false) {
        return this.getCleanupTypeFor(domain, storeId, false) === CleanupType.INSTANTLY;
    }

    public getRulesForDomain(domain: string, storeId: string) {
        return this.allRules.filter(matchDomain(domain)).filter(matchStoreOrNoStore(storeId)).map(toRuleDefinition);
    }

    public getChosenRulesForDomain(domain: string, storeId: string) {
        if (this.config.whitelistFileSystem && domain.length === 0) return [];
        if (this.config.whitelistNoTLD && domain.length > 0 && !domain.includes(".")) return [];

        const matchingRules = this.getRulesForDomain(domain, storeId);
        if (matchingRules.length) {
            for (const type of CHOSEN_RULES_ORDER) {
                const rules = matchingRules.filter((r) => r.type === type);
                if (rules.length) return rules;
            }
        }
        return [];
    }

    public getTemporaryRules() {
        return this.temporaryRules;
    }
}
