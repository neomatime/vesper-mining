import { describe, expect, it } from "vitest";
import { personaByName, personas, tierLabel, tiers } from "./personas";

describe("personas", () => {
  it("covers every demo role used by the launcher", () => {
    expect(personas.map((persona) => persona.role)).toContain("Field Employee");
    expect(personas.filter((persona) => persona.fieldOnly)).toHaveLength(1);
  });

  it("finds a persona by name", () => {
    expect(personaByName("Amina Patel")?.role).toBe("Shift Supervisor");
    expect(personaByName("Nobody")).toBeUndefined();
  });

  it("labels every subscription tier and keeps Core without mobile", () => {
    expect(tierLabel("operations_single")).toBe("Operations — Single Site");
    expect(tiers.find((tier) => tier.value === "core")?.mobile).toBe(false);
    expect(tiers.filter((tier) => tier.value !== "core").every((tier) => tier.mobile)).toBe(true);
  });
});
