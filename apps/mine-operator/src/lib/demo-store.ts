import type {
  Action,
  DependencyKind,
  IssueAttachment,
  IssueEvent,
  IssueEventType,
  IssueDependency,
  IssueWorkflowState,
  OperationalIssue,
  ReadinessActivity,
  ReadinessDecision,
} from "@vesper/api-contracts";
import {
  areas,
  defaultContext,
  equipment,
  notifications,
  primaryIssue,
  readinessActivity,
  secondaryIssue,
  shifts,
} from "./demo-data";
import { demoTimeAt } from "./demo-clock";
import {
  activeActions,
  canAct,
  checkTransition,
  transitionOptions,
  effectiveActionState,
  isFinished,
  isOpen,
  openDependencies,
  stateLabels,
  type Actor,
} from "./issue-rules";
import { deriveReadinessStatus } from "./readiness-rules";

export class DemoError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const fail = (status: number, code: string, message: string): never => {
  throw new DemoError(status, code, message);
};

type DemoNotification = (typeof notifications)[number] & { recipient: string | null };
type Shift = (typeof shifts)[number];

function clone<T>(value: T): T {
  return structuredClone(value);
}

const initialState = {
  context: defaultContext,
  issues: [primaryIssue, secondaryIssue],
  areas,
  readiness: [readinessActivity],
  equipment,
  shifts,
  notifications: notifications.map((item): DemoNotification => ({ ...item, recipient: null })),
  clock: 0,
  counters: { issue: 42, action: 4, dependency: 1, comment: 0, event: 200, review: 0, notification: 3 },
};

export type DemoDomainState = typeof initialState;

const STORAGE_KEY = "vesper-demo-state-v1";

/** Keeps the fictional records across a page refresh in this tab. Reset clears them. */
function loadState(): DemoDomainState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoDomainState>;
    return Array.isArray(parsed.issues) && typeof parsed.clock === "number" ? (parsed as DemoDomainState) : null;
  } catch {
    return null;
  }
}

function saveState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable or full; the demo still works for this page view.
  }
}

let state: DemoDomainState = loadState() ?? clone(initialState);

const now = () => demoTimeAt(state.clock);
const tick = () => {
  state.clock += 1;
  return now();
};
const nextId = (key: keyof DemoDomainState["counters"], prefix: string) => {
  state.counters[key] += 1;
  return `${prefix}-${String(state.counters[key]).padStart(3, "0")}`;
};

/** Overlays the deadline-based "overdue" reading without changing the stored action state. */
function present(issue: OperationalIssue): OperationalIssue {
  const current = now();
  return {
    ...issue,
    actions: issue.actions.map((action) => ({ ...action, state: effectiveActionState(action, current) })),
  };
}

function findIssue(id: string) {
  const issue = state.issues.find((item) => item.id === id);
  return issue ?? fail(404, "NOT_FOUND", "This issue could not be found.");
}

function assertEditable(issue: OperationalIssue) {
  if (isFinished(issue.workflowState)) {
    fail(409, "READ_ONLY", `${stateLabels[issue.workflowState]} issues are read-only history.${issue.workflowState === "closed" ? " Reopen the issue to change it." : ""}`);
  }
}

function assertVersion(issue: OperationalIssue, version: number | undefined) {
  if (version !== undefined && version !== issue.version) {
    fail(409, "VERSION_CONFLICT", "This issue changed while you were editing. Reload to see the latest version, then try again.");
  }
}

function assertCan(capability: Parameters<typeof canAct>[0], actor: Actor, issue?: OperationalIssue) {
  const check = canAct(capability, actor, issue);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You do not have access to this step.");
}

