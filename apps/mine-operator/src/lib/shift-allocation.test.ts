import type { Shift } from "@vesper/api-contracts";
import { describe, expect, it } from "vitest";
import { allocationSheet, allocationToText } from "./shift-allocation";

const shift = {
  name: "Shift A",
  startsAt: "2025-04-24T06:00:00+02:00",
  endsAt: "2025-04-24T14:00:00+02:00",
  supervisor: "Amina Patel",
  briefing: "  North Pit ramp is wet. Reduced speed on the haul road.  ",
  crew: [
    { id: "c1", name: "Thabo Molefe", duty: "Operator", equipmentId: "eq-ex204" },
    { id: "c2", name: "Sipho Dube", duty: "Driver", equipmentId: null },
  ],
  work: [
    { id: "w1", title: "North Pit pre-start observation", owner: "Thabo Molefe", issueId: null, done: true, doneAt: "2025-04-24T06:18:00+02:00" },
    { id: "w2", title: "Clear feed chute", owner: null, issueId: null, done: false, doneAt: null },
  ],
} as unknown as Shift;

const names = (id: string | null) => (id === "eq-ex204" ? "Hydraulic Excavator EX-204" : null);
const now = "2025-04-24T09:30:00+02:00";

describe("allocationSheet", () => {
  it("lists the crew with their duty and equipment, and every task with its owner", () => {
    const sheet = allocationSheet(shift, names, now);
    expect(sheet.crew).toEqual([
      { name: "Thabo Molefe", duty: "Operator", equipment: "Hydraulic Excavator EX-204" },
      { name: "Sipho Dube", duty: "Driver", equipment: null },
    ]);
    expect(sheet.work.map((item) => item.owner)).toEqual(["Thabo Molefe", null]);
    expect(sheet.briefing).toBe("North Pit ramp is wet. Reduced speed on the haul road.");
  });
});

describe("allocationToText", () => {
  const text = allocationToText(allocationSheet(shift, names, now));

  it("reads as a message: shift, supervisor, crew, ticked work and the briefing", () => {
    expect(text.split("\n")[0]).toBe("SHIFT A · Thu, 24 Apr · 06:00–14:00");
    expect(text).toContain("Supervisor: Amina Patel");
    expect(text).toContain("- Thabo Molefe: Operator, Hydraulic Excavator EX-204");
    expect(text).toContain("- Sipho Dube: Driver");
    expect(text).toContain("[x] North Pit pre-start observation (Thabo Molefe), done 06:18");
    expect(text).toContain("[ ] Clear feed chute (not assigned)");
    expect(text).toContain("BRIEFING\nNorth Pit ramp is wet.");
  });

  it("says when it was made and that it can change", () => {
    expect(text).toMatch(/From VESPER, 24 Apr · 09:30\. The allocation can change/);
  });

  it("says so, instead of showing nothing, when there is no crew or work", () => {
    const empty = allocationToText(allocationSheet({ ...shift, crew: [], work: [], briefing: null } as unknown as Shift, names, now));
    expect(empty).toContain("- No crew added yet");
    expect(empty).toContain("- No work planned yet");
    expect(empty).not.toContain("BRIEFING");
  });
});
