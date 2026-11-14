import {
  GROUP_MINIMUM_SITES,
  SubscriptionConfigError,
  canAddSite,
  describeChange,
  editionFeatures,
  evaluateAccess,
  findPlan,
  lowestPlanWith,
  planAllows,
  reportingAllows,
  resolveSubscription,
  subscriptionIds,
  subscriptionPlans,
  type SubscriptionId,
} from "@vesper/api-contracts";
import { describe, expect, it } from "vitest";

const group = { subscriptionId: "group" as const, contractedSites: 10 };
const sub = (subscriptionId: SubscriptionId) => ({ subscriptionId, contractedSites: subscriptionId === "group" ? 10 : null });

describe("the five subscriptions", () => {
  it("resolve, each with its own identifier, in commercial order", () => {
    expect(subscriptionIds).toEqual(["core", "operations_single", "operations", "enterprise", "group"]);
    for (const id of subscriptionIds) expect(resolveSubscription(sub(id)).plan.id).toBe(id);
    expect(subscriptionPlans).toHaveLength(5);
  });

  it("allow the agreed number of sites: Core 1, Operations Single Site 1, Operations 3, Enterprise 6", () => {
    expect(resolveSubscription(sub("core")).siteAllowance).toBe(1);
    expect(resolveSubscription(sub("operations_single")).siteAllowance).toBe(1);
    expect(resolveSubscription(sub("operations")).siteAllowance).toBe(3);
    expect(resolveSubscription(sub("enterprise")).siteAllowance).toBe(6);
  });

  it("need a valid contracted number of sites for Group, and are never unlimited by default", () => {
    expect(() => resolveSubscription({ subscriptionId: "group" })).toThrow(SubscriptionConfigError);
    expect(() => resolveSubscription({ subscriptionId: "group", contractedSites: null })).toThrow(/never unlimited/);
    expect(() => resolveSubscription({ subscriptionId: "group", contractedSites: 0 })).toThrow(SubscriptionConfigError);
    expect(() => resolveSubscription({ subscriptionId: "group", contractedSites: GROUP_MINIMUM_SITES - 1 })).toThrow(SubscriptionConfigError);
    expect(() => resolveSubscription({ subscriptionId: "group", contractedSites: 7.5 })).toThrow(SubscriptionConfigError);
    expect(resolveSubscription({ subscriptionId: "group", contractedSites: GROUP_MINIMUM_SITES }).siteAllowance).toBe(7);
    expect(resolveSubscription(group).siteAllowance).toBe(10);
  });

  it("refuse an unknown subscription, and a contracted number that contradicts a fixed allowance", () => {
    expect(() => resolveSubscription({ subscriptionId: "platinum" as SubscriptionId })).toThrow(/not a VESPER subscription/);
    expect(findPlan("platinum")).toBeUndefined();
    expect(() => resolveSubscription({ subscriptionId: "operations", contractedSites: 5 })).toThrow(/allows exactly 3/);
    expect(resolveSubscription({ subscriptionId: "operations", contractedSites: 3 }).siteAllowance).toBe(3);
  });

  it("make Operations - Single Site and Operations the same product, differing only in sites", () => {
    const single = findPlan("operations_single")!;
    const operations = findPlan("operations")!;
    expect(single.edition).toBe("operations");
    expect(operations.edition).toBe("operations");
    expect(single.features).toEqual(operations.features);
    expect(single.reporting).toBe(operations.reporting);
    expect(single.siteAllowance).not.toEqual(operations.siteAllowance);
  });

  it("have three editions, with Group as the Enterprise foundation plus its own entitlements", () => {
    expect(new Set(subscriptionPlans.map((plan) => plan.edition))).toEqual(new Set(["core", "operations", "enterprise"]));
    const enterprise = findPlan("enterprise")!;
    const groupPlan = findPlan("group")!;
    expect(groupPlan.edition).toBe("enterprise");
    for (const feature of enterprise.features) expect(groupPlan.features).toContain(feature);
    expect(groupPlan.features).toContain("group_dashboards");
    expect(enterprise.features).not.toContain("group_dashboards");
    for (const edition of ["core", "operations", "enterprise"] as const) expect(editionFeatures[edition].length).toBeGreaterThan(0);
  });

  it("all include VESPER Web and Mobile, and Core keeps its essential mobile field workflows", () => {
    for (const plan of subscriptionPlans) {
      expect(plan.webAccess, plan.id).toBe(true);
      expect(plan.mobileAccess, plan.id).toBe(true);
      expect(plan.features, plan.id).toContain("mobile_field_essential");
    }
    expect(planAllows(sub("core"), "mobile_field_essential")).toBe(true);
  });

  it("make Core operational visibility: overview, basic map, report and track issues, equipment visibility, tasks, basic shifts, essential mobile", () => {
    const core = findPlan("core")!.features;
    expect([...core].sort()).toEqual(["administration", "assigned_tasks", "equipment_visibility", "issue_tracking", "mobile_field_essential", "operational_map", "overview", "shift_basic"]);
    for (const feature of ["work_coordination", "shift_handover", "equipment_maintenance", "resource_readiness", "digital_inspections", "mobile_field_expanded"] as const) {
      expect(planAllows(sub("core"), feature), feature).toBe(false);
    }
  });

  it("make Operations operational coordination: everything in Core plus the six coordination capabilities", () => {
    const ops = findPlan("operations")!.features;
    for (const feature of findPlan("core")!.features) expect(ops).toContain(feature);
    const added = ops.filter((feature) => !findPlan("core")!.features.includes(feature)).sort();
    expect(added).toEqual(["digital_inspections", "equipment_maintenance", "mobile_field_expanded", "resource_readiness", "shift_handover", "work_coordination"]);
  });

  it("make Enterprise everything in Operations plus its five capabilities, and Group everything in Enterprise plus its four", () => {
    const enterprise = findPlan("enterprise")!.features;
    const group = findPlan("group")!.features;
    for (const feature of findPlan("operations")!.features) expect(enterprise).toContain(feature);
    expect(enterprise.filter((feature) => !findPlan("operations")!.features.includes(feature)).sort()).toEqual(["advanced_analytics", "contracted_integrations", "customer_configurations", "management_oversight", "multi_site_comparison"]);
    for (const feature of enterprise) expect(group).toContain(feature);
    expect(group.filter((feature) => !enterprise.includes(feature)).sort()).toEqual(["contracted_extensions", "cross_site_oversight", "group_administration", "group_dashboards"]);
  });
});