function record(
  issue: OperationalIssue,
  actor: Actor,
  event: {
    type: IssueEventType;
    summary: string;
    previousState?: IssueWorkflowState | null;
    nextState?: IssueWorkflowState | null;
    note?: string | null;
  },
) {
  const at = tick();
  const entry: IssueEvent = {
    id: nextId("event", "ev"),
    type: event.type,
    summary: event.summary,
    actor: actor.name,
    actorRole: actor.role,
    occurredAt: at,
    previousState: event.previousState ?? null,
    nextState: event.nextState ?? null,
    note: event.note?.trim() || null,
  };
  issue.events = [...issue.events, entry];
  issue.updatedAt = at;
  issue.version += 1;
  return entry;
}

function notify(recipient: string | null, title: string, detail: string, href: string, category: string) {
  state.notifications = [
    {
      id: nextId("notification", "not"),
      title,
      detail,
      href,
      unread: true,
      dismissed: false,
      category,
      recipient,
    },
    ...state.notifications,
  ];
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function requireText(value: unknown, label: string, min = 3) {
  const result = text(value);
  if (result.length < min) fail(400, "VALIDATION_ERROR", `${label} needs at least ${min} characters.`);
  return result;
}

export const demoDomain = {
  get: () => state,
  now,
  save: saveState,
  reset: () => {
    state = clone(initialState);
    saveState();
    return state;
  },

  // ---- Issues ----------------------------------------------------------------------------
  listIssues: () => state.issues.map(present),
  getIssue: (id: string) => present(findIssue(id)),

  createIssue(input: Record<string, unknown>, actor: Actor) {
    const title = requireText(input.title, "The title", 4);
    const description = requireText(input.description, "The description", 12);
    const priority = ["low", "medium", "high", "critical"].includes(String(input.priority))
      ? (input.priority as OperationalIssue["priority"])
      : "medium";
    const at = tick();
    state.counters.issue += 1;
    const issue: OperationalIssue = {
      id: `issue-demo-${state.counters.issue}`,
      organisationId: "org-himark-demo",
      siteId: "site-riverside",
      issueNumber: `RIV-2025-${String(state.counters.issue).padStart(3, "0")}`,
      title,
      description,
      equipmentId: typeof input.equipmentId === "string" && input.equipmentId ? input.equipmentId : null,
      areaId: typeof input.areaId === "string" && input.areaId ? input.areaId : null,
      priority,
      workflowState: "reported",
      quality: "reported",
      operationalStatus: "at_risk",
      owner: null,
      reportedAt: at,
      updatedAt: at,
      source: { label: "Simulated VESPER issue report", observedAt: at, quality: "reported" },
      actions: [],
      version: 1,
      resolutionReportedBy: null,
      dependencies: [],
      comments: [],
      verifications: [],
      events: [],
    };
    issue.events = [
      {
        id: nextId("event", "ev"),
        type: "reported",
        summary: "Issue reported",
        actor: actor.name,
        actorRole: actor.role,
        occurredAt: at,
        previousState: null,
        nextState: "reported",
        note: null,
      },
    ];
    state.issues = [issue, ...state.issues];
    return present(issue);
  },

  updateIssue(
    id: string,
    input: Record<string, unknown> & { version?: number },
    actor: Actor,
  ) {
    const issue = findIssue(id);
    assertVersion(issue, input.version);
    assertEditable(issue);

    const changes: string[] = [];
    const wantsDetails = ["title", "description", "priority", "equipmentId", "areaId"].some((key) => key in input);
    if (wantsDetails) assertCan("edit", actor, issue);
    if ("owner" in input) assertCan("assign", actor, issue);

    if ("title" in input) {
      const title = requireText(input.title, "The title", 4);
      if (title !== issue.title) changes.push("title");
      issue.title = title;
    }
    if ("description" in input) {
      const description = requireText(input.description, "The description", 12);
      if (description !== issue.description) changes.push("description");
      issue.description = description;
    }
    if ("equipmentId" in input) {
      const value = typeof input.equipmentId === "string" && input.equipmentId ? input.equipmentId : null;
      if (value !== issue.equipmentId) changes.push("equipment");
      issue.equipmentId = value;
    }
    if ("areaId" in input) {
      const value = typeof input.areaId === "string" && input.areaId ? input.areaId : null;
      if (value !== issue.areaId) changes.push("operating area");
      issue.areaId = value;
    }

    let priorityEvent: string | null = null;
    if ("priority" in input) {
      if (!["low", "medium", "high", "critical"].includes(String(input.priority))) {
        fail(400, "VALIDATION_ERROR", "Choose a priority from low to critical.");
      }
      const next = input.priority as OperationalIssue["priority"];
      if (next !== issue.priority) priorityEvent = `Priority changed from ${issue.priority} to ${next}`;
      issue.priority = next;
    }

    let ownerEvent: string | null = null;
    if ("owner" in input) {
      const next = text(input.owner) || null;
      if (next !== issue.owner) ownerEvent = next ? `Accountable owner set to ${next}` : "Accountable owner cleared";
      issue.owner = next;
      if (next && next !== actor.name) {
        notify(next, "You are the accountable owner", `${issue.issueNumber} · ${issue.title}`, `/exceptions/${issue.id}`, "Assignment");
      }
    }

    if (changes.length === 0 && !priorityEvent && !ownerEvent) return present(issue);
    if (changes.length) record(issue, actor, { type: "edited", summary: `Updated ${changes.join(", ")}` });
    if (priorityEvent) record(issue, actor, { type: "priority_changed", summary: priorityEvent });
    if (ownerEvent) record(issue, actor, { type: "owner_changed", summary: ownerEvent });
    return present(issue);
  },

  transitionIssue(
    id: string,
    input: { to?: IssueWorkflowState; note?: string; reference?: string; version?: number },
    actor: Actor,
  ) {
    const issue = findIssue(id);
    assertVersion(issue, input.version);
    const to = input.to ?? fail(400, "VALIDATION_ERROR", "Choose the next state.");
    const problem = checkTransition(issue, to, { note: input.note, reference: input.reference }, actor);
    if (problem) {
      const option = transitionOptions(issue, actor).find((candidate) => candidate.to === to);
      fail(option && !option.permitted ? 403 : 409, "TRANSITION_BLOCKED", problem);
    }

    const previous = issue.workflowState;
    const note = text(input.note);
    const reference = text(input.reference);
    issue.workflowState = to;

    if (to === "resolution_reported") {
      issue.resolutionReportedBy = actor.name;
      issue.quality = "reported";
    }
    if (to === "verified") {
      issue.quality = "verified";
      issue.verifications = [
        ...issue.verifications,
        { id: nextId("comment", "ver"), result: "confirmed", verifier: actor.name, note, verifiedAt: now() },
      ];
    }
    if (to === "reopened") {
      issue.quality = "reported";
      if (previous === "resolution_reported") {
        issue.verifications = [
          ...issue.verifications,
          { id: nextId("comment", "ver"), result: "rejected", verifier: actor.name, note, verifiedAt: now() },
        ];
        for (const person of new Set([issue.owner, issue.resolutionReportedBy])) {
          if (person && person !== actor.name) {
            notify(person, "Resolution was not verified", `${issue.issueNumber} · ${note}`, `/exceptions/${issue.id}`, "Verification");
          }
        }
      }
      issue.resolutionReportedBy = null;
    }
    if (to === "action_assigned" && issue.owner && issue.owner !== actor.name) {
      notify(issue.owner, "Work assigned to you", `${issue.issueNumber} · ${issue.title}`, `/exceptions/${issue.id}`, "Assignment");
    }

    const summary =
      to === "duplicate"
        ? `Marked as a duplicate of ${reference}`
        : to === "verified" || (to === "reopened" && previous === "resolution_reported")
          ? to === "verified"
            ? "Resolution verified"
            : "Verification rejected; issue reopened"
          : `${stateLabels[previous]} → ${stateLabels[to]}`;
    record(issue, actor, {
      type: to === "verified" || (to === "reopened" && previous === "resolution_reported") ? "verification_recorded" : "state_changed",
      summary,
      previousState: previous,
      nextState: to,
      note,
    });
    return present(issue);
  },

  // ---- Actions ---------------------------------------------------------------------------
  addAction(issueId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const issue = findIssue(issueId);
    assertVersion(issue, input.version);
    assertEditable(issue);
    assertCan("manage_actions", actor, issue);
    const action: Action = {
      id: nextId("action", "act"),
      title: requireText(input.title, "The action title", 4),
      owner: requireText(input.owner, "An owner", 2),
      team: requireText(input.team, "A team", 2),
      state: "pending",
      dueAt: typeof input.dueAt === "string" && input.dueAt ? input.dueAt : null,
      completedAt: null,
      removedAt: null,
    };
    issue.actions = [...issue.actions, action];
    record(issue, actor, { type: "action_added", summary: `Action added: ${action.title}` });
    return present(issue);
  },

  updateAction(issueId: string, actionId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const issue = findIssue(issueId);
    assertVersion(issue, input.version);
    assertEditable(issue);
    const action = issue.actions.find((item) => item.id === actionId && !item.removedAt) ?? fail(404, "NOT_FOUND", "This action could not be found.");
    const editsDetails = ["title", "owner", "team", "dueAt"].some((key) => key in input);

    if (editsDetails) assertCan("manage_actions", actor, issue);
    const changes: string[] = [];
    if ("title" in input) {
      const title = requireText(input.title, "The action title", 4);
      if (title !== action.title) changes.push("title");
      action.title = title;
    }
    if ("owner" in input) {
      const owner = requireText(input.owner, "An owner", 2);
      if (owner !== action.owner) changes.push(`owner to ${owner}`);
      action.owner = owner;
    }
    if ("team" in input) {
      const team = requireText(input.team, "A team", 2);
      if (team !== action.team) changes.push("team");
      action.team = team;
    }
    if ("dueAt" in input) {
      const dueAt = typeof input.dueAt === "string" && input.dueAt ? input.dueAt : null;
      if (dueAt !== action.dueAt) changes.push("deadline");
      action.dueAt = dueAt;
    }
    if ("state" in input) {
      const next = String(input.state) as Action["state"];
      if (!["pending", "in_progress", "complete"].includes(next)) fail(400, "VALIDATION_ERROR", "Choose pending, in progress or complete.");
      const mayMove = canAct("manage_actions", actor, issue).allowed || action.owner === actor.name;
      if (!mayMove) fail(403, "FORBIDDEN", "Only the action owner or a coordinator can change its state.");
      if (next !== action.state) {
        action.state = next;
        action.completedAt = next === "complete" ? tick() : null;
        record(issue, actor, {
          type: "action_updated",
          summary: next === "complete" ? `Action completed: ${action.title}` : `Action ${next === "in_progress" ? "started" : "set to pending"}: ${action.title}`,
        });
      }
    }
    if (changes.length) record(issue, actor, { type: "action_updated", summary: `Updated ${changes.join(", ")} on: ${action.title}` });
    return present(issue);
  },

  removeAction(issueId: string, actionId: string, input: { version?: number }, actor: Actor) {
    const issue = findIssue(issueId);
    assertVersion(issue, input.version);
    assertEditable(issue);
    assertCan("manage_actions", actor, issue);
    const action = issue.actions.find((item) => item.id === actionId && !item.removedAt) ?? fail(404, "NOT_FOUND", "This action could not be found.");
    if (action.state === "complete") fail(409, "READ_ONLY", "Completed actions stay on the record. Reopen the action instead.");
    action.removedAt = tick();
    record(issue, actor, { type: "action_removed", summary: `Action removed: ${action.title}` });
    return present(issue);
  },

  restoreAction(issueId: string, actionId: string, actor: Actor) {
    const issue = findIssue(issueId);
    assertEditable(issue);
    assertCan("manage_actions", actor, issue);
    const action = issue.actions.find((item) => item.id === actionId && item.removedAt) ?? fail(404, "NOT_FOUND", "This action is not removed.");
    action.removedAt = null;
    record(issue, actor, { type: "action_restored", summary: `Action restored: ${action.title}` });
    return present(issue);
  },

  // ---- Dependencies ----------------------------------------------------------------------
  addDependency(issueId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const issue = findIssue(issueId);
    assertVersion(issue, input.version);
    assertEditable(issue);
    assertCan("manage_dependencies", actor, issue);
    const kinds: DependencyKind[] = ["parts", "contractor", "internal_team", "permit_reference", "information"];
    if (!kinds.includes(input.kind as DependencyKind)) fail(400, "VALIDATION_ERROR", "Choose what kind of dependency this is.");
    const reviewBy = typeof input.reviewBy === "string" && input.reviewBy ? input.reviewBy : fail(400, "VALIDATION_ERROR", "Set a review deadline so the dependency is not left open-ended.");
    const blocked = typeof input.blockedActionId === "string" && input.blockedActionId ? input.blockedActionId : null;
    if (blocked && !activeActions(issue).some((action) => action.id === blocked)) {
      fail(400, "VALIDATION_ERROR", "The blocked action is not part of this issue.");
    }
    const dependency: IssueDependency = {
      id: nextId("dependency", "dep"),
      reason: requireText(input.reason, "The reason", 8),
      kind: input.kind as DependencyKind,
      blockedActionId: blocked,
      owner: requireText(input.owner, "An owner", 2),
      state: "open",
      raisedAt: now(),
      reviewBy,
      resolutionNote: null,
    };
    issue.dependencies = [...issue.dependencies, dependency];
    if (dependency.owner !== actor.name) {
      notify(dependency.owner, "A dependency needs your input", `${issue.issueNumber} · ${dependency.reason}`, `/exceptions/${issue.id}`, "Dependency");
    }
    record(issue, actor, { type: "dependency_added", summary: `Dependency recorded: ${dependency.reason}` });
    return present(issue);
  },

  updateDependency(issueId: string, dependencyId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const issue = findIssue(issueId);
    assertVersion(issue, input.version);
    assertEditable(issue);
    assertCan("manage_dependencies", actor, issue);
    const dependency = issue.dependencies.find((item) => item.id === dependencyId) ?? fail(404, "NOT_FOUND", "This dependency could not be found.");
    const next = String(input.state) as IssueDependency["state"];
    if (!["open", "resolved", "bypassed"].includes(next)) fail(400, "VALIDATION_ERROR", "Choose open, resolved or bypassed.");
    if (next === "open") {
      dependency.state = "open";
      dependency.resolutionNote = null;
      record(issue, actor, { type: "dependency_updated", summary: `Dependency reopened: ${dependency.reason}` });
      return present(issue);
    }
    const note = requireText(input.resolutionNote, next === "bypassed" ? "The justification for bypassing" : "The resolution note", 8);
    dependency.state = next;
    dependency.resolutionNote = note;
    record(issue, actor, {
      type: "dependency_updated",
      summary: `Dependency ${next}: ${dependency.reason}`,
      note,
    });
    return present(issue);
  },

  // ---- Comments and evidence -------------------------------------------------------------
  addComment(issueId: string, input: { body?: unknown; attachments?: IssueAttachment[]; version?: number }, actor: Actor) {
    const issue = findIssue(issueId);
    const body = requireText(input.body, "The comment", 2);
    const attachments = (input.attachments ?? []).slice(0, 5).map((attachment, index) => ({
      id: `att-${state.counters.comment + 1}-${index + 1}`,
      name: text(attachment.name) || "Attachment",
      kind: attachment.kind,
      sizeLabel: attachment.sizeLabel,
    }));
    issue.comments = [
      ...issue.comments,
      { id: nextId("comment", "cmt"), author: actor.name, role: actor.role, body, createdAt: tick(), attachments },
    ];
    record(issue, actor, {
      type: "comment_added",
      summary: attachments.length ? `Note added with ${attachments.length} evidence ${attachments.length === 1 ? "file" : "files"}` : "Note added",
    });
    return present(issue);
  },

  // ---- Readiness -------------------------------------------------------------------------
  addReview(activityId: string, input: { decision?: ReadinessDecision; note?: unknown }, actor: Actor) {
    const activity = state.readiness.find((item) => item.id === activityId) ?? fail(404, "NOT_FOUND", "This readiness activity could not be found.");
    if (!["Maintenance Planner", "Stores / Inventory Controller", "Mine Manager"].includes(actor.role)) {
      fail(403, "FORBIDDEN", "Readiness reviews are recorded by the Maintenance Planner, Stores or the Mine Manager.");
    }
    const decisions: ReadinessDecision[] = ["confirm_stock", "purchase_review", "escalate", "defer"];
    if (!decisions.includes(input.decision as ReadinessDecision)) fail(400, "VALIDATION_ERROR", "Choose a review decision.");
    const review = {
      id: nextId("review", "rev"),
      decision: input.decision as ReadinessDecision,
      note: requireText(input.note, "The review note", 8),
      reviewer: actor.name,
      role: actor.role,
      reviewedAt: tick(),
    };
    activity.reviews = [...activity.reviews, review];
    activity.reviewState = "reviewed";
    if (review.decision === "escalate") {
      notify("John Dlamini", "Readiness risk escalated", `${activity.title} · ${review.note}`, `/resources/${activity.id}`, "Readiness");
    }
    return activity;
  },

  updatePart(
    activityId: string,
    partId: string,
    input: Record<string, unknown>,
    actor: Actor,
  ): ReadinessActivity {
    const activity = state.readiness.find((item) => item.id === activityId) ?? fail(404, "NOT_FOUND", "This readiness activity could not be found.");
    if (!["Maintenance Planner", "Stores / Inventory Controller", "Mine Manager"].includes(actor.role)) {
      fail(403, "FORBIDDEN", "Stock figures are recorded by the Maintenance Planner, Stores or the Mine Manager.");
    }
    const part = activity.parts.find((item) => item.id === partId) ?? fail(404, "NOT_FOUND", "This part could not be found.");
    const quantity = (value: unknown, label: string) => {
      if (value === null || value === "" || value === undefined) return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(400, "VALIDATION_ERROR", `${label} must be zero or more, or left blank if unknown.`);
      return parsed;
    };
    const onHand = quantity(input.onHand, "On hand");
    const reserved = quantity(input.reserved, "Reserved");
    if ((onHand === null) !== (reserved === null)) {
      fail(400, "VALIDATION_ERROR", "Record on-hand and reserved together, or leave both blank if stock is unknown.");
    }
    const sourceNote = requireText(input.sourceNote, "The source of these figures", 8);
    const wantsVerified = input.confirmation === "verified";
    if (wantsVerified && actor.role !== "Stores / Inventory Controller") {
      fail(403, "FORBIDDEN", "Only the Stores / Inventory Controller can mark stock as verified. Record it as reported instead.");
    }

    part.onHand = onHand;
    part.reserved = reserved;
    part.inbound = quantity(input.inbound, "Inbound");
    part.leadTimeDays = quantity(input.leadTimeDays, "Lead time");
    part.quality = onHand === null ? "unknown" : wantsVerified ? "verified" : "reported";
    part.confirmedBy = actor.name;
    part.confirmedAt = tick();
    part.sourceNote = sourceNote;
    activity.status = deriveReadinessStatus(activity.parts);
    return activity;
  },

  // ---- Shifts and handover ---------------------------------------------------------------
  shiftView(id: string) {
    const shift = state.shifts.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This shift could not be found.");
    const issues = state.issues.filter(isOpen).map(present);
    const unresolved = shift.id === "shift-a-20250424" ? issues.length + issues.reduce((total, issue) => total + openDependencies(issue).length, 0) : 0;
    return { ...shift, unresolved, issues: shift.id === "shift-a-20250424" ? issues : [] };
  },

  saveHandoverNotes(shiftId: string, notes: unknown, actor: Actor) {
    const shift = findShift(shiftId);
    assertHandoverRole(actor);
    if (shift.handover.state !== "draft") fail(409, "READ_ONLY", "Withdraw the published handover before editing the notes.");
    shift.handover.notes = text(notes);
    shift.handover.notesUpdatedAt = tick();
    return shift;
  },

  publishHandover(shiftId: string, actor: Actor) {
    const shift = findShift(shiftId);
    assertHandoverRole(actor);
    if (shift.handover.state !== "draft") fail(409, "READ_ONLY", "This handover is already published.");
    if (shift.handover.notes.length < 20) fail(400, "VALIDATION_ERROR", "Write handover notes of at least twenty characters before publishing.");
    shift.handover.state = "published";
    shift.handover.publishedBy = actor.name;
    shift.handover.publishedAt = tick();
    return shift;
  },

  withdrawHandover(shiftId: string, actor: Actor) {
    const shift = findShift(shiftId);
    assertHandoverRole(actor);
    if (shift.handover.state !== "published") fail(409, "READ_ONLY", "Only a published, unacknowledged handover can be withdrawn.");
    if (shift.handover.publishedBy !== actor.name && actor.role !== "Mine Manager") {
      fail(403, "FORBIDDEN", "Only the publishing supervisor or the Mine Manager can withdraw this handover.");
    }
    shift.handover.state = "draft";
    shift.handover.publishedBy = null;
    shift.handover.publishedAt = null;
    return shift;
  },

  acknowledgeHandover(shiftId: string, actor: Actor) {
    const shift = findShift(shiftId);
    assertHandoverRole(actor);
    if (shift.handover.state === "acknowledged") fail(409, "READ_ONLY", "This handover is already acknowledged.");
    if (shift.handover.state !== "published") fail(409, "READ_ONLY", "The outgoing supervisor must publish the handover first.");
    if (shift.handover.publishedBy === actor.name) fail(403, "FORBIDDEN", "The incoming supervisor acknowledges the handover, not the person who published it.");
    shift.handover.state = "acknowledged";
    shift.handover.acknowledgedBy = actor.name;
    shift.handover.acknowledgedAt = tick();
    return shift;
  },

  // ---- Notifications ---------------------------------------------------------------------
  listNotifications: (actor: Actor) =>
    state.notifications.filter((item) => !item.dismissed && (item.recipient === null || item.recipient === actor.name)),

  updateNotification(id: string, input: { read?: boolean; dismissed?: boolean }) {
    const item = state.notifications.find((candidate) => candidate.id === id) ?? fail(404, "NOT_FOUND", "This notification could not be found.");
    if (input.read !== undefined) item.unread = !input.read;
    if (input.dismissed !== undefined) item.dismissed = input.dismissed;
    return item;
  },

  readAllNotifications(actor: Actor) {
    for (const item of state.notifications) {
      if (item.recipient === null || item.recipient === actor.name) item.unread = false;
    }
    return demoDomain.listNotifications(actor);
  },
};

function findShift(id: string): Shift {
  return state.shifts.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This shift could not be found.");
}

function assertHandoverRole(actor: Actor) {
  if (!["Shift Supervisor", "Mine Manager"].includes(actor.role)) {
    fail(403, "FORBIDDEN", "Handover is managed by a Shift Supervisor or the Mine Manager.");
  }
}
