import type { Edition, FeatureCode, ReportingLevel, SubscriptionId, SubscriptionPlan } from "./types";
import { subscriptionPlanSchema } from "./types";

/**
 * The five subscriptions as data. Everything else asks this file what a plan includes, so a commercial change is made once.
 *
 * What the editions add to each other:
 *   Core        the essential product: every workspace and the essential mobile field workflows
 *   Operations  Core, plus the expanded field workflows (PRD VES-BR-015)
 *   Enterprise  Operations, plus advanced analytics (PRD VES-BR-016)
 *   Group       Enterprise, plus group-level reporting, with a contracted number of sites
 *
 * Core and Operations are the same in the current prototype apart from the expanded field workflows, which are not built yet.
 * Where Core ends and Operations begins is an open commercial decision, so nothing has been restricted to keep them apart.
 */

const CORE_FEATURES: FeatureCode[] = [
  "overview",
  "operational_map",
  "work_exceptions",
  "equipment_maintenance",
  "resource_readiness",
  "shift_control",
  "reports",
  "administration",
  "mobile_field_essential",
];

const OPERATIONS_FEATURES: FeatureCode[] = [...CORE_FEATURES, "mobile_field_expanded"];
const ENTERPRISE_FEATURES: FeatureCode[] = [...OPERATIONS_FEATURES, "advanced_analytics"];

/** What each edition includes. One list per edition, so plans of the same edition cannot drift apart. */
export const editionFeatures: Record<Edition, readonly FeatureCode[]> = {
  core: CORE_FEATURES,
  operations: OPERATIONS_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

/** The fewest sites a Group agreement can cover. Six or fewer is Enterprise (PRD section 11.1, provisional). */
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
    restrictions: ["One mining site."],
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
    extraFeatures: ["group_reporting"],
    restrictions: [
      "The number of sites is set by the client agreement and must be configured explicitly. It is never unlimited by default.",
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
