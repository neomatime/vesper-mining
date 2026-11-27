// @vitest-environment node

/**
 * Unit tests (Vitest). The app's subscription reader: features, reports by level, site capacity and the mock client records.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_GROUP_CONTRACTED_SITES, accessFor, can, canSeeReport, changeSubscription, demoEntitlementRecord, demoSubscription, entitlementRows, entitlementsFor, siteCapacity, tierThatIncludes } from "./entitlements";
import { demoDomain } from "./demo-store";
import { tiers } from "./personas";
import { reportCatalogue } from "./reports";
import { validateClientEntitlementRecord } from "@vesper/api-contracts";

const everyTier = ["core", "operations_single", "operations", "enterprise", "group"] as const;

describe("entitlements as the screens see them", () => {
  it("include VESPER Mobile in every subscription, Core included (PRD VES-BR-014 and VES-BR-015)", () => {
    for (const tier of everyTier) expect(entitlementsFor(tier).mobile, tier).toBe(true);
  });

  it("restrict advanced analytics to Enterprise and Group", () => {
    expect(entitlementsFor("core").advancedAnalytics).toBe(false);
    expect(entitlementsFor("operations").advancedAnalytics).toBe(false);
    expect(entitlementsFor("enterprise").advancedAnalytics).toBe(true);
    expect(entitlementsFor("group").advancedAnalytics).toBe(true);
  });

  it("names the lowest subscription that includes a capability", () => {
    expect(tierThatIncludes("mobile")).toBe("Core");
    expect(tierThatIncludes("advancedAnalytics")).toBe("Enterprise");
  });

  it("describe the site allowance in the words the screens use, with Group coming from its contract", () => {
    expect(entitlementsFor("core").sites).toBe("1 site");
    expect(entitlementsFor("operations_single").sites).toBe("1 site");
    expect(entitlementsFor("operations").sites).toBe("Up to 3 sites");
    expect(entitlementsFor("enterprise").sites).toBe("Up to 6 sites");
    expect(entitlementsFor("group").sites).toBe(`${DEMO_GROUP_CONTRACTED_SITES} sites (licensed)`);
    expect(demoSubscription("group").contractedSites).toBe(DEMO_GROUP_CONTRACTED_SITES);
    expect(demoSubscription("core").contractedSites).toBeNull();
  });

  it("keep Operations - Single Site and Operations the same product with a different site count", () => {
    const single = entitlementsFor("operations_single");
    const operations = entitlementsFor("operations");
    expect({ ...single, label: "", displayName: "", sites: "", siteAllowance: 0 }).toEqual({ ...operations, label: "", displayName: "", sites: "", siteAllowance: 0 });
    expect(single.siteAllowance).toBe(1);
    expect(operations.siteAllowance).toBe(3);
  });

  it("let the interface read one feature across subscriptions, without comparing subscriptions itself", () => {
    expect(can("core", "issue_tracking")).toBe(true);
    expect(can("core", "resource_readiness")).toBe(false);
    expect(can("operations_single", "resource_readiness")).toBe(true);
    expect(can("core", "advanced_analytics")).toBe(false);
    expect(can("group", "group_dashboards")).toBe(true);
    expect(entitlementRows.find((row) => row.label === "VESPER Mobile")?.read("core")).toBe("Included");
    expect(entitlementRows.find((row) => row.label === "Advanced analytics")?.read("operations")).toBe("Not included");
  });

  it("build the launcher's list from the central plans, so the two cannot disagree", () => {
    expect(tiers.map((tier) => tier.value)).toEqual([...everyTier]);
    for (const tier of tiers) {
      expect(tier.mobile).toBe(entitlementsFor(tier.value).mobile);
      expect(tier.advancedAnalytics).toBe(entitlementsFor(tier.value).advancedAnalytics);
    }
  });
});

describe("reports by level", () => {
  it("show Core the essential reports, Operations the operational ones, and only Enterprise and Group the advanced ones", () => {
    expect(canSeeReport("core", "essential")).toBe(true);
    expect(canSeeReport("core", "operational")).toBe(false);
    expect(canSeeReport("operations_single", "operational")).toBe(true);
    expect(canSeeReport("operations", "advanced")).toBe(false);
    expect(canSeeReport("enterprise", "advanced")).toBe(true);
    expect(canSeeReport("group", "advanced")).toBe(true);
  });

  it("give every report a level, so no report escapes the entitlement rules", () => {
    const levels = Object.fromEntries(reportCatalogue.map((report) => [report.key, report.level]));
    expect(levels).toEqual({ "production-vs-plan": "essential", "operational-exceptions": "essential", "equipment-delay-stages": "operational", "resource-readiness": "operational", "recurring-causes": "operational", "delay-analytics": "advanced" });
    expect(reportCatalogue.filter((report) => report.advanced).map((report) => report.key)).toEqual(["delay-analytics"]);
  });
});

describe("the demonstration's mock entitlement records", () => {
  it("are complete valid records, one per subscription, with no feature overrides", () => {
    for (const tier of everyTier) {
      const record = demoEntitlementRecord(tier);
      expect(validateClientEntitlementRecord(record).ok, tier).toBe(true);
      expect(record.featureOverrides, tier).toEqual([]);
      expect(record.agreementReference).toMatch(/^DEMO-AGREEMENT-/);
      expect(record.auditHistory[0]?.action).toBe("created");
    }
  });
});

describe("site capacity in the prototype", () => {
  it("shows room for another site only where the allowance has it", () => {
    expect(siteCapacity("core").allowed).toBe(false);
    expect(siteCapacity("operations_single").allowed).toBe(false);
    expect(siteCapacity("operations").allowed).toBe(true);
    expect(siteCapacity("operations").remaining).toBe(2);
    expect(siteCapacity("group").remaining).toBe(DEMO_GROUP_CONTRACTED_SITES - 1);
  });
});

describe("subscription entitlements and user permissions", () => {
  it("stay separate: either gate can refuse, and the answer says which", () => {
    expect(accessFor("core", "advanced_analytics", true).deniedBy).toBe("subscription");
    expect(accessFor("enterprise", "advanced_analytics", false).deniedBy).toBe("role");
    expect(accessFor("enterprise", "advanced_analytics", true, false).deniedBy).toBe("site");
    expect(accessFor("enterprise", "advanced_analytics", true).allowed).toBe(true);
  });
});

describe("switching the subscription in the prototype", () => {
  beforeEach(() => demoDomain.reset());

  it("changes only what the plan allows, and leaves every operational record as it was", () => {
    const before = JSON.stringify({ issues: demoDomain.listIssues(), equipment: demoDomain.listEquipment(), shifts: demoDomain.listShifts() });
    for (const [from, to] of [["operations_single", "operations"], ["core", "operations"], ["enterprise", "group"], ["group", "core"]] as const) {
      expect(changeSubscription(from, to).from).toBe(from);
    }
    // Records belong to the organisation's data, not to the subscription, so a subscription change cannot reach them.
    const after = JSON.stringify({ issues: demoDomain.listIssues(), equipment: demoDomain.listEquipment(), shifts: demoDomain.listShifts() });
    expect(after).toBe(before);
  });

  it("describes the upgrades that matter, from the same rules the plans use", () => {
    expect(changeSubscription("operations_single", "operations")).toMatchObject({ direction: "upgrade", siteAllowanceFrom: 1, siteAllowanceTo: 3 });
    expect(changeSubscription("core", "operations").gained).toEqual(expect.arrayContaining(["resource_readiness", "shift_handover", "equipment_maintenance"]));
    expect(changeSubscription("enterprise", "group")).toMatchObject({ direction: "upgrade", siteAllowanceTo: DEMO_GROUP_CONTRACTED_SITES });
  });
});
