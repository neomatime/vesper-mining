import {
  canAddSite,
  describeChange,
  evaluateAccess,
  featureCatalogue,
  findPlan,
  lowestPlanWith,
  planAllows,
  reportAllowed,
  reportingLevelLabels,
  resolveClientEntitlements,
  siteAllowanceLabel,
  type ClientEntitlementRecord,
  type DemoContext,
  type FeatureCode,
  type OrganisationSubscription,
  type ReportingLevel,
} from "@vesper/api-contracts";
import { DEMO_NOW } from "./demo-data";

type Tier = DemoContext["tier"];

/**
 * What the prototype's interface asks about a subscription. The plans, the features, the client entitlement records and every
 * rule live in `@vesper/api-contracts` (subscription/). This file only supplies the prototype's mock record for the selected
 * subscription and answers in the words the screens use, so no component compares subscriptions itself.
 *
 * Demonstration entitlements (PRD BR-014 to BR-019). They shape the interface for user-experience validation only. Hiding a
 * control is not access control. Real enforcement belongs in future backend services, and real client records are stored securely.
 */

/** The licensed number of sites used when the demonstration is set to Group. A real Group client has this in its agreement. */
export const DEMO_GROUP_CONTRACTED_SITES = 10;

/** The prototype has one mining site. Real multi-site management arrives with the production backend. */
export const PROTOTYPE_SITES_IN_USE = 1;

/**
 * The mock client entitlement record for a subscription: deterministic, so every run behaves the same. It is a complete, valid
 * record with no feature overrides. Real overrides are written into a client's record, never into this source.
 */
export function demoEntitlementRecord(tier: Tier): ClientEntitlementRecord {
  return {
    organisationId: "org-himark-demo",
    subscriptionId: tier,
    contractedSites: tier === "group" ? DEMO_GROUP_CONTRACTED_SITES : null,
    agreementReference: `DEMO-AGREEMENT-${tier.toUpperCase().replace(/_/g, "-")}`,
    effectiveDate: "2025-01-01",
    featureOverrides: [],
    approval: { approvedBy: "HIMARK Commercial (mock)", role: "Commercial lead", approvedAt: "2024-12-15T09:00:00+02:00" },
    auditHistory: [
      { at: "2024-12-10T09:00:00+02:00", actor: "HIMARK Commercial", action: "created", detail: "Subscription recorded." },
      { at: "2024-12-15T09:00:00+02:00", actor: "HIMARK Commercial", action: "approved", detail: "Subscription approved." },
    ],
  };
}

/** The stored form of a demonstration subscription. */
export function demoSubscription(tier: Tier): OrganisationSubscription {
  const record = demoEntitlementRecord(tier);
  return { subscriptionId: record.subscriptionId, contractedSites: record.contractedSites };
}

/** The demonstration client's entitlements for a subscription, from its mock record on the demonstration date. */
export const resolvedFor = (tier: Tier) => resolveClientEntitlements(demoEntitlementRecord(tier), DEMO_NOW);

export function entitlementsFor(tier: Tier) {
  const resolved = resolvedFor(tier);
  const { plan, siteAllowance } = resolved;
  return {
    label: plan.label,
    displayName: plan.displayName,
    edition: plan.edition,
    sites: plan.siteAllowance.kind === "contracted" ? `${siteAllowance} sites (licensed)` : siteAllowanceLabel(plan),
    siteAllowance,
    mobile: planAllows(resolved, "mobile_field_essential"),
    reporting: reportingLevelLabels[plan.reporting],
    advancedAnalytics: planAllows(resolved, "advanced_analytics"),
  };
}

/** Whether the demonstration subscription includes a feature. */
export function can(tier: Tier, feature: FeatureCode) {
  return planAllows(resolvedFor(tier), feature);
}

/** Whether a report at this level may be seen. */
export function canSeeReport(tier: Tier, level: ReportingLevel) {
  return reportAllowed(resolvedFor(tier), level);
}

/** Whether the subscription allows another site, given how many the prototype has. */
export function siteCapacity(tier: Tier, sitesInUse = PROTOTYPE_SITES_IN_USE) {
  return canAddSite(resolvedFor(tier), sitesInUse);
}

/** Both gates, kept apart: the subscription, then the role and site rules the caller supplies. */
export function accessFor(tier: Tier, feature: FeatureCode, rolePermitted: boolean, siteAuthorised = true) {
  return evaluateAccess({ subscription: resolvedFor(tier), feature, rolePermitted, siteAuthorised });
}

/** What moving from one subscription to another would do. Only entitlements and capacity change. */
export function changeSubscription(from: Tier, to: Tier, sitesInUse = PROTOTYPE_SITES_IN_USE) {
  return describeChange(demoSubscription(from), demoSubscription(to), sitesInUse);
}

/** A feature's name and the lowest subscription that includes it, for "included from" messages. */
export function featureAvailability(feature: FeatureCode) {
  return { info: featureCatalogue[feature], includedFrom: lowestPlanWith(feature)?.displayName ?? "a higher subscription" };
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
  { label: "Resource Readiness", read: (tier) => (can(tier, "resource_readiness") ? "Included" : "Not included") },
];

/** A subscription's plan record, for screens that need more than the summary. */
export const planFor = (tier: Tier) => findPlan(tier);
