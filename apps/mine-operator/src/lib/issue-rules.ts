import type {
  Action,
  DefectOperability,
  DefectSymptom,
  IssueDependency,
  IssueWorkflowState,
  OperationalIssue,
} from "@vesper/api-contracts";

/**
 * Demonstration-only policy for the issue lifecycle (App Flow §9.2 and §9.4).
 * It is not a production authorisation model.
 */

export type Actor = { name: string; role: string };
export type Check = { allowed: boolean; reason?: string };

const MANAGEMENT = ["Mine Manager", "Shift Supervisor"];
const COORDINATORS = [...MANAGEMENT, "Maintenance Planner"];
const DEPENDENCY_ROLES = [...COORDINATORS, "Stores / Inventory Controller"];

export type IssueCapability =
  | "review"
  | "assign"
  | "edit"
  | "manage_actions"
  | "manage_dependencies"
  | "progress"
  | "report_resolution"
  | "verify"
  | "close"
  | "reopen"
  | "comment";

const roleRequirement: Record<IssueCapability, { roles: string[] | "any"; message: string }> = {
  review: { roles: MANAGEMENT, message: "Reviewing is done by a Shift Supervisor or Mine Manager." },
  assign: { roles: MANAGEMENT, message: "Assigning an owner is done by a Shift Supervisor or Mine Manager." },
  edit: { roles: COORDINATORS, message: "Editing details needs a Shift Supervisor, Mine Manager or Maintenance Planner." },
  manage_actions: { roles: COORDINATORS, message: "Managing actions needs a Shift Supervisor, Mine Manager or Maintenance Planner." },
  manage_dependencies: { roles: DEPENDENCY_ROLES, message: "Recording dependencies needs a coordinator or Stores / Inventory Controller." },
  progress: { roles: COORDINATORS, message: "Only the owner, a coordinator or a Mine Manager can move work forward." },
  report_resolution: { roles: COORDINATORS, message: "Only the owner or a coordinator can report a resolution." },
  verify: { roles: MANAGEMENT, message: "Verification is done by a Shift Supervisor or Mine Manager." },
  close: { roles: MANAGEMENT, message: "Closing is done by a Shift Supervisor or Mine Manager." },
  reopen: { roles: ["Mine Manager"], message: "Reopening a closed issue is a controlled step for the Mine Manager." },
  comment: { roles: "any", message: "" },
};

export function isFinished(state: IssueWorkflowState) {
  return state === "closed" || state === "cancelled" || state === "duplicate";
}

/** Verified or closed work is retained as history, but is no longer open coordination. */
export function isOpen(issue: Pick<OperationalIssue, "workflowState">) {
  return !isFinished(issue.workflowState) && issue.workflowState !== "verified";
}

export function activeActions(issue: Pick<OperationalIssue, "actions">): Action[] {
  return issue.actions.filter((action) => !action.removedAt);
}

export function openDependencies(issue: Pick<OperationalIssue, "dependencies">): IssueDependency[] {
  return issue.dependencies.filter((dependency) => dependency.state === "open");
}

function ownsWork(issue: OperationalIssue, actor: Actor) {
  return issue.owner === actor.name || activeActions(issue).some((action) => action.owner === actor.name);
}

export function canAct(capability: IssueCapability, actor: Actor, issue?: OperationalIssue): Check {
  const rule = roleRequirement[capability];
  if (rule.roles === "any" || rule.roles.includes(actor.role)) return { allowed: true };
  if ((capability === "progress" || capability === "report_resolution") && issue && ownsWork(issue, actor)) {
    return { allowed: true };
  }
  return { allowed: false, reason: rule.message };
}

/** Effective state for display: an unfinished action past its deadline reads as overdue. */
export function effectiveActionState(action: Action, now: string): Action["state"] {
  if (action.state === "complete") return "complete";
  if (action.dueAt && Date.parse(action.dueAt) < Date.parse(now)) return "overdue";
  return action.state === "overdue" ? "pending" : action.state;
}

export type TransitionOption = {
  to: IssueWorkflowState;
  label: string;
  tone: "primary" | "neutral" | "danger";
  noteLabel: string | null;
  needsReference: boolean;
  /** The actor's role may take this step; it may still be blocked by the issue's data. */
  permitted: boolean;
  allowed: boolean;
  reason?: string;
};

type TransitionSpec = {
  to: IssueWorkflowState;
  label: string;
  tone: TransitionOption["tone"];
  capability: IssueCapability;
  noteLabel?: string;
  reference?: boolean;
};

const transitionTable: Record<IssueWorkflowState, TransitionSpec[]> = {
  reported: [
    { to: "reviewed", label: "Mark reviewed", tone: "primary", capability: "review" },
    { to: "duplicate", label: "Mark duplicate", tone: "neutral", capability: "review", noteLabel: "Why is this a duplicate?", reference: true },
    { to: "cancelled", label: "Cancel issue", tone: "danger", capability: "review", noteLabel: "Why is this being cancelled?" },
  ],
  reviewed: [{ to: "action_assigned", label: "Confirm assignment", tone: "primary", capability: "assign" }],
  action_assigned: [
    { to: "in_progress", label: "Start work", tone: "primary", capability: "progress" },
    { to: "awaiting_dependency", label: "Wait on dependency", tone: "neutral", capability: "progress", noteLabel: "What is the work waiting for?" },
  ],
  in_progress: [
    { to: "resolution_reported", label: "Report resolution", tone: "primary", capability: "report_resolution", noteLabel: "What was done? Include the evidence." },
    { to: "awaiting_dependency", label: "Wait on dependency", tone: "neutral", capability: "progress", noteLabel: "What is the work waiting for?" },
  ],
  awaiting_dependency: [
    { to: "in_progress", label: "Resume work", tone: "primary", capability: "progress" },
    { to: "resolution_reported", label: "Report resolution", tone: "neutral", capability: "report_resolution", noteLabel: "What was done? Include the evidence." },
  ],
  resolution_reported: [
    { to: "verified", label: "Verify resolution", tone: "primary", capability: "verify", noteLabel: "What evidence confirms the resolution?" },
    { to: "reopened", label: "Reject verification", tone: "danger", capability: "verify", noteLabel: "Why is the resolution not accepted?" },
  ],
  verified: [
    { to: "closed", label: "Close issue", tone: "primary", capability: "close" },
    { to: "reopened", label: "Reopen", tone: "danger", capability: "close", noteLabel: "What new evidence reopens this issue?" },
  ],
  closed: [{ to: "reopened", label: "Reopen issue", tone: "danger", capability: "reopen", noteLabel: "Why is this being reopened?" }],
  reopened: [
    { to: "in_progress", label: "Resume work", tone: "primary", capability: "progress" },
    { to: "awaiting_dependency", label: "Wait on dependency", tone: "neutral", capability: "progress", noteLabel: "What is the work waiting for?" },
  ],
  cancelled: [],
  duplicate: [],
};

