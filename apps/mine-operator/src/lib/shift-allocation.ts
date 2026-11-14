import type { Shift } from "@vesper/api-contracts";
import { formatDemoDateTime, formatDemoTime } from "./demo-clock";
import { formatDay, shiftTimes } from "./shift-format";

/**
 * The work allocation for one shift as a sheet people can print, pin up or paste into a group chat. It is built from the
 * shift's crew and work, so it is always the same as the screen. Allocation is a plan. It says who is doing what, not who is
 * competent or authorised to do it.
 */
export type AllocationSheet = {
  shiftName: string;
  day: string;
  times: string;
  supervisor: string | null;
  briefing: string | null;
  crew: { name: string; duty: string; equipment: string | null }[];
  work: { title: string; owner: string | null; done: boolean; doneAt: string | null }[];
  asAt: string;
};

export function allocationSheet(shift: Shift, equipmentName: (id: string | null) => string | null, now: string): AllocationSheet {
  return {
    shiftName: shift.name,
    day: formatDay(shift.startsAt),
    times: shiftTimes(shift),
    supervisor: shift.supervisor,
    briefing: shift.briefing?.trim() || null,
    crew: shift.crew.map((member) => ({ name: member.name, duty: member.duty, equipment: equipmentName(member.equipmentId) })),
    work: shift.work.map((item) => ({ title: item.title, owner: item.owner, done: item.done, doneAt: item.doneAt })),
    asAt: now,
  };
}

/** Plain text, for a message or an email. */
export function allocationToText(sheet: AllocationSheet): string {
  const out = [`${sheet.shiftName.toUpperCase()} · ${sheet.day} · ${sheet.times}`];
  if (sheet.supervisor) out.push(`Supervisor: ${sheet.supervisor}`);

  out.push("", "CREW");
  if (sheet.crew.length === 0) out.push("- No crew added yet");
  for (const member of sheet.crew) out.push(`- ${member.name}: ${member.duty}${member.equipment ? `, ${member.equipment}` : ""}`);

  out.push("", "WORK");
  if (sheet.work.length === 0) out.push("- No work planned yet");
  for (const item of sheet.work) out.push(`${item.done ? "[x]" : "[ ]"} ${item.title} (${item.owner ?? "not assigned"})${item.done && item.doneAt ? `, done ${formatDemoTime(item.doneAt)}` : ""}`);

  if (sheet.briefing) out.push("", "BRIEFING", sheet.briefing);
  out.push("", `From VESPER, ${formatDemoDateTime(sheet.asAt)}. The allocation can change, so check VESPER for the latest.`);
  return out.join("\n");
}
