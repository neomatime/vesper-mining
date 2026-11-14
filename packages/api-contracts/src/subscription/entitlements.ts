import { findPlan, reportingLevelOrder, subscriptionPlans } from "./plans";
import type { FeatureCode, OrganisationSubscription, ReportingLevel, SubscriptionId, SubscriptionPlan } from "./types";

/**
 * The checks that decide what a subscription allows. They are plain functions with no framework in them, so the interface,
 * the tests and a future backend can all use the same rules.
 *
 * A subscription entitlement is not a user permission. A person needs both: the client's subscription must include the feature,
 * and the person's role and sites must allow the action. In this prototype these run in the browser, which is only suitable for
 * navigation and presentation. The production backend must enforce every one of them (PRD VES-BR-019).
 */

export class SubscriptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionConfigError";
  }
}

export type AppliedOverride = { feature: FeatureCode; enabled: boolean };

/**
 * A subscription worked out for one client: its plan, the number of sites it may use, and the features it has. The features are
 * the plan's features, changed only by approved overrides that are in effect (see overrides.ts).
 */
export type ResolvedSubscription = { plan: SubscriptionPlan; siteAllowance: number; features: readonly FeatureCode[]; appliedOverrides: readonly AppliedOverride[] };
type SubscriptionInput = OrganisationSubscription | ResolvedSubscription;

/** Checks a stored subscription and works out its site allowance. Throws if it is not valid. */
export function resolveSubscription(input: OrganisationSubscription): ResolvedSubscription {
  const plan = findPlan(input.subscriptionId);
  if (!plan) throw new SubscriptionConfigError(`"${String(input.subscriptionId)}" is not a VESPER subscription.`);

  const allowance = plan.siteAllowance;
  if (allowance.kind === "fixed") {
    if (input.contractedSites != null && input.contractedSites !== allowance.sites) {
      throw new SubscriptionConfigError(`${plan.displayName} allows exactly ${allowance.sites} ${allowance.sites === 1 ? "site" : "sites"}. Leave the contracted sites empty or set it to ${allowance.sites}.`);
    }
    return { plan, siteAllowance: allowance.sites, features: plan.features, appliedOverrides: [] };
  }

  const sites = input.contractedSites;
  if (sites == null || !Number.isInteger(sites) || sites < allowance.minimumSites) {
    throw new SubscriptionConfigError(`${plan.displayName} needs a contracted number of sites, a whole number of at least ${allowance.minimumSites}. It is never unlimited by default.`);
  }
  return { plan, siteAllowance: sites, features: plan.features, appliedOverrides: [] };
}

const resolved = (subscription: SubscriptionInput): ResolvedSubscription => ("plan" in subscription ? subscription : resolveSubscription(subscription));

/** Whether the subscription includes a feature. */
export function planAllows(subscription: SubscriptionInput, feature: FeatureCode): boolean {
  return resolved(subscription).features.includes(feature);
}

/** Whether the subscription's reporting reaches a level, for example `advanced`. */
export function reportingAllows(subscription: SubscriptionInput, level: ReportingLevel): boolean {
  const have = reportingLevelOrder.indexOf(resolved(subscription).plan.reporting);
  return have >= reportingLevelOrder.indexOf(level);
}

/**
 * Whether a report at a given level may be seen. Essential and operational reports follow the plan's reporting level. Advanced
 * and group-level reports follow the feature, so an approved override can grant them to a client whose plan does not include them.
 */
export function reportAllowed(subscription: SubscriptionInput, level: ReportingLevel): boolean {
  if (level === "advanced") return planAllows(subscription, "advanced_analytics");
  if (level === "group") return planAllows(subscription, "group_dashboards");
  return reportingAllows(subscription, level);
}

export type SiteCapacity = { allowed: boolean; allowance: number; remaining: number; reason: string | null };

