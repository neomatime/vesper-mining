import type { IssueWorkflowState, OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { potentiallyAllocable } from "./calculations";
import { primaryCauseLabel, secondaryCauseLabel, stateLabels } from "./issue-rules";
import { partPosition } from "./readiness-rules";

export type ReportKey =
  | "production-vs-plan"
  | "operational-exceptions"
  | "equipment-delay-stages"
  | "resource-readiness"
  | "recurring-causes"
  | "delay-analytics";

export type ReportSummary = {
  key: ReportKey;
  title: string;
  description: string;
  advanced: boolean;
};

export const reportCatalogue: ReportSummary[] = [
  { key: "production-vs-plan", title: "Production vs plan", description: "Reported actual against target, by day.", advanced: false },
  { key: "operational-exceptions", title: "Operational exceptions", description: "Where every issue sits in its lifecycle, from live records.", advanced: false },
  { key: "equipment-delay-stages", title: "Delay stages", description: "Time issues have spent in each stage, split into active work, waiting and coordination.", advanced: false },
  { key: "resource-readiness", title: "Resource readiness", description: "Required parts against what could be allocated, with unknown stock kept separate.", advanced: false },
  { key: "recurring-causes", title: "Recurring causes", description: "The primary and secondary causes reported on equipment issues, ranked by how often they recur.", advanced: false },
  { key: "delay-analytics", title: "Delay analytics", description: "Delay categories compared across weeks. Indicative trend view.", advanced: true },
];

export type ReportColumn = { key: string; label: string };
export type ReportSeries = { key: string; label: string; color: string };
type Cell = string | number | null;

export type ReportView = ReportSummary & {
  period: string;
  quality: "reported" | "pending" | "verified";
  source: string;
  definition: string;
  caveat: string;
  chart: { title: string; unit: string; stacked: boolean; series: ReportSeries[]; data: Record<string, Cell>[] };
  columns: ReportColumn[];
  rows: Record<string, Cell>[];
  issues: OperationalIssue[];
};

const GREEN = "#16865B";
const LIGHT = "#CDE8DA";
const AMBER = "#D38B17";
const GREY = "#9AA8A0";
const RED = "#D43F3A";

export type DelayStage = { issueNumber: string; state: IssueWorkflowState; minutes: number; final: boolean };

const stageType: Partial<Record<IssueWorkflowState, "Active work" | "Waiting" | "Coordination">> = {
  reported: "Coordination",
  reviewed: "Coordination",
  action_assigned: "Coordination",
  reopened: "Coordination",
  in_progress: "Active work",
  awaiting_dependency: "Waiting",
  resolution_reported: "Waiting",
};

export function stageTypeOf(state: IssueWorkflowState) {
  return stageType[state] ?? null;
}

/** Time spent in each state, from the issue's event history. The last open state runs to "now" and is not final. */
export function delayStages(issues: OperationalIssue[], now: string): DelayStage[] {
  const stages: DelayStage[] = [];
  for (const issue of issues) {
    const moves = issue.events
      .filter((event) => event.nextState !== null)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    moves.forEach((event, index) => {
      const state = event.nextState as IssueWorkflowState;
      if (!stageType[state]) return;
      const next = moves[index + 1];
      const end = next ? Date.parse(next.occurredAt) : Date.parse(now);
      const minutes = Math.max(0, Math.round((end - Date.parse(event.occurredAt)) / 60_000));
      stages.push({ issueNumber: issue.issueNumber, state, minutes, final: Boolean(next) });
    });
  }
  return stages;
}

const productionSeries = [
  { label: "18 Apr", plan: 126, actual: 111 },
  { label: "19 Apr", plan: 132, actual: 118 },
  { label: "20 Apr", plan: 128, actual: 105 },
  { label: "21 Apr", plan: 144, actual: 137 },
  { label: "22 Apr", plan: 149, actual: 147 },
  { label: "23 Apr", plan: 151, actual: 128 },
  { label: "24 Apr", plan: 162, actual: 156 },
];

const analyticsWeeks = [
  { label: "Wk 14", parts: 410, crew: 160, verification: 95, other: 120 },
  { label: "Wk 15", parts: 380, crew: 190, verification: 80, other: 110 },
  { label: "Wk 16", parts: 450, crew: 140, verification: 120, other: 100 },
  { label: "Wk 17", parts: 520, crew: 150, verification: 105, other: 90 },
];

export function buildReport(
  key: string,
  input: { issues: OperationalIssue[]; readiness: ReadinessActivity[]; now: string },
): ReportView | null {
  const summary = reportCatalogue.find((item) => item.key === key);
  if (!summary) return null;
  const { issues, readiness, now } = input;
  const base = { ...summary, issues };

  switch (summary.key) {
    case "production-vs-plan":
      return {
        ...base,
        period: "18–24 Apr 2025",
        quality: "reported",
        source: "Shift production log",
        definition: "Compares the shift-level reported actual with its target. Values are not verified mine output and do not establish loss, recovery or financial benefit.",
        caveat: "Reported figures. Not verified production.",
        chart: {
          title: "Actual vs plan",
          unit: "kt",
          stacked: false,
          series: [
            { key: "plan", label: "Plan", color: LIGHT },
            { key: "actual", label: "Actual", color: GREEN },
          ],
          data: productionSeries,
        },
        columns: [{ key: "label", label: "Date" }, { key: "plan", label: "Plan (kt)" }, { key: "actual", label: "Actual (kt)" }],
        rows: productionSeries,
      };

    case "operational-exceptions": {
      const counts = new Map<IssueWorkflowState, number>();
      for (const issue of issues) counts.set(issue.workflowState, (counts.get(issue.workflowState) ?? 0) + 1);
      return {
        ...base,
        period: "Current records · live",
        quality: "reported",
        source: "Issue register",
        definition: "Counts every issue by its current lifecycle state. Cancelled and duplicate issues are kept in the count so history is not hidden.",
        caveat: "Changes as you work with issues. A closed issue is not proof that equipment is cleared to operate.",
        chart: {
          title: "Issues by state",
          unit: "",
          stacked: false,
          series: [{ key: "issues", label: "Issues", color: GREEN }],
          data: [...counts.entries()].map(([state, issuesInState]) => ({ label: stateLabels[state], issues: issuesInState })),
        },
        columns: [
          { key: "issue", label: "Issue" },
          { key: "state", label: "State" },
          { key: "priority", label: "Priority" },
          { key: "owner", label: "Owner" },
          { key: "openActions", label: "Open actions" },
        ],
        rows: issues.map((issue) => ({
          issue: `${issue.issueNumber} · ${issue.title}`,
          state: stateLabels[issue.workflowState],
          priority: issue.priority,
          owner: issue.owner ?? "Not assigned",
          openActions: issue.actions.filter((action) => !action.removedAt && action.state !== "complete").length,
        })),
      };
    }

    case "recurring-causes": {
      const withCause = issues.filter((issue) => issue.defect);
      const byPrimary = new Map<string, number>();
      const byPair = new Map<string, { primary: string; secondary: string; count: number; latest: { at: string; issue: string } }>();
      for (const issue of withCause) {
        if (!issue.defect) continue;
        const primary = primaryCauseLabel(issue.defect.symptom);
        const secondary = issue.defect.secondary ? secondaryCauseLabel(issue.defect.symptom, issue.defect.secondary) : "No secondary cause";
        byPrimary.set(primary, (byPrimary.get(primary) ?? 0) + 1);
        const key = `${primary}|${secondary}`;
        const row = byPair.get(key) ?? { primary, secondary, count: 0, latest: { at: issue.reportedAt, issue: issue.issueNumber } };
        row.count += 1;
        if (Date.parse(issue.reportedAt) >= Date.parse(row.latest.at)) row.latest = { at: issue.reportedAt, issue: issue.issueNumber };
        byPair.set(key, row);
      }
      const primaries = [...byPrimary].map(([label, count]) => ({ label, issues: count })).sort((a, b) => b.issues - a.issues || a.label.localeCompare(b.label));
      const rank = new Map(primaries.map((row, index) => [row.label, index]));
      const pairs = [...byPair.values()]
        .sort((a, b) => (rank.get(a.primary) ?? 0) - (rank.get(b.primary) ?? 0) || b.count - a.count || a.secondary.localeCompare(b.secondary))
        .map((row) => ({ primary: row.primary, secondary: row.secondary, count: row.count, latest: row.latest.issue }));
      return {
        ...base,
        issues: withCause,
        period: "Current records · live",
        quality: "reported",
        source: "Issue register",
        definition: "Counts each equipment issue once under its primary cause, then breaks every primary cause down by the secondary cause chosen from that primary cause's own list. Issues reported before causes were captured are not counted.",
        caveat: "Causes are as reported by the person who raised the issue, not verified. A high count shows where to look first. It is not a confirmed fault pattern.",
        chart: {
          title: "Issues by primary cause",
          unit: "issues",
          stacked: false,
          series: [{ key: "issues", label: "Issues", color: GREEN }],
          data: primaries,
        },
        columns: [
          { key: "primary", label: "Primary cause" },
          { key: "secondary", label: "Secondary cause" },
          { key: "count", label: "Issues" },
          { key: "latest", label: "Latest issue" },
        ],
        rows: pairs,
      };
    }

    case "equipment-delay-stages": {
      const stages = delayStages(issues, now);
      const totals = new Map<IssueWorkflowState, number>();
      for (const stage of stages) totals.set(stage.state, (totals.get(stage.state) ?? 0) + stage.minutes);
      return {
        ...base,
        period: "Event history · live",
        quality: "reported",
        source: "Issue event history",
        definition: "Minutes each issue has spent in a state, taken from recorded transitions. Active work, waiting and coordination are shown separately and are never summed into one downtime figure.",
        caveat: "Waiting time is not automatically avoidable or financially recoverable. The last stage of an open issue is still running.",
        chart: {
          title: "Minutes in each state",
          unit: "min",
          stacked: false,
          series: [{ key: "minutes", label: "Minutes", color: GREEN }],
          data: [...totals.entries()].map(([state, minutes]) => ({ label: stateLabels[state], minutes })),
        },
        columns: [
          { key: "issue", label: "Issue" },
          { key: "state", label: "State" },
          { key: "type", label: "Type" },
          { key: "minutes", label: "Minutes" },
          { key: "note", label: "Status" },
        ],
        rows: stages.map((stage) => ({
          issue: stage.issueNumber,
          state: stateLabels[stage.state],
          type: stageType[stage.state] ?? "",
          minutes: stage.minutes,
          note: stage.final ? "Ended" : "Still running",
        })),
      };
    }

    case "resource-readiness": {
      const parts = readiness.flatMap((activity) => activity.parts.map((part) => ({ activity, part })));
      return {
        ...base,
        period: "Upcoming planned work · live",
        quality: "reported",
        source: "Readiness activities and stock figures",
        definition: "Required quantity against stock that could be allocated (on hand less reserved). Inbound supply is shown separately and is not counted as available.",
        caveat: "Unknown stock is not zero. A part with no allocable figure shows no bar.",
        chart: {
          title: "Required vs allocable",
          unit: "",
          stacked: false,
          series: [
            { key: "required", label: "Required", color: LIGHT },
            { key: "allocable", label: "Allocable", color: GREEN },
          ],
          data: parts.map(({ part }) => ({ label: part.name, required: part.required, allocable: potentiallyAllocable(part.onHand, part.reserved) })),
        },
        columns: [
          { key: "part", label: "Part" },
          { key: "activity", label: "For" },
          { key: "required", label: "Required" },
          { key: "allocable", label: "Allocable" },
          { key: "inbound", label: "Inbound" },
          { key: "position", label: "Position" },
        ],
        rows: parts.map(({ activity, part }) => ({
          part: part.name,
          activity: activity.title,
          required: part.required,
          allocable: potentiallyAllocable(part.onHand, part.reserved) ?? "Unknown",
          inbound: part.inbound ?? "Unknown",
          position: { unknown: "Unknown", short: "Short", needs_inbound: "Needs inbound", covered: "Covered" }[partPosition(part)],
        })),
      };
    }

    case "delay-analytics":
      return {
        ...base,
        period: "Weeks 14–17",
        quality: "pending",
        source: "Indicative trend data",
        definition: "Compares delay categories across weeks to show where waiting accumulates. This view is indicative and is not derived from the records above.",
        caveat: "Indicative trend data. Not measured delay, avoidable delay or financial loss.",
        chart: {
          title: "Delay minutes by category",
          unit: "min",
          stacked: true,
          series: [
            { key: "parts", label: "Waiting for parts", color: GREEN },
            { key: "crew", label: "Waiting for crew", color: AMBER },
            { key: "verification", label: "Awaiting verification", color: RED },
            { key: "other", label: "Other", color: GREY },
          ],
          data: analyticsWeeks,
        },
        columns: [
          { key: "label", label: "Week" },
          { key: "parts", label: "Parts" },
          { key: "crew", label: "Crew" },
          { key: "verification", label: "Verification" },
          { key: "other", label: "Other" },
        ],
        rows: analyticsWeeks,
      };
  }
}
