// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROTECTED_FEATURES,
  SubscriptionConfigError,
  canAddSite,
  featureCatalogue,
  featureCodeSchema,
  findPlan,
  outstandingFeatures,
  planAllows,
  reportAllowed,
  resolveClientEntitlements,
  subscriptionPlans,
  validateClientEntitlementRecord,
} from "@vesper/api-contracts";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "..", "..");
/** The record is edited as loose JSON, so these tests can break it in ways its types would not allow. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>;
const example = JSON.parse(readFileSync(join(root, "deployment", "templates", "client-entitlements.example.json"), "utf8")) as Draft;
const make = (change: (draft: Draft) => void) => {
  const draft = structuredClone(example);
  change(draft);
  return draft;
};
const errors = (input: unknown) => {
  const result = validateClientEntitlementRecord(input);
  return result.ok ? [] : result.errors;
};
const mentions = (input: unknown, text: RegExp) => errors(input).some((message) => text.test(message));
const asOf = "2026-06-01T12:00:00+02:00";

describe("the feature catalogue", () => {
  it("describes every feature a plan can include, and no feature that does not exist", () => {
    for (const code of featureCodeSchema.options) expect(featureCatalogue[code], code).toBeDefined();
    expect(Object.keys(featureCatalogue).sort()).toEqual([...featureCodeSchema.options].sort());
    for (const plan of subscriptionPlans) for (const feature of plan.features) expect(featureCatalogue[feature], `${plan.id} ${feature}`).toBeDefined();
  });

  it("is honest about what is built: the outstanding list is exactly the intended capabilities that do not exist yet", () => {
    const notBuilt = outstandingFeatures().filter((code) => featureCatalogue[code].status === "not_built").sort();
    expect(notBuilt).toEqual(["contracted_integrations", "cross_site_oversight", "digital_inspections", "group_administration", "group_dashboards", "management_oversight", "mobile_field_expanded", "multi_site_comparison"]);
    expect(outstandingFeatures().filter((code) => featureCatalogue[code].status === "partial").sort()).toEqual(["advanced_analytics", "contracted_extensions", "customer_configurations"]);
  });

  it("only enforces features that are built, and enforces them only above Core", () => {
    const enforced = (Object.keys(featureCatalogue) as (keyof typeof featureCatalogue)[]).filter((code) => featureCatalogue[code].enforcement === "enforced");
    expect(enforced.sort()).toEqual(["advanced_analytics", "equipment_maintenance", "resource_readiness", "shift_handover"]);
    for (const code of enforced) {
      expect(featureCatalogue[code].status, code).not.toBe("not_built");
      expect(findPlan("core")!.features, code).not.toContain(code);
    }
  });

  it("leaves nothing in Core that is only configured, because Core is the baseline every workflow assumes", () => {
    for (const code of findPlan("core")!.features) expect(featureCatalogue[code].status, code).toBe("built");
  });
});

describe("a client entitlement record", () => {
  it("is the model for every client: the example validates", () => {
    const result = validateClientEntitlementRecord(example);
    expect(result.ok).toBe(true);
  });

  it("changes a client's entitlements with data alone, and not the plan for anyone else", () => {
    const resolved = resolveClientEntitlements(example, asOf);
    expect(planAllows(resolved, "advanced_analytics")).toBe(true);
    expect(reportAllowed(resolved, "advanced")).toBe(true);
    expect(resolved.appliedOverrides).toEqual([{ feature: "advanced_analytics", enabled: true }]);
    expect(findPlan("operations")!.features).not.toContain("advanced_analytics");
    // The same plan for a client with no override still lacks it.
    expect(planAllows({ subscriptionId: "operations" }, "advanced_analytics")).toBe(false);
  });

  it("can remove a feature the plan includes, with the same approval and audit trail", () => {
    const removal = make((d) => { d.featureOverrides = [{ feature: "digital_inspections", enabled: false, reason: "Excluded by the agreement until the mine's forms are supplied." }]; });
    const resolved = resolveClientEntitlements(removal, asOf);
    expect(planAllows(resolved, "digital_inspections")).toBe(false);
    expect(planAllows(resolved, "resource_readiness")).toBe(true);
  });

  it("applies only from its effective date", () => {
    expect(() => resolveClientEntitlements(example, "2026-02-28T23:00:00+02:00")).toThrow(/takes effect on 2026-03-01/);
    expect(resolveClientEntitlements(example, "2026-03-01T00:00:00+02:00").plan.id).toBe("operations");
  });

  it("refuses to resolve an invalid record, rather than guess", () => {
    expect(() => resolveClientEntitlements({ ...example, agreementReference: "" }, asOf)).toThrow(SubscriptionConfigError);
  });

  it("keeps a Group's licensed sites in the same record, and enforces them", () => {
    const group = make((d) => { d.subscriptionId = "group"; d.contractedSites = 10; d.featureOverrides = []; d.auditHistory = [d.auditHistory[0]]; });
    const resolved = resolveClientEntitlements(group, asOf);
    expect(resolved.siteAllowance).toBe(10);
    expect(canAddSite(resolved, 4).remaining).toBe(6);
    expect(canAddSite(resolved, 10).allowed).toBe(false);
    expect(mentions(make((d) => { d.subscriptionId = "group"; d.contractedSites = null; }), /never unlimited/)).toBe(true);
  });
});

describe("overrides must be explicit, validated and traceable", () => {
  it("need a commercial agreement reference, an effective date, approval details and an audit history", () => {
    for (const field of ["agreementReference", "effectiveDate", "approval", "auditHistory", "organisationId", "subscriptionId", "contractedSites"]) {
      expect(validateClientEntitlementRecord(make((d) => delete d[field])).ok, field).toBe(false);
    }
    expect(validateClientEntitlementRecord(make((d) => delete d.approval.approvedBy)).ok).toBe(false);
    expect(validateClientEntitlementRecord(make((d) => delete d.approval.approvedAt)).ok).toBe(false);
    expect(validateClientEntitlementRecord(make((d) => (d.auditHistory = []))).ok).toBe(false);
    expect(validateClientEntitlementRecord(make((d) => (d.effectiveDate = "March 2026"))).ok).toBe(false);
  });

  it("need a reason for every override", () => {
    expect(validateClientEntitlementRecord(make((d) => delete d.featureOverrides[0].reason)).ok).toBe(false);
    expect(validateClientEntitlementRecord(make((d) => (d.featureOverrides[0].reason = "ok"))).ok).toBe(false);
  });

  it("must change something: granting what the plan includes, or removing what it lacks, is refused", () => {
    expect(mentions(make((d) => (d.featureOverrides[0].feature = "resource_readiness")), /already in the VESPER Operations plan/)).toBe(true);
    expect(mentions(make((d) => { d.featureOverrides = [{ feature: "group_dashboards", enabled: false, reason: "Nothing to remove here." }]; }), /nothing to remove/)).toBe(true);
  });

  it("must name a real feature, and only once", () => {
    expect(validateClientEntitlementRecord(make((d) => (d.featureOverrides[0].feature = "free_everything"))).ok).toBe(false);
    expect(mentions(make((d) => (d.featureOverrides = [d.featureOverrides[0], d.featureOverrides[0]])), /more than once/)).toBe(true);
  });

  it("can never switch off what every subscription includes", () => {
    expect(PROTECTED_FEATURES).toContain("mobile_field_essential");
    expect(mentions(make((d) => { d.featureOverrides = [{ feature: "mobile_field_essential", enabled: false, reason: "Requested by the client." }]; }), /cannot be switched off/)).toBe(true);
  });

  it("need an audit history that starts with creation, runs in order and shows the approval", () => {
    expect(mentions(make((d) => (d.auditHistory[0].action = "approved")), /begin with the record being created/)).toBe(true);
    expect(mentions(make((d) => d.auditHistory.reverse()), /in the order they happened/)).toBe(true);
    expect(mentions(make((d) => (d.auditHistory = [d.auditHistory[0]])), /needs an approval in its audit history/)).toBe(true);
  });

  it("must be approved no later than the day they take effect", () => {
    expect(mentions(make((d) => (d.approval.approvedAt = "2026-04-01T10:00:00+02:00")), /approved on or before/)).toBe(true);
  });

  it("refuse unknown fields, so nothing untraceable can ride along", () => {
    expect(validateClientEntitlementRecord(make((d) => (d.secretBackdoor = true))).ok).toBe(false);
    expect(validateClientEntitlementRecord(make((d) => (d.featureOverrides[0].unlockedBy = "me"))).ok).toBe(false);
  });

  it("report each problem against the field it is about, so it can be traced and fixed", () => {
    const messages = errors(make((d) => { d.featureOverrides[0].feature = "resource_readiness"; d.agreementReference = ""; }));
    expect(messages.some((message) => message.startsWith("featureOverrides.0.feature:"))).toBe(true);
    expect(messages.some((message) => message.startsWith("agreementReference:"))).toBe(true);
  });
});
