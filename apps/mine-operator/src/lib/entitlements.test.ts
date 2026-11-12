import { describe, expect, it } from "vitest";
import { entitlementsFor, tierThatIncludes } from "./entitlements";

describe("entitlements", () => {
  it("keeps VESPER Mobile out of Core and in every Operations tier and above", () => {
    expect(entitlementsFor("core").mobile).toBe(false);
    for (const tier of ["operations_single", "operations", "enterprise", "group"] as const) {
      expect(entitlementsFor(tier).mobile).toBe(true);
    }
  });

  it("restricts advanced analytics to Enterprise and Group", () => {
    expect(entitlementsFor("operations").advancedAnalytics).toBe(false);
    expect(entitlementsFor("enterprise").advancedAnalytics).toBe(true);
    expect(entitlementsFor("group").advancedAnalytics).toBe(true);
  });

  it("names the lowest tier that unlocks a capability", () => {
    expect(tierThatIncludes("mobile")).toBe("Operations — Single Site");
    expect(tierThatIncludes("advancedAnalytics")).toBe("Enterprise");
  });
});
