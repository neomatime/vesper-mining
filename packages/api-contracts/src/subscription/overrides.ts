import { z } from "zod";
import { resolveSubscription, SubscriptionConfigError, type ResolvedSubscription } from "./entitlements";
import { featureCodeSchema, subscriptionIdSchema, type FeatureCode } from "./types";

/**
 * Client-specific entitlements, as configuration, so a client's agreement never means editing the application.
 *
 * One record per client organisation says which plan it has, how many sites it may use, any approved feature overrides, which
 * commercial agreement they come from, when they take effect, who approved them and what has happened to the record. An override
 * must be explicit, valid and traceable: no override without an agreement reference, approval and audit trail.
 *
 * The prototype uses mock records. In production these records are stored securely and **enforced by the backend**. A record
 * checked in the browser is not access control (PRD VES-BR-019).
 */

/** Features no override may switch off. Every subscription includes Web and Mobile. */
export const PROTECTED_FEATURES: readonly FeatureCode[] = ["mobile_field_essential"];

const slug = z.string().regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lower case letters, digits and hyphens only.");
const instant = z.string().datetime({ offset: true });

export const featureOverrideSchema = z
  .object({
    feature: featureCodeSchema,
    /** True grants a feature the plan does not include. False removes one it does. */
    enabled: z.boolean(),
    /** Why the agreement changes this feature. */
    reason: z.string().trim().min(5),
  })
  .strict();

export const entitlementApprovalSchema = z
  .object({
    approvedBy: z.string().trim().min(2),
    role: z.string().trim().min(2),
    approvedAt: instant,
  })
  .strict();

export const auditEntrySchema = z
  .object({
    at: instant,
    actor: z.string().trim().min(2),
    action: z.enum(["created", "approved", "amended", "revoked"]),
    detail: z.string().trim().min(3),
  })
  .strict();

export const clientEntitlementRecordSchema = z
  .object({
    organisationId: slug,
    subscriptionId: subscriptionIdSchema,
    /** Required for Group: the licensed maximum. Empty, or equal to the fixed allowance, for every other plan. */
    contractedSites: z.number().int().positive().nullable(),
    /** The commercial agreement this record comes from. */
    agreementReference: z.string().trim().min(3),
    /** The first day the record applies, as a date. */
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date such as 2026-03-01."),
    featureOverrides: z.array(featureOverrideSchema).default([]),
    approval: entitlementApprovalSchema,
    auditHistory: z.array(auditEntrySchema).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    let resolved: ResolvedSubscription | null = null;
    try {
      resolved = resolveSubscription({ subscriptionId: record.subscriptionId, contractedSites: record.contractedSites });
    } catch (error) {
      if (!(error instanceof SubscriptionConfigError)) throw error;
      context.addIssue({ code: "custom", path: ["contractedSites"], message: error.message });
    }

    const seen = new Set<FeatureCode>();
    record.featureOverrides.forEach((override, index) => {
      const path = ["featureOverrides", index, "feature"];
      if (seen.has(override.feature)) context.addIssue({ code: "custom", path, message: `${override.feature} is overridden more than once.` });
      seen.add(override.feature);
      if (!override.enabled && PROTECTED_FEATURES.includes(override.feature)) {
        context.addIssue({ code: "custom", path, message: `${override.feature} cannot be switched off. Every subscription includes it.` });
      }
      if (resolved) {
        const inPlan = resolved.plan.features.includes(override.feature);
        if (override.enabled && inPlan) context.addIssue({ code: "custom", path, message: `${override.feature} is already in the ${resolved.plan.displayName} plan. An override must change something.` });
        if (!override.enabled && !inPlan) context.addIssue({ code: "custom", path, message: `${override.feature} is not in the ${resolved.plan.displayName} plan, so there is nothing to remove.` });
      }
    });

    const times = record.auditHistory.map((entry) => Date.parse(entry.at));
    if (times.some((time, index) => index > 0 && time < times[index - 1]!)) {
      context.addIssue({ code: "custom", path: ["auditHistory"], message: "Audit entries must be in the order they happened." });
    }
    if (record.auditHistory[0]?.action !== "created") {
      context.addIssue({ code: "custom", path: ["auditHistory", 0, "action"], message: "The audit history must begin with the record being created." });
    }
    if (record.featureOverrides.length > 0 && !record.auditHistory.some((entry) => entry.action === "approved")) {
      context.addIssue({ code: "custom", path: ["auditHistory"], message: "A record with overrides needs an approval in its audit history." });
    }
    if (Date.parse(record.approval.approvedAt) > Date.parse(`${record.effectiveDate}T23:59:59+02:00`)) {
      context.addIssue({ code: "custom", path: ["approval", "approvedAt"], message: "The record must be approved on or before the day it takes effect." });
    }
  });

export type FeatureOverride = z.infer<typeof featureOverrideSchema>;
export type ClientEntitlementRecord = z.infer<typeof clientEntitlementRecordSchema>;
export type ClientEntitlementCheck = { ok: true; record: ClientEntitlementRecord } | { ok: false; errors: string[] };

/** Checks a record's shape and its rules between fields. */
export function validateClientEntitlementRecord(input: unknown): ClientEntitlementCheck {
  const parsed = clientEntitlementRecordSchema.safeParse(input);
  return parsed.success ? { ok: true, record: parsed.data } : { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`) };
}

/**
 * What a client has on a given day: the plan's features, changed by the record's overrides. Throws if the record is not valid or
 * does not yet apply. Callers that show a client a screen must handle that, never guess.
 */
export function resolveClientEntitlements(input: unknown, asOf: string): ResolvedSubscription {
  const checked = validateClientEntitlementRecord(input);
  if (!checked.ok) throw new SubscriptionConfigError(`The client entitlement record is not valid. ${checked.errors.join(" ")}`);
  const { record } = checked;
  if (asOf.slice(0, 10) < record.effectiveDate) {
    throw new SubscriptionConfigError(`This entitlement record takes effect on ${record.effectiveDate}, after ${asOf.slice(0, 10)}.`);
  }
  const base = resolveSubscription({ subscriptionId: record.subscriptionId, contractedSites: record.contractedSites });
  const granted = record.featureOverrides.filter((override) => override.enabled).map((override) => override.feature);
  const removed = new Set(record.featureOverrides.filter((override) => !override.enabled).map((override) => override.feature));
  const features = [...base.plan.features.filter((feature) => !removed.has(feature)), ...granted];
  return { ...base, features, appliedOverrides: record.featureOverrides.map(({ feature, enabled }) => ({ feature, enabled })) };
}
