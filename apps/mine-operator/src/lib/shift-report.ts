import type { EquipmentEvent, OperationalIssue, Shift } from "@vesper/api-contracts";
import { formatDemoTime } from "./demo-clock";
import { stateLabels } from "./issue-rules";

/**
 * A draft shift report assembled from records VESPER already holds, so a supervisor reviews and corrects instead of
 * rebuilding the shift from memory. Every line points at the record it came from. The draft states what was recorded and
 * nothing more: it never estimates production, and it does not judge whether equipment is safe to run.
 */
export type ReportLine = { text: string; href?: string; label?: string };
export type ReportSection = { key: "work_done" | "work_open" | "issues" | "equipment" | "carried"; title: string; lines: ReportLine[] };
export type ShiftReportDraft = { generatedAt: string; windowStart: string; windowEnd: string; sections: ReportSection[] };

type EquipmentSource = { id: string; code: string; name: string; state: "available" | "unavailable"; stateNote: string | null; events: EquipmentEvent[] };

const within = (iso: string, start: number, end: number) => {
  const at = Date.parse(iso);
  return at >= start && at <= end;
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export function draftShiftReport(input: { shift: Shift; issues: OperationalIssue[]; equipment: EquipmentSource[]; now: string }): ShiftReportDraft {
  const { shift, issues, equipment, now } = input;
  const start = Date.parse(shift.startedAt ?? shift.startsAt);
  const end = Date.parse(shift.closedAt ?? now);
  const windowEnd = new Date(end).toISOString();

  // Work
  const workDone: ReportLine[] = shift.work
    .filter((item) => item.done)
    .map((item) => ({ text: `${item.title}${item.owner ? `, ${item.owner}` : ""}${item.doneAt ? ` (done ${formatDemoTime(item.doneAt)})` : ""}`, href: item.issueId ? `/exceptions/${item.issueId}` : undefined, label: item.title }));
  const workOpen: ReportLine[] = shift.work
    .filter((item) => !item.done)
    .map((item) => ({ text: `${item.title}${item.owner ? `, ${item.owner}` : ", no owner"}`, href: item.issueId ? `/exceptions/${item.issueId}` : undefined, label: item.title }));

  // Issues that moved during the shift, from their own event history
  const issueLines: ReportLine[] = [];
  for (const issue of issues) {
    const events = issue.events.filter((event) => within(event.occurredAt, start, end));
    if (events.length === 0) continue;
    const reported = events.find((event) => event.type === "reported");
    const moves = events.filter((event) => event.type === "state_changed" && event.nextState);
    const last = moves[moves.length - 1];
    const parts = [
      reported ? `reported ${formatDemoTime(reported.occurredAt)}` : null,
      last?.nextState ? `now ${stateLabels[last.nextState].toLowerCase()} (${formatDemoTime(last.occurredAt)})` : null,
      events.some((event) => event.type === "verification_recorded") ? "verification recorded" : null,
    ].filter(Boolean);
    issueLines.push({ text: `${issue.issueNumber} ${clean(issue.title)}${parts.length ? `: ${parts.join(", ")}` : `: ${events.length} ${events.length === 1 ? "update" : "updates"}`}`, href: `/exceptions/${issue.id}`, label: issue.issueNumber });
  }

  // Equipment availability changes during the shift
  const equipmentLines: ReportLine[] = [];
  for (const item of equipment) {
    for (const event of item.events.filter((candidate) => candidate.type === "state_changed" && within(candidate.occurredAt, start, end))) {
      equipmentLines.push({ text: `${item.code} ${item.name}: ${clean(event.summary)} (${formatDemoTime(event.occurredAt)}${event.note ? `, ${clean(event.note)}` : ""})`, href: `/equipment/${item.id}`, label: item.code });
    }
  }
  for (const item of equipment.filter((candidate) => candidate.state === "unavailable")) {
    equipmentLines.push({ text: `${item.code} ${item.name} is reported unavailable${item.stateNote ? `: ${clean(item.stateNote)}` : ""}`, href: `/equipment/${item.id}`, label: item.code });
  }

  // What carries across: open issues, and the open dependencies holding them
  const carried: ReportLine[] = [];
  for (const issue of issues.filter((candidate) => !["verified", "closed", "cancelled", "duplicate"].includes(candidate.workflowState))) {
    const open = issue.dependencies.filter((dependency) => dependency.state === "open");
    carried.push({
      text: `${issue.issueNumber} ${clean(issue.title)}: ${stateLabels[issue.workflowState].toLowerCase()}, owner ${issue.owner ?? "not assigned"}${open.length ? `; waiting on ${open.map((dependency) => `${clean(dependency.reason)} (${dependency.owner})`).join(", ")}` : ""}`,
      href: `/exceptions/${issue.id}`,
      label: issue.issueNumber,
    });
  }

  const sections: ReportSection[] = [
    { key: "work_done", title: "Work completed", lines: workDone },
    { key: "work_open", title: "Work not completed", lines: workOpen },
    { key: "issues", title: "Issues that moved this shift", lines: issueLines },
    { key: "equipment", title: "Equipment availability", lines: equipmentLines },
    { key: "carried", title: "Carried to the next shift", lines: carried },
  ];
  return { generatedAt: now, windowStart: new Date(start).toISOString(), windowEnd, sections };
}

/** The draft as plain text for the handover notes. The first line says it was prepared by VESPER, so a reader can tell it from the supervisor's own words. */
export function reportToText(draft: ShiftReportDraft, shiftName: string): string {
  const out = [`Prepared from VESPER records for ${shiftName} at ${formatDemoTime(draft.generatedAt)}. Review, correct and add before publishing.`];
  for (const section of draft.sections) {
    out.push("", `${section.title.toUpperCase()}`);
    if (section.lines.length === 0) out.push("- Nothing recorded");
    for (const line of section.lines) out.push(`- ${line.text}`);
  }
  out.push("", "SUPERVISOR NOTES", "");
  return out.join("\n");
}

/** Records the draft draws on, for the "sources" links under the notes. */
export function reportSources(draft: ShiftReportDraft): { href: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const section of draft.sections) {
    for (const line of section.lines) {
      if (line.href && !seen.has(line.href)) seen.set(line.href, line.label ?? line.text.split(/[:,(]/)[0]?.trim() ?? line.href);
    }
  }
  return [...seen].map(([href, label]) => ({ href, label }));
}
