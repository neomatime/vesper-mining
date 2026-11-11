import { describe, expect, it } from "vitest";
import type { ReadinessActivity } from "@vesper/api-contracts";
import { deriveReadinessStatus, indicativeOrderBy, partPosition } from "./readiness-rules";

type Part = ReadinessActivity["parts"][number];

const part = (overrides: Partial<Part>): Part => ({
  id: "p",
  name: "Part",
  required: 2,
  onHand: 2,
  reserved: 0,
  inbound: 0,
  leadTimeDays: 14,
  quality: "verified",
  confirmedBy: null,
  confirmedAt: null,
  sourceNote: null,
  ...overrides,
});

describe("partPosition", () => {
  it("treats unknown stock as unknown, never zero", () => {
    expect(partPosition(part({ onHand: null, reserved: null }))).toBe("unknown");
  });

  it("separates short, inbound-dependent and covered positions", () => {
    expect(partPosition(part({ onHand: 1, reserved: 1, inbound: 0 }))).toBe("short");
    expect(partPosition(part({ onHand: 1, reserved: 0, inbound: 1 }))).toBe("needs_inbound");
    expect(partPosition(part({ onHand: 3, reserved: 1 }))).toBe("covered");
  });
});

describe("deriveReadinessStatus", () => {
  it("reports a shortage over an unknown part", () => {
    expect(deriveReadinessStatus([part({ onHand: 1, reserved: 1 }), part({ onHand: null, reserved: null })])).toBe("potential_shortage");
  });

  it("asks for confirmation when stock is unknown", () => {
    expect(deriveReadinessStatus([part({}), part({ onHand: null, reserved: null })])).toBe("needs_confirmation");
  });

  it("does not become ready on reported figures alone", () => {
    expect(deriveReadinessStatus([part({ quality: "reported" })])).toBe("needs_confirmation");
    expect(deriveReadinessStatus([part({ quality: "verified" })])).toBe("ready");
  });

  it("flags inbound supply for review", () => {
    expect(deriveReadinessStatus([part({ onHand: 1, reserved: 0, inbound: 1 })])).toBe("review_inbound");
  });
});

describe("indicativeOrderBy", () => {
  it("subtracts the longest lead time and buffer from the need date", () => {
    const result = indicativeOrderBy("2025-05-14T06:00:00+02:00", [part({ onHand: 1, reserved: 1, leadTimeDays: 14 })]);
    expect(result?.slice(0, 10)).toBe("2025-04-27");
  });

  it("returns null when nothing needs ordering or lead times are unknown", () => {
    expect(indicativeOrderBy("2025-05-14T06:00:00+02:00", [part({})])).toBeNull();
    expect(indicativeOrderBy("2025-05-14T06:00:00+02:00", [part({ onHand: 0, reserved: 0, leadTimeDays: null })])).toBeNull();
  });
});
