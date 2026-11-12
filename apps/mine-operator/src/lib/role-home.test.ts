// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { demoDomain } from "./demo-store";
import { homeRole, plannerHome, storesHome, supervisorHome, type HomeData } from "./role-home";

function data(): HomeData {
  return {
    issues: demoDomain.listIssues(),
    equipment: demoDomain.listEquipment(),
    readiness: demoDomain.get().readiness,
    shifts: demoDomain.listShifts(),
    now: demoDomain.now(),
  };
}

beforeEach(() => demoDomain.reset());

describe("which home a role gets", () => {
  it("maps each office role to its own home and everyone else to the manager's", () => {
    expect(homeRole("Shift Supervisor")).toBe("supervisor");
    expect(homeRole("Maintenance Planner")).toBe("planner");
    expect(homeRole("Stores / Inventory Controller")).toBe("stores");
    expect(homeRole("Mine Manager")).toBe("manager");
    expect(homeRole("Field Employee")).toBe("manager");
  });
});

describe("supervisor home", () => {
  it("leads with the supervisor's own running shift and asks for the handover while it is a draft", () => {
    const home = supervisorHome(data(), "Amina Patel");
    expect(home.lead.title).toContain("Shift A");
    expect(home.lead.action.label).toBe("Write the handover");
    expect(home.lead.action.href).toMatch(/\/shifts\/.+\/handover$/);
    expect(home.figures.map((item) => item.label)).toContain("Tasks done");
    expect(home.panels.map((panel) => panel.id)).toEqual(["crew", "work"]);
    expect(home.panels[0]?.rows.length).toBeGreaterThan(0);
  });

  it("does not repeat the handover as a next item when the lead already asks for it", () => {
    const home = supervisorHome(data(), "Amina Patel");
    expect(home.nextUp.some((item) => item.kind === "handover")).toBe(false);
  });

  it("leads with the next scheduled shift for a supervisor who is not on one yet", () => {
    const home = supervisorHome(data(), "Sipho Nkosi");
    expect(home.lead.title).toContain("Shift B");
    expect(home.lead.chip).toBe("Scheduled");
    expect(home.lead.action.label).toBe("Open the shift");
  });
});

describe("maintenance planner home", () => {
  it("leads with maintenance, never with a shift handover", () => {
    const home = plannerHome(data());
    expect(home.lead.eyebrow).toBe("Maintenance");
    expect(home.lead.action.href).not.toMatch(/\/shifts\//);
    expect(home.nextUp.every((item) => item.kind !== "handover")).toBe(true);
    expect(home.figures[0]?.label).toBe("Equipment available");
    expect(home.panels.map((panel) => panel.id)).toEqual(["services", "down"]);
  });

  it("only counts issues that are about a piece of equipment", () => {
    const base = data();
    const plain = { ...base.issues[0]!, id: "x", equipmentId: null, priority: "critical" as const, workflowState: "in_progress" as const };
    const home = plannerHome({ ...base, issues: [plain] });
    expect([home.lead.action.href, ...home.nextUp.map((item) => item.href)]).not.toContain("/exceptions/x");
  });

  it("lists the equipment that is down with the note that was recorded", () => {
    const home = plannerHome(data());
    const down = home.panels.find((panel) => panel.id === "down");
    expect(down).toBeDefined();
    for (const row of down?.rows ?? []) expect(row.status?.label).toBe("Unavailable");
  });
});

describe("stores home", () => {
  it("leads with stock that needs a person and never shows unconfirmed stock as zero", () => {
    const home = storesHome(data());
    expect(home.lead.eyebrow).toBe("Stock");
    expect(home.nextUp.every((item) => item.kind === "readiness")).toBe(true);
    const parts = home.panels.find((panel) => panel.id === "parts");
    expect(parts?.rows.length).toBeGreaterThan(0);
    for (const row of parts?.rows ?? []) {
      if (row.status?.label === "Stock not confirmed") expect(row.detail).toContain("stock not confirmed");
      expect(row.detail).not.toMatch(/0 on hand/);
    }
  });

  it("says so plainly when nothing needs checking", () => {
    const base = data();
    const home = storesHome({ ...base, readiness: base.readiness.map((item) => ({ ...item, status: "ready" as const })) });
    expect(home.lead.title).toBe("Every part is accounted for");
    expect(home.nextUp).toEqual([]);
  });
});
