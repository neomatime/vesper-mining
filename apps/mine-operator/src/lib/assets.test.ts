// @vitest-environment node

/**
 * Unit tests (Vitest). Assets: equipment and infrastructure in one register, classified once, with condition kept apart from
 * availability and maintenance, dependencies recorded once and worked out both ways, and the link to VESPER Intelligence.
 * Infrastructure records are simulated demonstration data.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import { assetKindOf, categories, equipmentCategories, infrastructureCategories, infrastructureGroupOf } from "./equipment-rules";
import type { Actor } from "./issue-rules";
import { buildInsights, type IntelligenceInputs } from "./intelligence-rules";

const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };

function rejects(operation: () => unknown, status: number, pattern?: RegExp) {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(DemoError);
    expect((error as DemoError).status).toBe(status);
    if (pattern) expect((error as DemoError).message).toMatch(pattern);
    return;
  }
  throw new Error("Expected the operation to be rejected.");
}

const asset = (code: string) => demoDomain.listEquipment().find((item) => item.code === code)!;
const base = { name: "Standby Pump SP-09", code: "SP-09", category: "pump" };

beforeEach(() => demoDomain.reset());

describe("one register, two views", () => {
  it("classifies every category once: equipment or infrastructure, never both", () => {
    expect([...equipmentCategories, ...infrastructureCategories].sort()).toEqual([...categories].sort());
    expect(equipmentCategories.filter((value) => infrastructureCategories.includes(value))).toEqual([]);
    expect(infrastructureGroupOf.pump).toBe("water");
    expect(infrastructureGroupOf.conveyor).toBe("processing");
    expect(assetKindOf("excavator")).toBe("equipment");
    expect(assetKindOf("substation")).toBe("infrastructure");
  });

  it("keeps the existing equipment intact and adds simulated infrastructure to the same register", () => {
    const all = demoDomain.listEquipment();
    expect(all.find((item) => item.code === "C-02")).toMatchObject({ kind: "equipment", name: "Primary Crusher C-02", state: "unavailable" });
    const infra = all.filter((item) => item.kind === "infrastructure");
    expect(infra.map((item) => item.code).sort()).toEqual(["COM-01", "CV-07", "GEN-01", "HR-01", "PWP-03", "SUB-01", "TP-01"]);
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    expect(new Set(all.map((item) => item.code)).size).toBe(all.length);
    expect(infra.map((item) => item.group).sort()).toEqual(["communications", "power", "power", "processing", "transport", "water", "water"]);
  });

  it("keeps availability, condition and maintenance status distinct", () => {
    const pump = asset("PWP-03");
    expect(pump.state).toBe("available");
    expect(pump.condition).toBe("needs_attention");
    expect(["due_soon", "overdue"]).toContain(pump.nextService?.state);
    const substation = asset("SUB-01");
    expect(substation).toMatchObject({ state: "available", condition: "good" });
  });
});

describe("adding and editing infrastructure", () => {
  it("registers infrastructure with a location, responsible person, condition and usage, keeping the same asset structure", () => {
    const created = demoDomain.createEquipment({ ...base, location: "Water Plant", responsible: "Lebo Maseko", condition: "good", usage: "1,200 m3 pumped", hours: "", dependsOn: ["eq-sub-01"] }, planner);
    expect(created).toMatchObject({ kind: "infrastructure", group: "water", location: "Water Plant", responsible: "Lebo Maseko", condition: "good", usage: "1,200 m3 pumped", hours: null });
    expect(created.dependencies.map((item) => item.code)).toEqual(["SUB-01"]);
    expect(asset("SUB-01").dependents.map((item) => item.code)).toEqual(expect.arrayContaining(["SP-09", "C-02", "CV-07"]));
    expect(created.events[0].summary).toMatch(/Added/);
  });

  it("refuses a duplicate code, an unknown responsible person, a missing dependency and anyone without permission", () => {
    rejects(() => demoDomain.createEquipment({ ...base, code: "SUB-01" }, planner), 409);
    rejects(() => demoDomain.createEquipment({ ...base, responsible: "Nobody Here" }, planner), 400, /responsible person/);
    rejects(() => demoDomain.createEquipment({ ...base, dependsOn: ["eq-nothing"] }, planner), 400, /not in the register/);
    rejects(() => demoDomain.createEquipment(base, supervisor), 403);
  });

  it("records a change of condition and dependencies in the asset's history", () => {
    const updated = demoDomain.updateEquipment("eq-tp-01", { condition: "needs_attention", dependsOn: ["eq-pwp-03"], location: "Tailings storage facility", version: 1 }, planner);
    expect(updated.condition).toBe("needs_attention");
    expect(updated.dependencies.map((item) => item.code)).toEqual(["PWP-03"]);
    expect(updated.events.at(-1)!.summary).toMatch(/condition/);
    expect(updated.events.at(-1)!.summary).toMatch(/dependencies/);
    expect(updated.state).toBe("available");
  });
});

describe("dependencies", () => {
  it("never lets an asset depend on itself or go in a circle", () => {
    rejects(() => demoDomain.updateEquipment("eq-sub-01", { dependsOn: ["eq-sub-01"], version: 1 }, planner), 400, /itself/);
    // CV-07 depends on SUB-01, so SUB-01 cannot depend on CV-07.
    rejects(() => demoDomain.updateEquipment("eq-sub-01", { dependsOn: ["eq-cv-07"], version: 1 }, planner), 400, /circle/);
  });

  it("will not retire an asset that active assets depend on, and allows it once they no longer do", () => {
    rejects(() => demoDomain.retireEquipment("eq-sub-01", { reason: "Replaced by a new substation." }, planner), 409, /C-02, CV-07 depend on it/);
    demoDomain.updateEquipment("eq-crusher-c02", { dependsOn: [], version: 1 }, planner);
    demoDomain.updateEquipment("eq-cv-07", { dependsOn: [], version: 1 }, planner);
    expect(demoDomain.retireEquipment("eq-sub-01", { reason: "Replaced by a new substation." }, planner).retiredAt).not.toBeNull();
  });

  it("will not let anything depend on retired infrastructure", () => {
    demoDomain.retireEquipment("eq-gen-01", { reason: "Removed from site." }, planner);
    rejects(() => demoDomain.updateEquipment("eq-cv-07", { dependsOn: ["eq-gen-01"], version: 1 }, planner), 409, /retired/);
  });
});

describe("VESPER Intelligence and asset dependencies", () => {
  function inputs(): IntelligenceInputs {
    const state = demoDomain.get();
    const logistics = demoDomain.logistics(manager);
    return { now: demoDomain.now(), issues: demoDomain.listIssues(), equipment: demoDomain.listEquipment(), readiness: state.readiness, shifts: demoDomain.listShifts(), shipments: logistics.shipments, requests: logistics.requests, impact: demoDomain.impact(manager) };
  }

  it("names what depends on a substation that becomes unavailable, and estimates no money for it", () => {
    expect(buildInsights(inputs()).some((item) => item.id.startsWith("dependency-"))).toBe(false);
    demoDomain.setEquipmentState("eq-sub-01", { state: "unavailable", note: "Transformer fault reported at 07:10." }, planner);
    const insight = buildInsights(inputs()).find((item) => item.id === "dependency-eq-sub-01")!;
    expect(insight.title).toBe("Dependent assets affected");
    expect(insight.summary).toMatch(/SUB-01 is reported unavailable/);
    expect(insight.summary).toMatch(/C-02, CV-07 depend on it/);
    expect(insight.summary).not.toMatch(/R\s?\d/);
    expect(insight.why).toMatch(/No production or financial impact is estimated/);
    expect(insight.action.href).toBe("/equipment/eq-sub-01");
    expect(insight.sources.map((source) => source.label)).toEqual(expect.arrayContaining(["SUB-01", "C-02", "CV-07"]));
  });
});
