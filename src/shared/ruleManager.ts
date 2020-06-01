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
import { StoreUtils } from "./storeUtils";

const CHOSEN_RULES_ORDER = [CleanupType.INSTANTLY, CleanupType.LEAVE, CleanupType.NEVER, CleanupType.STARTUP];

interface RuleManagerConfig {
    whitelistFileSystem: boolean;
    whitelistNoTLD: boolean;
    fallbackRule: CleanupType;
    rules: RuleDefinition[];
    protectOpenDomains: {
        startup: boolean;
        manual: boolean;
    };
}

@singleton()
export class RuleManager {
    private config: RuleManagerConfig = {
        whitelistFileSystem: true,
        whitelistNoTLD: false,
        fallbackRule: CleanupType.LEAVE,
        rules: [],
        protectOpenDomains: {
            startup: true,
            manual: true,
        },
    };

    private identities: ContextualIdentities.ContextualIdentity[] = [];

    // All cookie rules except those with errors
    private nonCookieRules: CompiledRuleDefinition[] = [];

    // All temporary rules except those with errors
    private temporaryRules: CompiledRuleDefinition[] = [];

    // All rules except those with errors
    private rules: CompiledRuleDefinition[] = [];

    // Contains even rules with errors
    private allRules: CompiledRuleDefinition[] = [];

    public constructor(private readonly storeUtils: StoreUtils) {}

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
        this.rules = [];
        this.allRules = [];

        for (const rule of this.config.rules) {
            const split = splitExpression(rule.rule);
            const compiledRule: CompiledRuleDefinition = {
                definition: rule,
                regex: getRegExForRule(split.domain),
            };
            if (typeof split.container === "string") {
                if (split.container.length === 0) {
                    compiledRule.storeId = this.storeUtils.defaultCookieStoreId;
                } else {
                    const containerName = split.container.toLowerCase();
                    const identity = this.identities.find((id) => id.name.toLowerCase() === containerName);
                    if (identity) compiledRule.storeId = identity.cookieStoreId;
                    else {
                        console.error(`Could not find container with name ${split.container}`);
                        compiledRule.error = true;
                    }
                }
            }

            if (typeof split.cookie === "string") compiledRule.cookieName = split.cookie.toLowerCase();
            else if (!compiledRule.error) this.nonCookieRules.push(compiledRule);

            if (!compiledRule.error) {
                this.rules.push(compiledRule);

                if (compiledRule.definition.temporary) this.temporaryRules.push(compiledRule);
            }

            this.allRules.push(compiledRule);
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

    public getCleanupTypesFor(domain: string) {
        if (this.config.whitelistFileSystem && domain.length === 0) return [CleanupType.NEVER];
        if (this.config.whitelistNoTLD && domain.length > 0 && !domain.includes(".")) return [CleanupType.NEVER];

        const set = new Set<CleanupType>();
        this.allRules.filter(matchDomain(domain)).forEach((rule) => set.add(rule.definition.type));

        if (set.size === 0) return [this.config.fallbackRule];
        return Array.from(set);
    }

    public getCleanupTypeFor(domain: string, storeId: string | false, cookieName: string | false) {
        if (this.config.whitelistFileSystem && domain.length === 0) return CleanupType.NEVER;
        if (this.config.whitelistNoTLD && domain.length > 0 && !domain.includes(".")) return CleanupType.NEVER;

        let rules = cookieName === false ? this.nonCookieRules : this.rules;
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

    public protectOpenDomains(startup: boolean) {
        return startup ? this.config.protectOpenDomains.startup : this.config.protectOpenDomains.manual;
    }
}
