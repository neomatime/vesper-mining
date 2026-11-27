/**
 * Equipment pre-start checks: the walk-around an operator does before using a machine each shift. Each machine type has its own
 * checklist; every item is marked pass, fail or not applicable. A failed item becomes an issue against the machine, with the
 * operator's note and the cause it points to, so it reaches the normal review and repair flow.
 *
 * A failed check is a report, not a decision: it does not take the machine out of service by itself. The operator says whether
 * they think it can be used, and the supervisor and maintenance decide (as with any reported fault).
 */
import type { EquipmentCategory, PrimaryCause } from "@vesper/api-contracts";

export type PrestartResult = "pass" | "fail" | "na";
export type PrestartItem = { id: string; label: string; hint: string; cause: PrimaryCause };
export type PrestartOperability = "yes" | "limited" | "no";

export type PrestartCheck = {
  id: string;
  equipmentId: string;
  shiftId: string | null;
  by: string;
  role: string;
  at: string;
  hoursReading: number | null;
  results: { itemId: string; label: string; result: PrestartResult; note: string }[];
  operability: PrestartOperability | null;
  /** The issues raised for failed items, in item order. */
  issueIds: string[];
};

export const prestartResultLabels: Record<PrestartResult, string> = { pass: "Pass", fail: "Fail", na: "N/A" };
export const prestartOperabilityLabels: Record<PrestartOperability, string> = {
  yes: "Yes, it can be used",
  limited: "Only with a restriction",
  no: "No, it should not be used",
};

const item = (id: string, label: string, hint: string, cause: PrimaryCause): PrestartItem => ({ id, label, hint, cause });

const safety = [
  item("fire", "Fire extinguisher and suppression", "In place, charged and in date", "other"),
  item("seatbelt", "Seat belt and cab", "Belt works; cab clean, glass intact", "structure_attachments"),
  item("lights", "Lights, horn and reverse alarm", "All work", "electrical_control"),
  item("mirrors", "Mirrors and cameras", "Clean, adjusted and working", "structure_attachments"),
  item("radio", "Two-way radio", "Radio check with control done", "electrical_control"),
];

const engine = [
  item("engine_oil", "Engine oil level", "Between the marks on the dipstick", "engine_fuel"),
  item("coolant", "Coolant level", "Visible in the sight glass, no leaks", "engine_fuel"),
  item("hydraulic_oil", "Hydraulic oil level", "In the green on the sight glass", "hydraulic"),
  item("leaks", "No leaks under the machine", "No fresh oil, fuel or coolant on the ground", "hydraulic"),
];

/** Checklists by machine type. Types without their own list use the general mobile-plant list. */
const lists: Partial<Record<EquipmentCategory, PrestartItem[]>> & { general: PrestartItem[] } = {
  excavator: [
    ...engine,
    item("hoses", "Hoses and fittings", "No rubbing, bulges or weeping", "hydraulic"),
    item("tracks", "Tracks, rollers and idlers", "Tension right, nothing missing or loose", "undercarriage_tyres"),
    item("bucket", "Bucket, teeth and pins", "Teeth secure, pins greased and retained", "structure_attachments"),
    item("swing", "Swing brake and travel lock", "Hold when tested", "drivetrain_brakes"),
    ...safety,
  ],
  haul_truck: [
    ...engine,
    item("tyres", "Tyres and wheel nuts", "No cuts or bulges; nuts tight, indicators aligned", "undercarriage_tyres"),
    item("brakes", "Service and park brake test", "Holds on the test", "drivetrain_brakes"),
    item("steering", "Steering", "Responds evenly both ways", "drivetrain_brakes"),
    item("tray", "Tray and hoist", "No cracks; hoist cylinders not leaking", "structure_attachments"),
    ...safety,
  ],
  dozer: [
    ...engine,
    item("tracks", "Tracks, rollers and idlers", "Tension right, nothing missing or loose", "undercarriage_tyres"),
    item("blade", "Blade, cutting edges and ripper", "Edges secure, no cracks", "structure_attachments"),
    item("brakes", "Brakes and steering clutches", "Hold and steer when tested", "drivetrain_brakes"),
    ...safety,
  ],
  general: [
    ...engine,
    item("tyres", "Tyres, tracks or running gear", "No damage, nothing loose", "undercarriage_tyres"),
    item("brakes", "Brakes and steering", "Work when tested", "drivetrain_brakes"),
    item("structure", "Body, guards and attachments", "No cracks, guards in place", "structure_attachments"),
    ...safety,
  ],
};

/** Mobile plant gets a pre-start check; fixed plant and infrastructure are inspected on their own plans instead. */
export const prestartCategories: EquipmentCategory[] = ["excavator", "haul_truck", "dozer", "loader", "drill_rig", "water_cart", "light_vehicle"];

export function checklistFor(category: EquipmentCategory): PrestartItem[] {
  return lists[category] ?? lists.general;
}

/** A check is current for the shift it was done in; without a shift, for the calendar day of the scenario. */
export function latestCheck(checks: PrestartCheck[], equipmentId: string, shiftId: string | null, today: string): PrestartCheck | null {
  const own = checks.filter((check) => check.equipmentId === equipmentId && (shiftId ? check.shiftId === shiftId : check.at.slice(0, 10) === today.slice(0, 10)));
  return own.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

/** What is wrong with a set of answers, or null when it can be recorded. */
export function checkProblem(items: PrestartItem[], answers: Record<string, { result?: PrestartResult; note?: string }>, operability: PrestartOperability | null): string | null {
  const missing = items.filter((entry) => !answers[entry.id]?.result);
  if (missing.length) return missing.length === 1 ? `Answer "${missing[0].label}".` : `Answer every item: ${missing.length} still open.`;
  const unexplained = items.find((entry) => answers[entry.id]?.result === "fail" && (answers[entry.id]?.note ?? "").trim().length < 4);
  if (unexplained) return `Say what is wrong with "${unexplained.label}".`;
  const failed = items.some((entry) => answers[entry.id]?.result === "fail");
  if (failed && !operability) return "Say whether you think the machine can be used.";
  return null;
}
