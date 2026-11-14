import { describe, expect, it } from "vitest";
import { causeGroups, isSecondaryOf, primaryCauseIds, secondariesOf } from "@vesper/api-contracts";

describe("cause lists", () => {
  it("gives every primary cause its own, non-empty set of secondary causes, except Other", () => {
    for (const group of causeGroups) {
      if (group.id === "other") expect(group.secondary).toHaveLength(0);
      else expect(group.secondary.length, group.id).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps identifiers unique, so a stored cause is never ambiguous", () => {
    expect(new Set(primaryCauseIds).size).toBe(primaryCauseIds.length);
    for (const group of causeGroups) expect(new Set(group.secondary.map((item) => item.id)).size, group.id).toBe(group.secondary.length);
  });

  it("offers a primary cause only its own secondary causes", () => {
    expect(secondariesOf("hydraulic").map((item) => item.id)).toContain("hose_or_fitting_leak");
    expect(secondariesOf("hydraulic").map((item) => item.id)).not.toContain("feed_blockage");
    expect(isSecondaryOf("process_plant", "feed_blockage")).toBe(true);
    expect(isSecondaryOf("hydraulic", "feed_blockage")).toBe(false);
    expect(secondariesOf("nonsense")).toEqual([]);
  });
});