/** Data conditions that must hold before a transition is allowed. Returns the blocking message, if any. */
function dataBlocker(issue: OperationalIssue, to: IssueWorkflowState, actor: Actor): string | null {
  const actions = activeActions(issue);

  switch (to) {
    case "action_assigned":
      if (!issue.owner) return "Select an accountable owner first.";
      if (!actions.some((action) => action.owner && action.dueAt)) {
        return "Add at least one action with an owner and a deadline.";
      }
      return null;
    case "awaiting_dependency":
      return openDependencies(issue).length === 0 ? "Record the dependency first." : null;
    case "in_progress":
      return issue.workflowState === "awaiting_dependency" && openDependencies(issue).length > 0
        ? "Resolve or bypass the open dependency first."
        : null;
    case "resolution_reported":
      return openDependencies(issue).length > 0 ? "Resolve or bypass the open dependency first." : null;
    case "verified":
      return issue.resolutionReportedBy === actor.name
        ? "Verification must come from someone other than the person who reported the resolution."
        : null;
    case "closed":
      return actions.some((action) => action.state !== "complete")
        ? "Complete or remove the remaining actions before closing."
        : null;
    default:
      return null;
  }
}

export function transitionOptions(issue: OperationalIssue, actor: Actor): TransitionOption[] {
  return transitionTable[issue.workflowState].map((spec) => {
    const permission = canAct(spec.capability, actor, issue);
    const blocker = permission.allowed ? dataBlocker(issue, spec.to, actor) : null;
    return {
      to: spec.to,
      label: spec.label,
      tone: spec.tone,
      noteLabel: spec.noteLabel ?? null,
      needsReference: Boolean(spec.reference),
      permitted: permission.allowed,
      allowed: permission.allowed && !blocker,
      reason: permission.reason ?? blocker ?? undefined,
    };
  });
}

/** Validates a requested transition, including the note and reference the step requires. */
export function checkTransition(
  issue: OperationalIssue,
  to: IssueWorkflowState,
  input: { note?: string; reference?: string },
  actor: Actor,
): string | null {
  const option = transitionOptions(issue, actor).find((candidate) => candidate.to === to);
  if (!option) return `An issue that is ${issue.workflowState.replace(/_/g, " ")} cannot move to ${to.replace(/_/g, " ")}.`;
  if (!option.allowed) return option.reason ?? "This step is not available.";
  if (option.noteLabel && (input.note?.trim().length ?? 0) < 8) return "Add a short note of at least eight characters.";
  if (option.needsReference && !input.reference?.trim()) return "Enter the issue number this duplicates.";
  return null;
}

export const defectSymptomLabels: Record<DefectSymptom, string> = {
  leak: "Leak",
  noise_or_vibration: "Unusual noise or vibration",
  overheating: "Overheating",
  electrical_or_control: "Electrical or control fault",
  hydraulic_or_drive: "Hydraulic or drive fault",
  tyres_tracks_or_wear: "Tyres, tracks or wear parts",
  structural_damage: "Structural damage",
  warning_or_alarm: "Warning light or alarm",
  other: "Other",
};
export const defectSymptoms = Object.keys(defectSymptomLabels) as DefectSymptom[];

/** As the reporter sees it. This is information for the planner and supervisor, not a restriction or a release. */
export const defectOperabilityLabels: Record<DefectOperability, string> = {
  operating: "Still working normally",
  limited: "Working with a limitation",
  stopped: "Stopped",
  unsure: "Not sure",
};
export const defectOperabilities = Object.keys(defectOperabilityLabels) as DefectOperability[];

export const stateLabels: Record<IssueWorkflowState, string> = {
  reported: "Reported",
  reviewed: "Reviewed",
  action_assigned: "Action assigned",
  in_progress: "In progress",
  awaiting_dependency: "Awaiting dependency",
  resolution_reported: "Resolution reported",
  verified: "Verified",
  closed: "Closed",
  reopened: "Reopened",
  cancelled: "Cancelled",
  duplicate: "Duplicate",
};

/** The forward path shown as a progress rail on the issue page. */
export const lifecycleRail: IssueWorkflowState[] = [
  "reported",
  "reviewed",
  "action_assigned",
  "in_progress",
  "resolution_reported",
  "verified",
  "closed",
];

export function railPosition(state: IssueWorkflowState) {
  if (state === "awaiting_dependency") return lifecycleRail.indexOf("in_progress");
  if (state === "reopened") return lifecycleRail.indexOf("reviewed");
  const index = lifecycleRail.indexOf(state);
  return index === -1 ? -1 : index;
}
