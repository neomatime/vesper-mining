import type { Edition, FeatureCode, ReportingLevel, SubscriptionId, SubscriptionPlan } from "./types";
import { subscriptionPlanSchema } from "./types";

/**
 * The five subscriptions as data. Everything else asks this file what a plan includes, so a commercial change is made once.
 *
 * The editions, as the product owner defined them (14 November 2026):
 *   Core        operational visibility: overview, basic map, report and track issues, essential equipment visibility,
 *               assigned tasks, basic shift information, essential reporting, essential mobile
 *   Operations  operational coordination: Core, plus advanced work and exception coordination, detailed handovers, downtime and
 *               maintenance coordination, Resource Readiness, digital inspections, detailed reporting, expanded mobile
 *   Enterprise  Operations, plus advanced analytics, multi-site comparison, management oversight, contracted integrations and
 *               approved customer configurations
 *   Group       Enterprise, plus group dashboards, cross-site oversight, group administration and contracted extensions
 *
 * These are the intended entitlements. Not all of them are built: features.ts records which exist. Nothing was built to
 * tell the editions apart. Operations - Single Site and Operations are identical apart from the site allowance.
 */

const CORE_FEATURES: FeatureCode[] = [
  "overview",
  "operational_map",
  "issue_tracking",
  "equipment_visibility",
  "assigned_tasks",
  "shift_basic",
  "administration",
  "mobile_field_essential",
];

const OPERATIONS_FEATURES: FeatureCode[] = [
  ...CORE_FEATURES,
  "work_coordination",
  "shift_handover",
  "equipment_maintenance",
  "resource_readiness",
  "digital_inspections",
  "mobile_field_expanded",
];

const ENTERPRISE_FEATURES: FeatureCode[] = [
  ...OPERATIONS_FEATURES,
  "advanced_analytics",
  "multi_site_comparison",
  "management_oversight",
  "contracted_integrations",
  "customer_configurations",
];

/** What Group adds to the Enterprise foundation. */
const GROUP_FEATURES: FeatureCode[] = ["group_dashboards", "cross_site_oversight", "group_administration", "contracted_extensions"];

/** What each edition includes. One list per edition, so plans of the same edition cannot drift apart. */
export const editionFeatures: Record<Edition, readonly FeatureCode[]> = {
  core: CORE_FEATURES,
  operations: OPERATIONS_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

/**
 * The fewest sites a Group agreement can license. Six or fewer is Enterprise (PRD section 11.1). This is a commercial licensing
 * threshold, not a requirement that seven sites are active: a Group client may license 10 and activate 4. The licensed maximum is enforced.
 */
export const GROUP_MINIMUM_SITES = 7;

type PlanInput = Omit<SubscriptionPlan, "features" | "webAccess" | "mobileAccess"> & { extraFeatures?: FeatureCode[] };

function plan({ extraFeatures = [], ...rest }: PlanInput): SubscriptionPlan {
  return subscriptionPlanSchema.parse({
    ...rest,
    webAccess: true,
    mobileAccess: true,
    features: [...editionFeatures[rest.edition], ...extraFeatures],
  });
}

/** In commercial order, lowest first. */
export const subscriptionPlans: readonly SubscriptionPlan[] = [
  plan({
    id: "core",
    displayName: "VESPER Core",
    label: "Core",
    edition: "core",
    siteAllowance: { kind: "fixed", sites: 1 },
    reporting: "essential",
    restrictions: ["One mining site.", "Operational visibility. Operations capabilities need an Operations subscription."],
  }),
  plan({
    id: "operations_single",
    displayName: "VESPER Operations – Single Site",
    label: "Operations — Single Site",
    edition: "operations",
    siteAllowance: { kind: "fixed", sites: 1 },
    reporting: "operational",
    restrictions: ["One mining site. Functionally identical to Operations; only the site allowance differs."],
  }),
  plan({
    id: "operations",
    displayName: "VESPER Operations",
    label: "Operations",
    edition: "operations",
    siteAllowance: { kind: "fixed", sites: 3 },
    reporting: "operational",
    restrictions: ["Up to three mining sites."],
  }),
  plan({
    id: "enterprise",
    displayName: "VESPER Enterprise",
    label: "Enterprise",
    edition: "enterprise",
    siteAllowance: { kind: "fixed", sites: 6 },
    reporting: "advanced",
    restrictions: ["Up to six mining sites."],
  }),
  plan({
    id: "group",
    displayName: "VESPER Group",
    label: "Group",
    edition: "enterprise",
    siteAllowance: { kind: "contracted", minimumSites: GROUP_MINIMUM_SITES },
    reporting: "group",
    extraFeatures: GROUP_FEATURES,
    restrictions: [
      "Licenses at least 7 sites. The maximum is set by the client agreement, must be configured explicitly and is enforced. It is never unlimited by default.",
      "The client may activate fewer sites than it licenses.",
      "Customer-specific tailoring applies only where the agreement requires it.",
    ],
  }),
];

const byId = new Map<SubscriptionId, SubscriptionPlan>(subscriptionPlans.map((item) => [item.id, item]));

export const subscriptionIds = subscriptionPlans.map((item) => item.id) as [SubscriptionId, ...SubscriptionId[]];

/** The plan for an identifier, or undefined if it is not one of the five. */
export function findPlan(id: string): SubscriptionPlan | undefined {
  return byId.get(id as SubscriptionId);
}

/** How a reporting level reads in the interface. */
export const reportingLevelLabels: Record<ReportingLevel, string> = {
  essential: "Essential",
  operational: "Operational",
  advanced: "Advanced",
  group: "Group-level",
};

/** The order of reporting levels, lowest first. */
export const reportingLevelOrder: readonly ReportingLevel[] = ["essential", "operational", "advanced", "group"];
