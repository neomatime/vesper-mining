import { z } from "zod";

/**
 * The shapes of the subscription configuration. VESPER is one product with five commercial subscriptions and three
 * functional editions. This file only describes shapes. The five plans are in plans.ts and the checks are in entitlements.ts.
 */

/** The five commercial subscriptions. The identifiers are stable: they are stored with a client and used in deployment manifests. */
export const subscriptionIdSchema = z.enum(["core", "operations_single", "operations", "enterprise", "group"]);

/** The three functional editions. Group has no edition of its own: it is the Enterprise foundation plus the Group entitlements. */
export const editionSchema = z.enum(["core", "operations", "enterprise"]);

/** Ordered from least to most. A subscription with a level also has every level below it. */
export const reportingLevelSchema = z.enum(["essential", "operational", "advanced", "group"]);

/**
 * Stable feature codes, grouped by the edition that introduces them. They name what a client may use, not how the interface is laid out, so the same code serves the
 * navigation, a workflow check and (later) the backend. A conceptual feature table in the backend schema keys on these.
 */
export const featureCodeSchema = z.enum([
  // Core: operational visibility
  "overview",
  "operational_map",
  "issue_tracking",
  "equipment_visibility",
  "assigned_tasks",
  "shift_basic",
  "administration",
  "mobile_field_essential",
  // Operations: operational coordination
  "work_coordination",
  "shift_handover",
  "equipment_maintenance",
  "resource_readiness",
  "digital_inspections",
  "mobile_field_expanded",
  // Enterprise
  "advanced_analytics",
  "multi_site_comparison",
  "management_oversight",
  "contracted_integrations",
  "customer_configurations",
  // Group
  "group_dashboards",
  "cross_site_oversight",
  "group_administration",
  "contracted_extensions",
]);

/** A fixed allowance (Core, Operations, Enterprise) or one set by the client's agreement (Group). Group is never unlimited by default. */
export const siteAllowanceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), sites: z.number().int().positive() }),
  z.object({ kind: z.literal("contracted"), minimumSites: z.number().int().positive() }),
]);

export const subscriptionPlanSchema = z.object({
  id: subscriptionIdSchema,
  displayName: z.string().min(1),
  /** The short name used inside the interface. */
  label: z.string().min(1),
  edition: editionSchema,
  siteAllowance: siteAllowanceSchema,
  reporting: reportingLevelSchema,
  /** Every subscription includes VESPER Web and VESPER Mobile. A plan without either is not a valid plan. */
  webAccess: z.literal(true),
  mobileAccess: z.literal(true),
  features: z.array(featureCodeSchema).min(1),
  /** Plain-language restrictions that belong to this subscription, for the documents and the plan screen. */
  restrictions: z.array(z.string()),
});

/** What is stored for a client organisation: which subscription, and for Group the contracted number of sites. */
export const organisationSubscriptionSchema = z.object({
  subscriptionId: subscriptionIdSchema,
  contractedSites: z.number().int().positive().nullish(),
});

export type SubscriptionId = z.infer<typeof subscriptionIdSchema>;
export type Edition = z.infer<typeof editionSchema>;
export type ReportingLevel = z.infer<typeof reportingLevelSchema>;
export type FeatureCode = z.infer<typeof featureCodeSchema>;
export type SiteAllowance = z.infer<typeof siteAllowanceSchema>;
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
export type OrganisationSubscription = z.infer<typeof organisationSubscriptionSchema>;