/** Whether an organisation can add another mining site, given how many it already has. */
export function canAddSite(subscription: SubscriptionInput, sitesInUse: number): SiteCapacity {
  const { plan, siteAllowance } = resolved(subscription);
  const remaining = Math.max(0, siteAllowance - sitesInUse);
  if (remaining > 0) return { allowed: true, allowance: siteAllowance, remaining, reason: null };
  return {
    allowed: false,
    allowance: siteAllowance,
    remaining: 0,
    reason: `${plan.displayName} includes ${siteAllowance} ${siteAllowance === 1 ? "site" : "sites"} and all of them are in use.`,
  };
}

/** The lowest subscription that includes a feature, for "included from" messages. */
export function lowestPlanWith(feature: FeatureCode): SubscriptionPlan | undefined {
  return subscriptionPlans.find((plan) => plan.features.includes(feature));
}

export type AccessDecision = { allowed: boolean; deniedBy: "subscription" | "role" | "site" | null; reason: string | null };

/**
 * Both gates, kept apart. The subscription decides whether the client has the feature at all. The caller supplies the result of
 * its own role rules and site scope, which this module does not know about. The answer says which gate refused.
 */
export function evaluateAccess(input: { subscription: SubscriptionInput; feature: FeatureCode; rolePermitted: boolean; siteAuthorised?: boolean }): AccessDecision {
  const { plan, features } = resolved(input.subscription);
  if (!features.includes(input.feature)) {
    const from = lowestPlanWith(input.feature);
    return { allowed: false, deniedBy: "subscription", reason: `${plan.displayName} does not include this${from ? `. It is included from ${from.displayName}` : ""}.` };
  }
  if (!input.rolePermitted) return { allowed: false, deniedBy: "role", reason: "Your role does not allow this." };
  if (input.siteAuthorised === false) return { allowed: false, deniedBy: "site", reason: "You are not authorised for this site." };
  return { allowed: true, deniedBy: null, reason: null };
}

export type SubscriptionChange = {
  from: SubscriptionId;
  to: SubscriptionId;
  direction: "same" | "upgrade" | "downgrade";
  gained: FeatureCode[];
  lost: FeatureCode[];
  siteAllowanceFrom: number;
  siteAllowanceTo: number;
  /** Set when the change cannot take effect yet, for example the client has more sites than the new subscription allows. */
  blockedBy: string | null;
};

/**
 * What changing a client's subscription does. Only entitlements and capacity change. The application and the database stay as they
 * are and no operational data is touched. A downgrade is blocked while the client uses more sites than the new subscription allows.
 */
export function describeChange(from: OrganisationSubscription, to: OrganisationSubscription, sitesInUse: number): SubscriptionChange {
  const before = resolveSubscription(from);
  const after = resolveSubscription(to);
  const order = (id: SubscriptionId) => subscriptionPlans.findIndex((plan) => plan.id === id);
  const direction = before.plan.id === after.plan.id ? (after.siteAllowance === before.siteAllowance ? "same" : after.siteAllowance > before.siteAllowance ? "upgrade" : "downgrade") : order(after.plan.id) > order(before.plan.id) ? "upgrade" : "downgrade";
  const had = new Set(before.plan.features);
  const has = new Set(after.plan.features);

  return {
    from: before.plan.id,
    to: after.plan.id,
    direction,
    gained: after.plan.features.filter((feature) => !had.has(feature)),
    lost: before.plan.features.filter((feature) => !has.has(feature)),
    siteAllowanceFrom: before.siteAllowance,
    siteAllowanceTo: after.siteAllowance,
    blockedBy:
      sitesInUse > after.siteAllowance
        ? `${after.plan.displayName} allows ${after.siteAllowance} ${after.siteAllowance === 1 ? "site" : "sites"} and the client uses ${sitesInUse}. Deactivate sites before the change takes effect.`
        : null,
  };
}

/** How a site allowance reads, for example "Up to 3 sites" or "Contracted". */
export function siteAllowanceLabel(plan: SubscriptionPlan): string {
  const allowance = plan.siteAllowance;
  if (allowance.kind === "contracted") return "Contracted";
  return allowance.sites === 1 ? "1 site" : `Up to ${allowance.sites} sites`;
}
