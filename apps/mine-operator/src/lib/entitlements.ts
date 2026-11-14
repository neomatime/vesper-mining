import {
  canAddSite,
  describeChange,
  evaluateAccess,
  findPlan,
  lowestPlanWith,
  planAllows,
  reportingLevelLabels,
  resolveSubscription,
  siteAllowanceLabel,
  type DemoContext,
  type FeatureCode,
  type OrganisationSubscription,
} from "@vesper/api-contracts";

type Tier = DemoContext["tier"];

/**
 * What the prototype's interface asks about a subscription. The plans, the features and every rule live in
 * `@vesper/api-contracts` (subscription/). This file only turns the prototype's selected subscription into that shape and
 * answers in the words the screens use, so no component compares subscriptions itself.
 *
 * Demonstration entitlements (PRD BR-014 to BR-016). They shape the interface for user-experience validation only. Hiding a
 * control is not access control. Real enforcement belongs in future backend services (BR-019).
 */

/** The contracted number of sites used when the demonstration is set to Group. A real Group client has this in its agreement. */
export const DEMO_GROUP_CONTRACTED_SITES = 10;

/** The prototype has one mining site. Real multi-site management arrives with the production backend. */
export const PROTOTYPE_SITES_IN_USE = 1;

/** The stored form of a demonstration subscription: deterministic, so every run behaves the same. */
export function demoSubscription(tier: Tier): OrganisationSubscription {
  return { subscriptionId: tier, contractedSites: tier === "group" ? DEMO_GROUP_CONTRACTED_SITES : null };
}

export function entitlementsFor(tier: Tier) {
  const subscription = resolveSubscription(demoSubscription(tier));
  const { plan, siteAllowance } = subscription;
  return {
    label: plan.label,
    displayName: plan.displayName,
    edition: plan.edition,
    sites: plan.siteAllowance.kind === "contracted" ? `${siteAllowance} sites (contracted)` : siteAllowanceLabel(plan),
    siteAllowance,
    mobile: planAllows(subscription, "mobile_field_essential"),
    reporting: reportingLevelLabels[plan.reporting],
    advancedAnalytics: planAllows(subscription, "advanced_analytics"),
  };
}

/** Whether the demonstration subscription includes a feature. */
export function can(tier: Tier, feature: FeatureCode) {
  return planAllows(resolveSubscription(demoSubscription(tier)), feature);
}

/** Whether the subscription allows another site, given how many the prototype has. */
export function siteCapacity(tier: Tier, sitesInUse = PROTOTYPE_SITES_IN_USE) {
  return canAddSite(demoSubscription(tier), sitesInUse);
}

/** Both gates, kept apart: the subscription, then the role and site rules the caller supplies. */
export function accessFor(tier: Tier, feature: FeatureCode, rolePermitted: boolean, siteAuthorised = true) {
  return evaluateAccess({ subscription: demoSubscription(tier), feature, rolePermitted, siteAuthorised });
}

/** What moving from one subscription to another would do. Only entitlements and capacity change. */
export function changeSubscription(from: Tier, to: Tier, sitesInUse = PROTOTYPE_SITES_IN_USE) {
  return describeChange(demoSubscription(from), demoSubscription(to), sitesInUse);
}

const capabilityFeature = { mobile: "mobile_field_essential", advancedAnalytics: "advanced_analytics" } as const satisfies Record<string, FeatureCode>;

/** The lowest subscription that includes a capability, for "upgrade" messaging. */
export function tierThatIncludes(capability: keyof typeof capabilityFeature) {
  return lowestPlanWith(capabilityFeature[capability])?.label ?? "a higher subscription";
}

export const entitlementRows: { label: string; read: (tier: Tier) => string }[] = [
  { label: "Sites", read: (tier) => entitlementsFor(tier).sites },
  { label: "VESPER Mobile", read: (tier) => (entitlementsFor(tier).mobile ? "Included" : "Not included") },
  { label: "Reporting", read: (tier) => entitlementsFor(tier).reporting },
  { label: "Advanced analytics", read: (tier) => (entitlementsFor(tier).advancedAnalytics ? "Included" : "Not included") },
];

/** A subscription's plan record, for screens that need more than the summary. */
export const planFor = (tier: Tier) => findPlan(tier);