describe("reporting entitlements", () => {
  it("restrict advanced analytics to Enterprise and Group", () => {
    for (const id of ["core", "operations_single", "operations"] as const) {
      expect(planAllows(sub(id), "advanced_analytics"), id).toBe(false);
      expect(reportingAllows(sub(id), "advanced"), id).toBe(false);
    }
    for (const id of ["enterprise", "group"] as const) {
      expect(planAllows(sub(id), "advanced_analytics"), id).toBe(true);
      expect(reportingAllows(sub(id), "advanced"), id).toBe(true);
    }
  });

  it("order the levels, so a higher level includes the ones below it, and keep group-level reporting to Group", () => {
    expect(reportingAllows(sub("core"), "essential")).toBe(true);
    expect(reportingAllows(sub("core"), "operational")).toBe(false);
    expect(reportingAllows(sub("operations"), "operational")).toBe(true);
    expect(reportingAllows(sub("enterprise"), "group")).toBe(false);
    expect(reportingAllows(sub("group"), "group")).toBe(true);
    expect(planAllows(sub("group"), "group_dashboards")).toBe(true);
    expect(planAllows(sub("enterprise"), "group_dashboards")).toBe(false);
  });

  it("names the lowest subscription that includes a feature", () => {
    expect(lowestPlanWith("mobile_field_essential")?.id).toBe("core");
    expect(lowestPlanWith("mobile_field_expanded")?.id).toBe("operations_single");
    expect(lowestPlanWith("advanced_analytics")?.id).toBe("enterprise");
    expect(lowestPlanWith("group_dashboards")?.id).toBe("group");
    expect(lowestPlanWith("resource_readiness")?.id).toBe("operations_single");
  });
});

describe("Group licensed sites", () => {
  it("license a contracted maximum without requiring that many sites to be active", () => {
    const licensed = { subscriptionId: "group" as const, contractedSites: 10 };
    expect(canAddSite(licensed, 4)).toMatchObject({ allowed: true, allowance: 10, remaining: 6 });
    expect(canAddSite(licensed, 9).remaining).toBe(1);
  });

  it("enforce the licensed maximum, and never let the seven-site threshold stand in for it", () => {
    const licensed = { subscriptionId: "group" as const, contractedSites: 10 };
    expect(canAddSite(licensed, 10).allowed).toBe(false);
    expect(canAddSite(licensed, 10).reason).toMatch(/includes 10 sites/);
    expect(canAddSite({ subscriptionId: "group", contractedSites: 7 }, 7).allowed).toBe(false);
    expect(canAddSite({ subscriptionId: "group", contractedSites: 7 }, 3).remaining).toBe(4);
  });
});

describe("site capacity", () => {
  it("lets an organisation add a site only while it is under its allowance", () => {
    expect(canAddSite(sub("core"), 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(canAddSite(sub("core"), 1)).toMatchObject({ allowed: false, remaining: 0 });
    expect(canAddSite(sub("operations"), 2)).toMatchObject({ allowed: true, remaining: 1 });
    expect(canAddSite(sub("operations"), 3).reason).toMatch(/all of them are in use/);
    expect(canAddSite(sub("enterprise"), 6).allowed).toBe(false);
    expect(canAddSite(group, 9).allowed).toBe(true);
    expect(canAddSite(group, 10).allowed).toBe(false);
  });
});

describe("subscription entitlements and user permissions are separate gates", () => {
  const base = { subscription: sub("core"), rolePermitted: true };

  it("refuse on the subscription even when the role would allow it, and say so", () => {
    const decision = evaluateAccess({ ...base, feature: "advanced_analytics" });
    expect(decision).toMatchObject({ allowed: false, deniedBy: "subscription" });
    expect(decision.reason).toMatch(/included from VESPER Enterprise/);
  });

  it("refuse on the role even when the subscription includes the feature", () => {
    expect(evaluateAccess({ ...base, feature: "issue_tracking", rolePermitted: false })).toMatchObject({ allowed: false, deniedBy: "role" });
  });

  it("refuse on the site when the person is not authorised for it", () => {
    expect(evaluateAccess({ ...base, feature: "issue_tracking", siteAuthorised: false })).toMatchObject({ allowed: false, deniedBy: "site" });
  });

  it("allow only when every gate allows, and name no gate", () => {
    expect(evaluateAccess({ ...base, feature: "issue_tracking" })).toEqual({ allowed: true, deniedBy: null, reason: null });
  });

  it("do not let a generous role override a missing subscription feature", () => {
    expect(evaluateAccess({ subscription: sub("operations"), feature: "advanced_analytics", rolePermitted: true, siteAuthorised: true }).deniedBy).toBe("subscription");
  });
});

describe("subscription upgrades", () => {
  it("move Operations - Single Site to Operations by changing only the site capacity", () => {
    const change = describeChange(sub("operations_single"), sub("operations"), 1);
    expect(change).toMatchObject({ direction: "upgrade", siteAllowanceFrom: 1, siteAllowanceTo: 3, gained: [], lost: [], blockedBy: null });
  });

  it("move Core to Operations by adding the Operations capabilities", () => {
    const change = describeChange(sub("core"), sub("operations"), 1);
    expect(change.direction).toBe("upgrade");
    expect(change.gained.sort()).toEqual(["digital_inspections", "equipment_maintenance", "mobile_field_expanded", "resource_readiness", "shift_handover", "work_coordination"]);
    expect(change.lost).toEqual([]);
  });

  it("move Enterprise to Group by adding the Group configuration and the contracted capacity", () => {
    const change = describeChange(sub("enterprise"), group, 4);
    expect(change).toMatchObject({ direction: "upgrade", siteAllowanceFrom: 6, siteAllowanceTo: 10, blockedBy: null });
    expect(change.gained.sort()).toEqual(["contracted_extensions", "cross_site_oversight", "group_administration", "group_dashboards"]);
  });

  it("flag a downgrade, and block it while the client uses more sites than the new subscription allows", () => {
    const ok = describeChange(sub("operations"), sub("operations_single"), 1);
    expect(ok).toMatchObject({ direction: "downgrade", blockedBy: null });
    const blocked = describeChange(sub("operations"), sub("operations_single"), 2);
    expect(blocked.blockedBy).toMatch(/uses 2\. Deactivate sites/);
    expect(describeChange(sub("enterprise"), sub("operations"), 0).lost.sort()).toEqual(["advanced_analytics", "contracted_integrations", "customer_configurations", "management_oversight", "multi_site_comparison"]);
  });

  it("report no change for the same subscription and the same capacity", () => {
    expect(describeChange(group, group, 5).direction).toBe("same");
    expect(describeChange(group, { subscriptionId: "group", contractedSites: 12 }, 5).direction).toBe("upgrade");
  });
});
