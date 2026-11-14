import type {
  DowntimeReason,
  Action,
  Company,
  Quote,
  ServiceInvite,
  ServiceProvider,
  ServiceRequest,
  CrewMember,
  Equipment,
  EquipmentCategory,
  EquipmentEvent,
  MaintenancePlan,
  ServiceEntry,
  SiteDetails,
  DependencyKind,
  IssueAttachment,
  IssueEvent,
  IssueEventType,
  IssueDependency,
  IssueWorkflowState,
  Member,
  OperationalIssue,
  OrganisationEvent,
  ReadinessActivity,
  ReadinessDecision,
  Shift,
  ShiftEvent,
  ShiftWork,
} from "@vesper/api-contracts";
import { downtimeReasonSchema, isSecondaryOf, issueDefectSchema } from "@vesper/api-contracts";
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
import { demoTimeAt, formatDemoTime } from "./demo-clock";
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
import {
  canActOnEquipment,
  categories,
  isValidCode,
  mostUrgent,
  normaliseCode,
  planStatus,
  type EquipmentCapability,
  type EquipmentView,
} from "./equipment-rules";
import type { Account } from "./accounts";
import { seedProviders, seedRequests } from "./service-data";
import { canManageProviders, canRequestService, isApproved } from "./service-rules";
import { seedActivity, seedCompany, seedCredentials, seedMembers, seedSite } from "./organisation-data";
import { canManageOrganisation, homeFor, isLastManager, isValidEmail, normaliseEmail, passwordProblem, roleNames } from "./organisation-rules";
import { deriveReadinessStatus } from "./readiness-rules";
import {
  buildShiftTimes,
  canActOnShift,
  isLive,
  peopleOn,
  shiftHours,
  shiftStateLabels,
  shiftsOverlap,
  type ShiftCapability,
  type ShiftView,
} from "./shift-rules";

export class DemoError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function fail(status: number, code: string, message: string): never {
  throw new DemoError(status, code, message);
}

type DemoNotification = (typeof notifications)[number] & { recipient: string | null };

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
  members: seedMembers,
  providers: seedProviders,
  serviceRequests: seedRequests,
  credentials: seedCredentials,
  company: seedCompany,
  site: seedSite,
  activity: seedActivity,
  notifications: notifications.map((item): DemoNotification => ({ ...item, recipient: null })),
  clock: 0,
  counters: { issue: 42, action: 4, dependency: 1, comment: 0, event: 200, review: 0, notification: 3, plan: 3, service: 3, equipmentEvent: 10, shift: 4, crew: 3, work: 4, shiftEvent: 20, member: 6, activity: 0, credential: 0, provider: 5, request: 0, invite: 0, requestEvent: 0 },
};

export type DemoDomainState = typeof initialState;

const STORAGE_KEY = "vesper-demo-state-v4";

/** Keeps the records across a page refresh and between tabs, so a provider's reply page sees the same request. Reset clears them. */
function loadState(): DemoDomainState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoDomainState>;
    const valid = Array.isArray(parsed.issues) && typeof parsed.clock === "number" && Array.isArray(parsed.equipment) && parsed.equipment.every((item) => Array.isArray(item.plans)) && Array.isArray(parsed.shifts) && parsed.shifts.every((item) => Array.isArray(item.crew)) && Array.isArray(parsed.members) && Array.isArray(parsed.providers) && Array.isArray(parsed.serviceRequests) && Boolean(parsed.credentials) && parsed.members.every((item) => typeof item.phone === "string") && Boolean(parsed.company) && Boolean(parsed.site);
    return valid ? (parsed as DemoDomainState) : null;
  } catch {
    return null;
  }
}

function saveState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable or full; the demo still works for this page view.
  }
}

let state: DemoDomainState = loadState() ?? clone(initialState);

// When another tab saves, take its version so this tab never overwrites a provider's reply.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const next = loadState();
    if (next) state = next;
  });
}

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

// ---- Equipment helpers ---------------------------------------------------------------------

function findEquipment(id: string) {
  return state.equipment.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This equipment could not be found.");
}

function assertEquipmentCan(capability: EquipmentCapability, actor: Actor) {
  const check = canActOnEquipment(capability, actor);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You do not have access to this step.");
}

function assertEquipmentVersion(item: Equipment, version: number | undefined) {
  if (version !== undefined && version !== item.version) {
    fail(409, "VERSION_CONFLICT", "This equipment changed while you were editing. Reload to see the latest version, then try again.");
  }
}

function assertActiveEquipment(item: Equipment) {
  if (item.retiredAt) fail(409, "READ_ONLY", "Retired equipment is read-only. Restore it to make changes.");
}

/** Up to five evidence files, by name, kind and size. Anything else is dropped. */
function readEvidence(value: unknown): { name: string; kind: "photo" | "document" | "other"; sizeLabel: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 5)
    .map((file) => file as { name?: unknown; kind?: unknown; sizeLabel?: unknown })
    .filter((file) => typeof file.name === "string" && file.name.trim() !== "")
    .map((file) => ({
      name: String(file.name).trim().slice(0, 120),
      kind: file.kind === "photo" || file.kind === "document" ? file.kind : ("other" as const),
      sizeLabel: typeof file.sizeLabel === "string" ? file.sizeLabel.slice(0, 20) : "",
    }));
}

/** Defect details only make sense for equipment, and only from the known lists. */
function readDefect(value: unknown, equipmentId: string | null): OperationalIssue["defect"] {
  if (equipmentId && (value === undefined || value === null)) fail(400, "VALIDATION_ERROR", "Choose the primary cause that was noticed.");
  if (value === undefined || value === null) return null;
  if (!equipmentId) fail(400, "VALIDATION_ERROR", "Cause details can only be added when equipment is selected.");
  const parsed = issueDefectSchema.safeParse(value);
  if (!parsed.success) fail(400, "VALIDATION_ERROR", "Choose the primary cause, an optional secondary cause and whether the equipment is still working, from the lists.");
  if (parsed.data.secondary && !isSecondaryOf(parsed.data.symptom, parsed.data.secondary)) fail(400, "VALIDATION_ERROR", "That secondary cause does not belong to the primary cause. Choose one from its own list.");
  return { symptom: parsed.data.symptom, secondary: parsed.data.secondary ?? null, operability: parsed.data.operability };
}

function equipmentEvent(actor: Actor, type: EquipmentEvent["type"], summary: string, at: string, note?: string | null, extra?: { state?: EquipmentEvent["state"]; reason?: EquipmentEvent["reason"] }): EquipmentEvent {
  return {
    id: nextId("equipmentEvent", "eqev"),
    type,
    state: extra?.state ?? null,
    reason: extra?.reason ?? null,
    summary,
    actor: actor.name,
    actorRole: actor.role,
    occurredAt: at,
    note: note?.trim() || null,
  };
}

function recordEquipment(item: Equipment, actor: Actor, event: { type: EquipmentEvent["type"]; summary: string; note?: string | null; state?: EquipmentEvent["state"]; reason?: EquipmentEvent["reason"] }) {
  const at = tick();
  item.events = [...item.events, equipmentEvent(actor, event.type, event.summary, at, event.note, { state: event.state, reason: event.reason })];
  item.version += 1;
}

function optionalNumber(value: unknown, label: string, bounds: { min?: number; max?: number; exclusiveMin?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) fail(400, "VALIDATION_ERROR", `${label} must be a number.`);
  if (bounds.min !== undefined && (bounds.exclusiveMin ? parsed <= bounds.min : parsed < bounds.min)) {
    fail(400, "VALIDATION_ERROR", `${label} must be ${bounds.exclusiveMin ? "more than" : "at least"} ${bounds.min}.`);
  }
  if (bounds.max !== undefined && parsed > bounds.max) fail(400, "VALIDATION_ERROR", `${label} must be ${bounds.max} or less.`);
  return parsed;
}

function checkedCode(value: unknown, selfId?: string) {
  const code = normaliseCode(text(value));
  if (!isValidCode(code)) fail(400, "VALIDATION_ERROR", "Use 2 to 14 letters, numbers or hyphens for the asset code, for example EX-204.");
  if (state.equipment.some((item) => item.code === code && item.id !== selfId)) {
    fail(409, "DUPLICATE_CODE", `The code ${code} is already used by another piece of equipment.`);
  }
  return code;
}

function checkedCategory(value: unknown): EquipmentCategory {
  if (!categories.includes(value as EquipmentCategory)) fail(400, "VALIDATION_ERROR", "Choose a category.");
  return value as EquipmentCategory;
}

function checkedArea(value: unknown) {
  const areaId = typeof value === "string" && value ? value : null;
  if (areaId && !state.areas.some((area) => area.id === areaId)) fail(400, "VALIDATION_ERROR", "Choose an area from the site.");
  return areaId;
}

function checkedPlan(input: Record<string, unknown>, item: Equipment): Omit<MaintenancePlan, "id"> {
  const name = requireText(input.name, "The plan name", 3);
  if (input.basis !== "hours" && input.basis !== "days") fail(400, "VALIDATION_ERROR", "Choose whether the plan is by operating hours or by days.");
  const interval = optionalNumber(input.interval, "The interval", { min: 0, exclusiveMin: true });
  if (interval === null) fail(400, "VALIDATION_ERROR", "Enter the interval between services.");

  if (input.basis === "hours") {
    const last = optionalNumber(input.lastServiceHours, "Hours at the last service", { min: 0 });
    if (last !== null && item.hours !== null && last > item.hours) {
      fail(400, "VALIDATION_ERROR", `The last service cannot be above the current reading of ${item.hours.toLocaleString("en-GB")} hours.`);
    }
    return { name, basis: "hours", interval, lastServiceHours: last, lastServiceAt: null };
  }

  const lastAt = typeof input.lastServiceAt === "string" && input.lastServiceAt ? input.lastServiceAt : null;
  if (lastAt && (Number.isNaN(Date.parse(lastAt)) || Date.parse(lastAt) > Date.parse(now()) + 60_000)) {
    fail(400, "VALIDATION_ERROR", "Enter a valid date for the last service, not in the future.");
  }
  return { name, basis: "days", interval, lastServiceHours: null, lastServiceAt: lastAt };
}

/** Why a piece of equipment cannot be retired yet. */
function equipmentBlockers(item: Equipment) {
  const blockers: string[] = [];
  const open = state.issues.filter((issue) => issue.equipmentId === item.id && isOpen(issue));
  if (open.length) blockers.push(`${open.length} open ${open.length === 1 ? "issue" : "issues"} (${open.map((issue) => issue.issueNumber).join(", ")})`);
  const upcoming = state.readiness.filter((activity) => activity.equipmentId === item.id && activity.status !== "ready");
  if (upcoming.length) blockers.push(`${upcoming.length} upcoming maintenance ${upcoming.length === 1 ? "activity" : "activities"} not yet ready`);
  return blockers;
}

function presentEquipment(item: Equipment): EquipmentView {
  const current = now();
  const maintenance = item.plans.map((plan) => planStatus(plan, item, current));
  return {
    ...item,
    services: [...item.services].sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt)),
    areaName: state.areas.find((area) => area.id === item.areaId)?.name ?? null,
    maintenance,
    nextService: mostUrgent(maintenance),
    linkedIssues: state.issues
      .filter((issue) => issue.equipmentId === item.id)
      .map((issue) => ({ id: issue.id, issueNumber: issue.issueNumber, title: issue.title, workflowState: issue.workflowState, open: isOpen(issue) })),
    readiness: state.readiness
      .filter((activity) => activity.equipmentId === item.id)
      .map((activity) => ({ id: activity.id, title: activity.title, status: activity.status, scheduledFor: activity.scheduledFor })),
  };
}

// ---- Shift helpers -------------------------------------------------------------------------

const byStart = (a: Shift, b: Shift) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

function findShift(id: string): Shift {
  return state.shifts.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This shift could not be found.");
}

function assertShiftCan(capability: ShiftCapability, actor: Actor, shift?: Shift, next?: ReturnType<typeof presentShift>["next"]) {
  const check = canActOnShift(capability, actor, shift, next);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You do not have access to this step.");
}

function assertShiftVersion(shift: Shift, version: number | undefined) {
  if (version !== undefined && version !== shift.version) {
    fail(409, "VERSION_CONFLICT", "This shift changed while you were editing. Reload to see the latest version, then try again.");
  }
}

function assertShiftLive(shift: Shift) {
  if (!isLive(shift)) fail(409, "READ_ONLY", `${shiftStateLabels[shift.state]} shifts are read-only history.`);
}

function shiftEvent(actor: Actor, type: ShiftEvent["type"], summary: string, at: string, note?: string | null): ShiftEvent {
  return {
    id: nextId("shiftEvent", "shev"),
    type,
    summary,
    actor: actor.name,
    actorRole: actor.role,
    occurredAt: at,
    note: note?.trim() || null,
  };
}

function recordShift(shift: Shift, actor: Actor, event: { type: ShiftEvent["type"]; summary: string; note?: string | null }) {
  const at = tick();
  shift.events = [...shift.events, shiftEvent(actor, event.type, event.summary, at, event.note)];
  shift.version += 1;
}

function checkedShiftTimes(input: Record<string, unknown>) {
  const date = text(input.date);
  const start = text(input.start);
  const end = text(input.end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, "VALIDATION_ERROR", "Choose the date of the shift.");
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) fail(400, "VALIDATION_ERROR", "Enter the start and end times.");
  const times = buildShiftTimes(date, start, end);
  if (Number.isNaN(Date.parse(times.startsAt)) || Number.isNaN(Date.parse(times.endsAt))) fail(400, "VALIDATION_ERROR", "Enter a valid date and times.");
  const hours = shiftHours(times);
  if (hours < 1 || hours > 16) fail(400, "VALIDATION_ERROR", "A shift runs between 1 and 16 hours.");
  return times;
}

/** People who can own work: everyone with access, plus the contractor team. */
function ownerNames() {
  return [...state.members.filter((member) => member.status !== "deactivated").map((member) => member.name), "OreTech Services"];
}

function checkedSupervisor(value: unknown) {
  const name = typeof value === "string" && value ? value : null;
  if (name && !state.members.some((person) => person.name === name && person.status !== "deactivated" && (person.role === "Shift Supervisor" || person.role === "Mine Manager"))) {
    fail(400, "VALIDATION_ERROR", "A supervisor must be a Shift Supervisor or the Mine Manager.");
  }
  return name;
}

function assertNoOverlap(times: { startsAt: string; endsAt: string }, selfId?: string) {
  const clash = state.shifts.find((item) => item.id !== selfId && item.state !== "cancelled" && shiftsOverlap(item, times));
  if (clash) {
    fail(409, "OVERLAP", `This overlaps ${clash.name} (${formatDemoTime(clash.startsAt)}–${formatDemoTime(clash.endsAt)}). Shifts on the same site cannot overlap.`);
  }
}

/** A person cannot be on two shifts at the same time. */
function assertPeopleFree(people: string[], times: { startsAt: string; endsAt: string }, selfId?: string) {
  for (const other of state.shifts) {
    if (other.id === selfId || other.state === "cancelled" || !shiftsOverlap(other, times)) continue;
    const busy = people.find((person) => peopleOn(other).includes(person));
    if (busy) fail(409, "DOUBLE_BOOKED", `${busy} is already on ${other.name} (${formatDemoTime(other.startsAt)}–${formatDemoTime(other.endsAt)}).`);
  }
}

function presentShift(shift: Shift): ShiftView {
  const issues = state.issues.filter(isOpen).map(present);
  const unresolved = issues.length + issues.reduce((total, issue) => total + openDependencies(issue).length, 0);
  const live = [...state.shifts].filter((item) => item.state !== "cancelled").sort(byStart);
  const index = live.findIndex((item) => item.id === shift.id);
  const next = index >= 0 ? live[index + 1] : undefined;
  const previous = index > 0 ? live[index - 1] : undefined;
  return {
    ...shift,
    unresolved: shift.state === "cancelled" ? 0 : unresolved,
    issues: shift.state === "cancelled" ? [] : issues,
    next: next ? { id: next.id, name: next.name, supervisor: next.supervisor } : null,
    previous: previous ? { id: previous.id, name: previous.name } : null,
  };
}

// ---- Service providers and requests ---------------------------------------------------------
function assertProviderManager(actor: Actor) {
  const check = canManageProviders(actor);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "Not permitted.");
}

function assertRequester(actor: Actor) {
  const check = canRequestService(actor);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "Not permitted.");
}

function findProvider(id: string) {
  return state.providers.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This service provider could not be found.");
}

function findRequest(id: string) {
  return state.serviceRequests.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This service request could not be found.");
}

function checkedProvider(input: Record<string, unknown>, selfId?: string) {
  const name = requireText(input.name, "The company name", 3);
  if (state.providers.some((item) => item.id !== selfId && item.name.toLowerCase() === name.toLowerCase())) fail(409, "DUPLICATE_NAME", "A provider with this name is already on the list.");
  const email = text(input.email);
  if (email && !isValidEmail(email)) fail(400, "VALIDATION_ERROR", "Enter a valid email address, or leave it blank.");
  const chosen = Array.isArray(input.categories) ? input.categories.map(String) : [];
  if (chosen.length === 0) fail(400, "VALIDATION_ERROR", "Choose at least one kind of equipment they service.");
  if (chosen.some((category) => !(categories as string[]).includes(category))) fail(400, "VALIDATION_ERROR", "One of the equipment types is not recognised.");
  const approvedUntil = text(input.approvedUntil);
  if (approvedUntil && !/^\d{4}-\d{2}-\d{2}$/.test(approvedUntil)) fail(400, "VALIDATION_ERROR", "Enter the approval end date as a date, or leave it blank.");
  return { name, registration: text(input.registration), contactName: text(input.contactName), email, phone: text(input.phone), categories: chosen as EquipmentCategory[], approvedUntil, notes: text(input.notes) };
}

/** A link only the provider holds. In this build it identifies the invite; real access control arrives with the backend. */
function replyToken(n: number) {
  return `r${n.toString(36)}${(Math.imul(n + 7, 2654435761) >>> 0).toString(36)}${(Math.imul(n + 31, 40503) >>> 0).toString(36)}`;
}

function findByToken(token: string) {
  for (const request of state.serviceRequests) {
    const invite = request.invites.find((item) => item.token === token);
    if (invite) return { request, invite };
  }
  return fail(404, "NOT_FOUND", "This link is not valid. Ask the mine for a new one.");
}

function logRequest(request: ServiceRequest, actor: Actor, summary: string) {
  const at = tick();
  request.events = [...request.events, { id: nextId("requestEvent", "sre"), at, actor: actor.name, summary }];
  request.version += 1;
}

function assertRequestVersion(request: ServiceRequest, version: number | undefined) {
  if (version !== undefined && version !== request.version) fail(409, "VERSION_CONFLICT", "This request was changed by someone else. Reload to see the latest.");
}

function assertRequestLive(request: ServiceRequest) {
  if (request.status === "completed" || request.status === "cancelled") fail(409, "READ_ONLY", `This request is ${request.status} and can no longer be changed.`);
}

function findInvite(request: ServiceRequest, inviteId: string): ServiceInvite {
  return request.invites.find((item) => item.id === inviteId) ?? fail(404, "NOT_FOUND", "That provider is not part of this request.");
}

function checkedDate(value: unknown, label: string, required = false) {
  const raw = text(value);
  if (!raw) {
    if (required) fail(400, "VALIDATION_ERROR", `Enter ${label}.`);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) fail(400, "VALIDATION_ERROR", `Enter ${label} as a date.`);
  return raw;
}

// ---- Organisation helpers -----------------------------------------------------------------
function assertOrganisationManager(actor: Actor) {
  const check = canManageOrganisation(actor);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "Not permitted.");
}

function findMember(id: string) {
  return state.members.find((member) => member.id === id) ?? fail(404, "NOT_FOUND", "This person could not be found.");
}

function assertRecordVersion(record: { version: number }, version: number | undefined) {
  if (version !== undefined && version !== record.version) fail(409, "VERSION_CONFLICT", "This was changed by someone else. Reload to see the latest.");
}

function checkedRole(value: unknown) {
  const role = text(value);
  if (!roleNames.includes(role)) fail(400, "VALIDATION_ERROR", "Choose a role from the list.");
  return role;
}

function checkedEmail(value: unknown, selfId?: string) {
  const email = normaliseEmail(text(value));
  if (!isValidEmail(email)) fail(400, "VALIDATION_ERROR", "Enter a valid work email address.");
  if (state.members.some((member) => member.id !== selfId && member.email === email)) fail(409, "DUPLICATE_EMAIL", "Someone with this email address already has access.");
  return email;
}

function checkedEmployeeNumber(value: unknown, selfId?: string) {
  const number = text(value);
  if (number && state.members.some((member) => member.id !== selfId && member.employeeNumber.toLowerCase() === number.toLowerCase())) {
    fail(409, "DUPLICATE_NUMBER", "Another employee already has this employee number.");
  }
  return number;
}

function startSession(member: Member): Account {
  const at = tick();
  if (member.status === "invited") {
    member.status = "active";
    member.joinedAt = at;
    logOrganisation({ name: member.name, role: member.role }, `${member.name} signed in for the first time`);
  }
  member.lastSignInAt = at;
  return { email: member.email, name: member.name, role: member.role, home: homeFor(member.role) };
}

function logOrganisation(actor: Actor, summary: string) {
  const entry: OrganisationEvent = { id: nextId("activity", "org"), at: tick(), actor: actor.name, summary };
  state.activity = [entry, ...state.activity].slice(0, 50);
}

function touch<T extends { version: number }>(record: T) {
  record.version += 1;
  return record;
}

function newTemporaryPassword() {
  state.counters.credential += 1;
  const n = state.counters.credential;
  return `Vesper-${String((n * 7919) % 9000 + 1000)}-${"KQWXZM"[n % 6]}${"tbrnfd"[(n * 3) % 6]}`;
}

/** True when a person appears on shifts, issues, actions or equipment history, so they must be kept. */
function memberHasRecords(name: string) {
  const onShift = state.shifts.some((shift) => shift.supervisor === name || shift.crew.some((member) => member.name === name) || shift.work.some((item) => item.owner === name) || shift.events.some((event) => event.actor === name));
  const onIssue = state.issues.some((issue) => issue.owner === name || issue.actions.some((action) => action.owner === name) || issue.events.some((event) => event.actor === name) || issue.comments.some((comment) => comment.author === name));
  const onEquipment = state.equipment.some((item) => item.events.some((event) => event.actor === name));
  return onShift || onIssue || onEquipment;
}

export type ProviderRequestView = {
  requestNumber: string;
  mineName: string;
  siteName: string;
  providerName: string;
  title: string;
  description: string;
  urgency: ServiceRequest["urgency"];
  preferredDate: string | null;
  equipment: { code: string; name: string; makeModel: string | null };
  state: ServiceInvite["state"];
  open: boolean;
  closedReason: string | null;
  quote: Quote | null;
  declinedReason: string | null;
};

export type AuthResult = { account: Account | null; mustChangePassword: boolean };

export type OrganisationView = {
  members: Member[];
  company: Company;
  site: SiteDetails;
  activity: OrganisationEvent[];
};

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
    const equipmentId = typeof input.equipmentId === "string" && input.equipmentId ? input.equipmentId : null;
    const defect = readDefect(input.defect, equipmentId);
    const at = tick();
    state.counters.issue += 1;
    const issue: OperationalIssue = {
      id: `issue-demo-${state.counters.issue}`,
      organisationId: "org-himark-demo",
      siteId: "site-riverside",
      issueNumber: `RIV-2025-${String(state.counters.issue).padStart(3, "0")}`,
      title,
      description,
      equipmentId,
      areaId: typeof input.areaId === "string" && input.areaId ? input.areaId : null,
      defect,
      priority,
      workflowState: "reported",
      quality: "reported",
      operationalStatus: "at_risk",
      owner: null,
      reportedAt: at,
      updatedAt: at,
      source: { label: "VESPER issue report", observedAt: at, quality: "reported" },
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

  // ---- Equipment -------------------------------------------------------------------------
  listEquipment: () => state.equipment.map(presentEquipment),
  getEquipment: (id: string) => presentEquipment(findEquipment(id)),

  createEquipment(input: Record<string, unknown>, actor: Actor) {
    assertEquipmentCan("manage", actor);
    const name = requireText(input.name, "The name", 3);
    const code = checkedCode(input.code);
    const category = checkedCategory(input.category);
    const at = tick();
    const hours = optionalNumber(input.hours, "Operating hours", { min: 0 });
    const item: Equipment = {
      id: `eq-${code.toLowerCase()}`,
      siteId: "site-riverside",
      code,
      name,
      category,
      makeModel: text(input.makeModel) || null,
      serialNumber: text(input.serialNumber) || null,
      areaId: checkedArea(input.areaId),
      notes: text(input.notes) || null,
      state: "available",
      stateNote: null,
      stateQuality: "reported",
      stateUpdatedAt: at,
      hours,
      hoursReadAt: hours === null ? null : at,
      hoursSource: hours === null ? null : actor.name,
      hoursPerDay: optionalNumber(input.hoursPerDay, "Average hours per day", { min: 0, exclusiveMin: true, max: 24 }),
      plans: [],
      services: [],
      events: [],
      retiredAt: null,
      retiredReason: null,
      version: 1,
      createdAt: at,
    };
    item.events = [equipmentEvent(actor, "created", "Added to the equipment register", at)];
    state.equipment = [...state.equipment, item];
    return presentEquipment(item);
  },

  updateEquipment(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("manage", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);

    const changes: string[] = [];
    if ("name" in input) {
      const name = requireText(input.name, "The name", 3);
      if (name !== item.name) changes.push("name");
      item.name = name;
    }
    if ("code" in input) {
      const code = checkedCode(input.code, item.id);
      if (code !== item.code) changes.push("asset code");
      item.code = code;
    }
    if ("category" in input) {
      const category = checkedCategory(input.category);
      if (category !== item.category) changes.push("category");
      item.category = category;
    }
    if ("areaId" in input) {
      const areaId = checkedArea(input.areaId);
      if (areaId !== item.areaId) changes.push("area");
      item.areaId = areaId;
    }
    for (const [key, label] of [["makeModel", "make and model"], ["serialNumber", "serial number"], ["notes", "notes"]] as const) {
      if (key in input) {
        const value = text(input[key]) || null;
        if (value !== item[key]) changes.push(label);
        item[key] = value;
      }
    }
    if ("hoursPerDay" in input) {
      const value = optionalNumber(input.hoursPerDay, "Average hours per day", { min: 0, exclusiveMin: true, max: 24 });
      if (value !== item.hoursPerDay) changes.push("average hours per day");
      item.hoursPerDay = value;
    }
    if (changes.length) recordEquipment(item, actor, { type: "edited", summary: `Updated ${changes.join(", ")}` });
    return presentEquipment(item);
  },

  setEquipmentState(id: string, input: { state?: unknown; note?: unknown; reason?: unknown; version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("state", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);
    if (input.state !== "available" && input.state !== "unavailable") fail(400, "VALIDATION_ERROR", "Choose available or unavailable.");
    const note = input.state === "unavailable" ? requireText(input.note, "The reason", 8) : text(input.note) || null;
    const reasons = downtimeReasonSchema.options as readonly string[];
    if (input.reason !== undefined && input.reason !== null && input.reason !== "" && !reasons.includes(String(input.reason))) fail(400, "VALIDATION_ERROR", "Choose a reason from the list.");
    const reason = input.state === "unavailable" && input.reason ? (input.reason as DowntimeReason) : null;
    item.state = input.state;
    item.stateNote = note;
    item.stateQuality = "reported";
    item.stateUpdatedAt = tick();
    recordEquipment(item, actor, {
      type: "state_changed",
      summary: input.state === "unavailable" ? "Reported unavailable" : "Reported available",
      note,
      state: input.state,
      reason,
    });
    return presentEquipment(item);
  },

  recordReading(id: string, input: { hours?: unknown; correction?: unknown; note?: unknown; version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("reading", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);
    const hours = optionalNumber(input.hours, "The reading", { min: 0 });
    if (hours === null) fail(400, "VALIDATION_ERROR", "Enter the meter reading in hours.");
    const correction = input.correction === true;
    if (item.hours !== null && hours < item.hours && !correction) {
      fail(409, "READING_LOWER", `That is lower than the last reading of ${item.hours.toLocaleString("en-GB")} hours. If the last reading was wrong, record this as a correction and say why.`);
    }
    const note = correction ? requireText(input.note, "The reason for the correction", 8) : null;
    const previous = item.hours;
    item.hours = hours;
    item.hoursReadAt = tick();
    item.hoursSource = actor.name;
    recordEquipment(item, actor, {
      type: "reading_recorded",
      summary: correction
        ? `Reading corrected from ${previous?.toLocaleString("en-GB") ?? "none"} to ${hours.toLocaleString("en-GB")} hours`
        : `Meter reading ${hours.toLocaleString("en-GB")} hours`,
      note,
    });
    return presentEquipment(item);
  },

  addPlan(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("manage", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);
    const plan: MaintenancePlan = { id: nextId("plan", "plan"), ...checkedPlan(input, item) };
    item.plans = [...item.plans, plan];
    recordEquipment(item, actor, { type: "plan_added", summary: `Maintenance plan added: ${plan.name}` });
    return presentEquipment(item);
  },

  updatePlan(id: string, planId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("manage", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);
    const plan = item.plans.find((candidate) => candidate.id === planId) ?? fail(404, "NOT_FOUND", "This maintenance plan could not be found.");
    Object.assign(plan, checkedPlan(input, item));
    recordEquipment(item, actor, { type: "plan_updated", summary: `Maintenance plan updated: ${plan.name}` });
    return presentEquipment(item);
  },

  removePlan(id: string, planId: string, input: { version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("manage", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);
    const plan = item.plans.find((candidate) => candidate.id === planId) ?? fail(404, "NOT_FOUND", "This maintenance plan could not be found.");
    item.plans = item.plans.filter((candidate) => candidate.id !== planId);
    recordEquipment(item, actor, { type: "plan_removed", summary: `Maintenance plan removed: ${plan.name}` });
    return presentEquipment(item);
  },

  logService(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("service", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);
    if (!["service", "inspection", "repair"].includes(String(input.type))) fail(400, "VALIDATION_ERROR", "Choose service, inspection or repair.");
    const type = input.type as ServiceEntry["type"];
    const summary = requireText(input.summary, "The summary", 8);
    const performedAt = typeof input.performedAt === "string" && input.performedAt ? input.performedAt : now();
    if (Number.isNaN(Date.parse(performedAt))) fail(400, "VALIDATION_ERROR", "Enter a valid date and time.");
    if (Date.parse(performedAt) > Date.parse(now()) + 60_000) fail(400, "VALIDATION_ERROR", "A service cannot be logged for a future time.");
    const hours = optionalNumber(input.hours, "The meter reading", { min: 0 });
    const planId = typeof input.planId === "string" && input.planId ? input.planId : null;
    const plan = planId ? item.plans.find((candidate) => candidate.id === planId) ?? fail(400, "VALIDATION_ERROR", "That maintenance plan is not on this equipment.") : null;
    if (plan && type !== "service") fail(400, "VALIDATION_ERROR", "Only a service resets a maintenance plan. Choose service, or clear the plan.");
    if (plan?.basis === "hours" && hours === null && item.hours === null) {
      fail(400, "VALIDATION_ERROR", "Enter the meter reading at the time of the service, so the next due date can be worked out.");
    }

    const entry: ServiceEntry = {
      id: nextId("service", "svc"),
      type,
      performedAt,
      hours,
      summary,
      performedBy: actor.name,
      workOrderRef: text(input.workOrderRef) || null,
      planId,
    };
    item.services = [...item.services, entry];
    if (hours !== null && (item.hours === null || hours > item.hours)) {
      item.hours = hours;
      item.hoursReadAt = tick();
      item.hoursSource = actor.name;
    }
    if (plan) {
      plan.lastServiceHours = hours ?? item.hours;
      plan.lastServiceAt = performedAt;
    }
    recordEquipment(item, actor, {
      type: "service_logged",
      summary: `${type === "service" ? "Service" : type === "inspection" ? "Inspection" : "Repair"} logged${plan ? ` for ${plan.name}` : ""}`,
      note: summary,
    });
    return presentEquipment(item);
  },

  retireEquipment(id: string, input: { reason?: unknown; version?: number }, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("manage", actor);
    assertEquipmentVersion(item, input.version);
    assertActiveEquipment(item);
    const reason = requireText(input.reason, "The reason", 8);
    const blockers = equipmentBlockers(item);
    if (blockers.length) fail(409, "IN_USE", `Resolve this first: ${blockers.join("; ")}.`);
    item.retiredAt = tick();
    item.retiredReason = reason;
    recordEquipment(item, actor, { type: "retired", summary: "Retired from service", note: reason });
    return presentEquipment(item);
  },

  restoreEquipment(id: string, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("manage", actor);
    if (!item.retiredAt) fail(409, "READ_ONLY", "This equipment is already active.");
    item.retiredAt = null;
    item.retiredReason = null;
    recordEquipment(item, actor, { type: "restored", summary: "Returned to service" });
    return presentEquipment(item);
  },

  /** Removes a record made in error. Anything with history is retired instead, so history is never lost. */
  deleteEquipment(id: string, actor: Actor) {
    const item = findEquipment(id);
    assertEquipmentCan("manage", actor);
    const history: string[] = [];
    if (item.services.length) history.push(`${item.services.length} service ${item.services.length === 1 ? "entry" : "entries"}`);
    const issues = state.issues.filter((issue) => issue.equipmentId === item.id).length;
    if (issues) history.push(`${issues} linked ${issues === 1 ? "issue" : "issues"}`);
    const activities = state.readiness.filter((activity) => activity.equipmentId === item.id).length;
    if (activities) history.push(`${activities} readiness ${activities === 1 ? "activity" : "activities"}`);
    if (item.events.some((event) => event.type !== "created" && event.type !== "edited")) history.push("recorded activity");
    if (history.length) fail(409, "HAS_HISTORY", `This equipment has ${history.join(", ")}. Retire it instead so the history is kept.`);
    state.equipment = state.equipment.filter((candidate) => candidate.id !== item.id);
    return { id: item.id, deleted: true };
  },

  // ---- Shifts and handover ---------------------------------------------------------------
  listShifts: () => [...state.shifts].sort(byStart).map(presentShift),
  shiftView: (id: string) => presentShift(findShift(id)),

  createShift(input: Record<string, unknown>, actor: Actor) {
    assertShiftCan("manage", actor);
    const name = requireText(input.name, "The shift name", 3);
    const times = checkedShiftTimes(input);
    const supervisor = checkedSupervisor(input.supervisor);
    assertNoOverlap(times);
    if (supervisor) assertPeopleFree([supervisor], times);
    const at = tick();
    const shift: Shift = {
      id: nextId("shift", "shift"),
      siteId: "site-riverside",
      name,
      ...times,
      state: "scheduled",
      supervisor,
      briefing: text(input.briefing) || null,
      crew: [],
      work: [],
      handover: { notes: "", state: "draft", notesUpdatedAt: null, publishedBy: null, publishedAt: null, acknowledgedBy: null, acknowledgedAt: null },
      events: [],
      startedAt: null,
      closedAt: null,
      cancelledReason: null,
      version: 1,
      createdAt: at,
    };
    shift.events = [shiftEvent(actor, "created", "Shift scheduled", at)];
    state.shifts = [...state.shifts, shift];
    return presentShift(shift);
  },

  updateShift(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("manage", actor);
    assertShiftVersion(shift, input.version);
    assertShiftLive(shift);

    const changes: string[] = [];
    const timesChanged = ["date", "start", "end"].some((key) => key in input);
    if (shift.state === "in_progress" && (timesChanged || "supervisor" in input || "name" in input)) {
      fail(409, "READ_ONLY", "A shift that is running can only have its briefing and its crew and work changed.");
    }
    if ("name" in input) {
      const name = requireText(input.name, "The shift name", 3);
      if (name !== shift.name) changes.push("name");
      shift.name = name;
    }
    if (timesChanged) {
      const times = checkedShiftTimes(input);
      assertNoOverlap(times, shift.id);
      assertPeopleFree(peopleOn(shift), times, shift.id);
      if (times.startsAt !== shift.startsAt || times.endsAt !== shift.endsAt) changes.push("times");
      shift.startsAt = times.startsAt;
      shift.endsAt = times.endsAt;
    }
    if ("supervisor" in input) {
      const supervisor = checkedSupervisor(input.supervisor);
      if (supervisor !== shift.supervisor) {
        if (supervisor) assertPeopleFree([supervisor], shift, shift.id);
        changes.push("supervisor");
      }
      shift.supervisor = supervisor;
    }
    if ("briefing" in input) {
      const briefing = text(input.briefing) || null;
      if (briefing !== shift.briefing) changes.push("briefing");
      shift.briefing = briefing;
    }
    if (changes.length) recordShift(shift, actor, { type: "edited", summary: `Updated ${changes.join(", ")}` });
    return presentShift(shift);
  },

  startShift(id: string, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("run", actor, shift);
    if (shift.state !== "scheduled") fail(409, "READ_ONLY", `Only a scheduled shift can be started. This one is ${shiftStateLabels[shift.state].toLowerCase()}.`);
    if (!shift.supervisor) fail(409, "NO_SUPERVISOR", "Assign a supervisor before starting the shift.");
    const running = state.shifts.find((item) => item.state === "in_progress");
    if (running) fail(409, "ALREADY_RUNNING", `${running.name} is still running. Close it before starting ${shift.name}.`);
    shift.startedAt = tick();
    shift.state = "in_progress";
    recordShift(shift, actor, { type: "started", summary: "Shift started" });
    return presentShift(shift);
  },

  closeShift(id: string, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("run", actor, shift);
    if (shift.state !== "in_progress") fail(409, "READ_ONLY", "Only a running shift can be closed.");
    const open = presentShift(shift).unresolved;
    if (open > 0 && shift.handover.state === "draft") {
      fail(409, "HANDOVER_REQUIRED", `Publish the handover before closing. ${open} ${open === 1 ? "item is" : "items are"} still open and will carry into the next shift.`);
    }
    const unfinished = shift.work.filter((item) => !item.done).length;
    shift.closedAt = tick();
    shift.state = "closed";
    recordShift(shift, actor, {
      type: "closed",
      summary: "Shift closed",
      note: unfinished ? `${unfinished} ${unfinished === 1 ? "task was" : "tasks were"} not finished.` : null,
    });
    return presentShift(shift);
  },

  cancelShift(id: string, input: { reason?: unknown; version?: number }, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("manage", actor);
    assertShiftVersion(shift, input.version);
    if (shift.state !== "scheduled") fail(409, "READ_ONLY", "Only a scheduled shift can be cancelled. A running shift is closed instead.");
    const reason = requireText(input.reason, "The reason", 8);
    shift.state = "cancelled";
    shift.cancelledReason = reason;
    recordShift(shift, actor, { type: "cancelled", summary: "Shift cancelled", note: reason });
    return presentShift(shift);
  },

  /** Removes a shift made in error. Anything with people, work or notes is cancelled instead, so the record is kept. */
  deleteShift(id: string, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("manage", actor);
    if (shift.state !== "scheduled" && shift.state !== "cancelled") fail(409, "HAS_HISTORY", "A shift that has run is kept as a record.");
    const filled: string[] = [];
    if (shift.crew.length) filled.push("crew");
    if (shift.work.length) filled.push("work");
    if (shift.briefing) filled.push("a briefing");
    if (shift.handover.notes) filled.push("handover notes");
    if (shift.events.some((event) => event.type !== "created" && event.type !== "edited")) filled.push("recorded activity");
    if (filled.length) fail(409, "HAS_HISTORY", `This shift has ${filled.join(", ")}. Cancel it instead so the record is kept.`);
    state.shifts = state.shifts.filter((item) => item.id !== shift.id);
    return { id: shift.id, deleted: true };
  },

  addCrew(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("manage", actor);
    assertShiftVersion(shift, input.version);
    assertShiftLive(shift);
    const name = requireText(input.name, "The person", 2);
    if (!ownerNames().includes(name)) fail(400, "VALIDATION_ERROR", "Choose a person from your team.");
    if (peopleOn(shift).includes(name)) fail(409, "DUPLICATE", `${name} is already on this shift.`);
    assertPeopleFree([name], shift, shift.id);
    const equipmentId = typeof input.equipmentId === "string" && input.equipmentId ? input.equipmentId : null;
    if (equipmentId) {
      const unit = state.equipment.find((item) => item.id === equipmentId);
      if (!unit || unit.retiredAt) fail(400, "VALIDATION_ERROR", "Choose equipment that is on the active register.");
    }
    const member: CrewMember = { id: nextId("crew", "crew"), name, duty: requireText(input.duty, "The duty", 3), equipmentId };
    shift.crew = [...shift.crew, member];
    recordShift(shift, actor, { type: "crew_added", summary: `${name} added as ${member.duty.toLowerCase()}` });
    return presentShift(shift);
  },

  removeCrew(id: string, crewId: string, input: { version?: number }, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("manage", actor);
    assertShiftVersion(shift, input.version);
    assertShiftLive(shift);
    const member = shift.crew.find((item) => item.id === crewId) ?? fail(404, "NOT_FOUND", "This crew member could not be found.");
    shift.crew = shift.crew.filter((item) => item.id !== crewId);
    recordShift(shift, actor, { type: "crew_removed", summary: `${member.name} removed from the shift` });
    return presentShift(shift);
  },

  addWork(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("manage", actor);
    assertShiftVersion(shift, input.version);
    assertShiftLive(shift);
    const issueId = typeof input.issueId === "string" && input.issueId ? input.issueId : null;
    if (issueId) {
      const issue = state.issues.find((item) => item.id === issueId);
      if (!issue || !isOpen(issue)) fail(400, "VALIDATION_ERROR", "Choose an issue that is still open.");
      if (shift.work.some((item) => item.issueId === issueId)) fail(409, "DUPLICATE", "That issue is already on this shift.");
    }
    const owner = typeof input.owner === "string" && input.owner ? input.owner : null;
    if (owner && !ownerNames().includes(owner)) fail(400, "VALIDATION_ERROR", "Choose an owner from your team.");
    const item: ShiftWork = { id: nextId("work", "work"), title: requireText(input.title, "The task", 4), owner, issueId, done: false, doneAt: null };
    shift.work = [...shift.work, item];
    recordShift(shift, actor, { type: "work_added", summary: `Work added: ${item.title}` });
    return presentShift(shift);
  },

  updateWork(id: string, workId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const shift = findShift(id);
    assertShiftVersion(shift, input.version);
    assertShiftLive(shift);
    const item = shift.work.find((candidate) => candidate.id === workId) ?? fail(404, "NOT_FOUND", "This task could not be found.");
    if ("title" in input || "owner" in input) assertShiftCan("manage", actor);
    if ("title" in input) item.title = requireText(input.title, "The task", 4);
    if ("owner" in input) {
      const owner = typeof input.owner === "string" && input.owner ? input.owner : null;
      if (owner && !ownerNames().includes(owner)) fail(400, "VALIDATION_ERROR", "Choose an owner from your team.");
      item.owner = owner;
    }
    if ("done" in input) {
      assertShiftCan("work", actor, { ...shift, work: [item] });
      const done = input.done === true;
      if (done !== item.done) {
        const note = text(input.note).slice(0, 500) || null;
        const evidence = readEvidence(input.evidence);
        item.done = done;
        item.doneAt = done ? tick() : null;
        item.completion = done ? { note, evidence, by: actor.name } : null;
        recordShift(shift, actor, {
          type: "work_updated",
          summary: done ? `Work finished: ${item.title}${evidence.length ? ` (${evidence.length} ${evidence.length === 1 ? "file" : "files"})` : ""}` : `Work reopened: ${item.title}`,
          note: done ? note : null,
        });
        return presentShift(shift);
      }
    } else {
      recordShift(shift, actor, { type: "work_updated", summary: `Work updated: ${item.title}` });
    }
    return presentShift(shift);
  },

  removeWork(id: string, workId: string, input: { version?: number }, actor: Actor) {
    const shift = findShift(id);
    assertShiftCan("manage", actor);
    assertShiftVersion(shift, input.version);
    assertShiftLive(shift);
    const item = shift.work.find((candidate) => candidate.id === workId) ?? fail(404, "NOT_FOUND", "This task could not be found.");
    shift.work = shift.work.filter((candidate) => candidate.id !== workId);
    recordShift(shift, actor, { type: "work_removed", summary: `Work removed: ${item.title}` });
    return presentShift(shift);
  },

  saveHandoverNotes(shiftId: string, notes: unknown, actor: Actor) {
    const shift = findShift(shiftId);
    assertShiftCan("handover", actor, shift);
    if (shift.state === "cancelled") fail(409, "READ_ONLY", "A cancelled shift has no handover.");
    if (shift.handover.state !== "draft") fail(409, "READ_ONLY", "Withdraw the published handover before editing the notes.");
    shift.handover.notes = text(notes);
    shift.handover.notesUpdatedAt = tick();
    return presentShift(shift);
  },

  publishHandover(shiftId: string, actor: Actor) {
    const shift = findShift(shiftId);
    assertShiftCan("handover", actor, shift);
    if (shift.state !== "in_progress" && shift.state !== "closed") fail(409, "READ_ONLY", "A handover can be published once the shift has started.");
    if (shift.handover.state !== "draft") fail(409, "READ_ONLY", "This handover is already published.");
    if (shift.handover.notes.length < 20) fail(400, "VALIDATION_ERROR", "Write handover notes of at least twenty characters before publishing.");
    shift.handover.state = "published";
    shift.handover.publishedBy = actor.name;
    shift.handover.publishedAt = tick();
    recordShift(shift, actor, { type: "handover_published", summary: "Handover published" });
    return presentShift(shift);
  },

  withdrawHandover(shiftId: string, actor: Actor) {
    const shift = findShift(shiftId);
    assertShiftCan("handover", actor, shift);
    if (shift.handover.state !== "published") fail(409, "READ_ONLY", "Only a published, unacknowledged handover can be withdrawn.");
    shift.handover.state = "draft";
    shift.handover.publishedBy = null;
    shift.handover.publishedAt = null;
    recordShift(shift, actor, { type: "handover_withdrawn", summary: "Handover withdrawn" });
    return presentShift(shift);
  },

  acknowledgeHandover(shiftId: string, actor: Actor) {
    const shift = findShift(shiftId);
    const next = presentShift(shift).next;
    assertShiftCan("acknowledge", actor, shift, next);
    if (shift.handover.state === "acknowledged") fail(409, "READ_ONLY", "This handover is already acknowledged.");
    if (shift.handover.state !== "published") fail(409, "READ_ONLY", "The outgoing supervisor must publish the handover first.");
    if (shift.handover.publishedBy === actor.name) fail(403, "FORBIDDEN", "The incoming supervisor acknowledges the handover, not the person who published it.");
    shift.handover.state = "acknowledged";
    shift.handover.acknowledgedBy = actor.name;
    shift.handover.acknowledgedAt = tick();
    recordShift(shift, actor, { type: "handover_acknowledged", summary: "Handover acknowledged" });
    return presentShift(shift);
  },

  // ---- Service providers -----------------------------------------------------------------
  listProviders: (): ServiceProvider[] => state.providers,

  createProvider(input: Record<string, unknown>, actor: Actor) {
    assertProviderManager(actor);
    const fields = checkedProvider(input);
    const provider: ServiceProvider = { id: nextId("provider", "prov"), ...fields, active: true, createdAt: tick(), version: 1 };
    state.providers = [...state.providers, provider];
    logOrganisation(actor, `Added service provider ${provider.name}`);
    return provider;
  },

  updateProvider(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertProviderManager(actor);
    const provider = findProvider(id);
    assertRecordVersion(provider, input.version);
    Object.assign(provider, checkedProvider(input, id));
    touch(provider);
    logOrganisation(actor, `Updated service provider ${provider.name}`);
    return provider;
  },

  setProviderActive(id: string, active: boolean, actor: Actor) {
    assertProviderManager(actor);
    const provider = findProvider(id);
    if (provider.active === active) fail(409, "READ_ONLY", active ? "This provider is already active." : "This provider is already deactivated.");
    provider.active = active;
    touch(provider);
    logOrganisation(actor, `${active ? "Reactivated" : "Deactivated"} service provider ${provider.name}`);
    return provider;
  },

  /** Deletes a provider only when no request refers to it. Otherwise deactivate, so the history stays whole. */
  deleteProvider(id: string, actor: Actor) {
    assertProviderManager(actor);
    const provider = findProvider(id);
    if (state.serviceRequests.some((request) => request.invites.some((invite) => invite.providerId === id))) {
      fail(409, "HAS_HISTORY", `${provider.name} appears on service requests. Deactivate them instead so the history stays whole.`);
    }
    state.providers = state.providers.filter((item) => item.id !== id);
    logOrganisation(actor, `Deleted service provider ${provider.name}`);
    return { id, deleted: true };
  },

  // ---- Service requests ------------------------------------------------------------------
  listServiceRequests: (equipmentId?: string) => state.serviceRequests.filter((item) => !equipmentId || item.equipmentId === equipmentId),
  getServiceRequest: (id: string) => findRequest(id),

  createServiceRequest(input: Record<string, unknown>, actor: Actor) {
    assertRequester(actor);
    const item = findEquipment(String(input.equipmentId ?? ""));
    assertActiveEquipment(item);
    const title = requireText(input.title, "The work required", 4);
    const urgency = ["routine", "urgent", "critical"].includes(String(input.urgency)) ? (input.urgency as ServiceRequest["urgency"]) : "routine";
    const preferredDate = checkedDate(input.preferredDate, "the preferred date");
    const planId = typeof input.planId === "string" && input.planId ? input.planId : null;
    if (planId && !item.plans.some((plan) => plan.id === planId)) fail(400, "VALIDATION_ERROR", "That maintenance plan is not on this equipment.");
    const providerIds = Array.isArray(input.providerIds) ? Array.from(new Set(input.providerIds.map(String))) : [];
    if (providerIds.length === 0) fail(400, "VALIDATION_ERROR", "Choose at least one service provider to ask.");
    const today = now();
    const at = tick();
    const invites: ServiceInvite[] = providerIds.map((providerId) => {
      const provider = findProvider(providerId);
      if (!isApproved(provider, today) || !provider.categories.includes(item.category)) {
        fail(400, "VALIDATION_ERROR", `${provider.name} is not approved to service this equipment.`);
      }
      const inviteId = nextId("invite", "inv");
      return { id: inviteId, token: replyToken(state.counters.invite), providerId: provider.id, providerName: provider.name, state: "sent", sentAt: at, declinedReason: null, quote: null };
    });
    const request: ServiceRequest = {
      id: nextId("request", "sr"),
      number: `SR-2025-${String(state.counters.request).padStart(3, "0")}`,
      equipmentId: item.id,
      planId,
      title,
      description: text(input.description),
      urgency,
      preferredDate,
      status: "open",
      invites,
      awardedInviteId: null,
      scheduledFor: null,
      completedAt: null,
      cancelledReason: null,
      createdBy: actor.name,
      createdAt: at,
      events: [],
      version: 1,
    };
    state.serviceRequests = [...state.serviceRequests, request];
    logRequest(request, actor, `Requested service from ${invites.map((invite) => invite.providerName).join(", ")}`);
    return request;
  },

  /** What a provider sees when they open their reply link. Only their own invite and the job. */
  providerView(token: string): ProviderRequestView {
    const { request, invite } = findByToken(token);
    const item = findEquipment(request.equipmentId);
    const open = request.status === "open" && invite.state !== "not_selected";
    return {
      requestNumber: request.number,
      mineName: state.company.name,
      siteName: state.site.name,
      providerName: invite.providerName,
      title: request.title,
      description: request.description,
      urgency: request.urgency,
      preferredDate: request.preferredDate,
      equipment: { code: item.code, name: item.name, makeModel: item.makeModel },
      state: invite.state,
      open,
      closedReason: open ? null : request.status === "cancelled" ? "This request was cancelled." : request.status === "open" ? "This request is no longer open." : "The mine has chosen a provider for this work.",
      quote: invite.quote,
      declinedReason: invite.declinedReason,
    };
  },

  /** The provider's own reply: a quote, or a decline. The mine never writes these. */
  providerRespond(token: string, input: Record<string, unknown>) {
    const { request, invite } = findByToken(token);
    if (request.status !== "open" || invite.state === "not_selected") fail(409, "READ_ONLY", "This request is no longer open for replies.");
    const by = { name: invite.providerName, role: "Service provider" };
    if (input.action === "decline") {
      invite.state = "declined";
      invite.declinedReason = text(input.reason) || "No reason given";
      invite.quote = null;
      logRequest(request, by, `${invite.providerName} declined`);
      return demoDomain.providerView(token);
    }
    const amountRaw = text(input.amount);
    const amount = amountRaw === "" ? null : Number(amountRaw.replace(/\s/g, ""));
    if (amount === null || Number.isNaN(amount) || amount < 0) fail(400, "VALIDATION_ERROR", "Enter your quoted amount as a number.");
    const quote: Quote = {
      amount,
      reference: text(input.reference),
      availableFrom: checkedDate(input.availableFrom, "the date you can start"),
      validUntil: checkedDate(input.validUntil, "the date your quote is valid until"),
      notes: text(input.notes),
      recordedAt: tick(),
      recordedBy: invite.providerName,
    };
    invite.quote = quote;
    invite.state = "quoted";
    invite.declinedReason = null;
    logRequest(request, by, `${invite.providerName} sent a quote`);
    return demoDomain.providerView(token);
  },

  awardInvite(requestId: string, inviteId: string, input: { version?: number }, actor: Actor) {
    assertRequester(actor);
    const request = findRequest(requestId);
    assertRequestVersion(request, input.version);
    if (request.status !== "open") fail(409, "READ_ONLY", "A provider has already been chosen for this request.");
    const invite = findInvite(request, inviteId);
    if (invite.state !== "quoted" || !invite.quote) fail(409, "VALIDATION_ERROR", "Record this provider's quote before choosing them.");
    for (const other of request.invites) {
      if (other.id === invite.id) other.state = "accepted";
      else if (other.state !== "declined") other.state = "not_selected";
    }
    request.awardedInviteId = invite.id;
    request.status = "awarded";
    logRequest(request, actor, `Chose ${invite.providerName}. This records the decision only. Nothing is ordered or paid from VESPER.`);
    return request;
  },

  scheduleRequest(requestId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertRequester(actor);
    const request = findRequest(requestId);
    assertRequestVersion(request, input.version);
    if (request.status !== "awarded" && request.status !== "scheduled") fail(409, "READ_ONLY", "Choose a provider before scheduling the work.");
    const date = checkedDate(input.date, "the date the work is booked for", true) as string;
    if (date < now().slice(0, 10)) fail(400, "VALIDATION_ERROR", "The booking cannot be in the past.");
    request.scheduledFor = date;
    request.status = "scheduled";
    logRequest(request, actor, `Work booked for ${date}`);
    return request;
  },

  /** Completing the work logs a service entry on the equipment, which also resets a linked maintenance plan. */
  completeRequest(requestId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertRequester(actor);
    const request = findRequest(requestId);
    assertRequestVersion(request, input.version);
    if (request.status !== "awarded" && request.status !== "scheduled") fail(409, "READ_ONLY", "Choose a provider before completing the work.");
    const invite = findInvite(request, request.awardedInviteId ?? "");
    const equipmentItem = findEquipment(request.equipmentId);
    demoDomain.logService(
      equipmentItem.id,
      {
        type: input.type === "repair" || input.type === "inspection" ? input.type : "service",
        summary: text(input.summary) || `${request.title}, completed by ${invite.providerName}`,
        performedAt: text(input.performedAt) || undefined,
        hours: input.hours,
        planId: request.planId,
        workOrderRef: text(input.workOrderRef) || request.number,
        version: equipmentItem.version,
      },
      actor,
    );
    request.status = "completed";
    request.completedAt = now();
    logRequest(request, actor, `Work completed by ${invite.providerName} and logged on the equipment`);
    return request;
  },

  cancelRequest(requestId: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertRequester(actor);
    const request = findRequest(requestId);
    assertRequestVersion(request, input.version);
    assertRequestLive(request);
    const reason = requireText(input.reason, "The reason", 4);
    request.status = "cancelled";
    request.cancelledReason = reason;
    logRequest(request, actor, `Request cancelled: ${reason}`);
    return request;
  },

  // ---- Organisation ----------------------------------------------------------------------
  organisation: (): OrganisationView => ({ members: state.members, company: state.company, site: state.site, activity: state.activity }),

  /** Checks a sign-in. A temporary password must be replaced before a session starts. */
  authenticate(email: string, password: string): AuthResult {
    const member = state.members.find((item) => item.email === normaliseEmail(email));
    const credential = member ? state.credentials[member.id] : undefined;
    if (!member || !credential || credential.password !== password) fail(401, "INVALID_CREDENTIALS", "That email and password do not match. Check them and try again.");
    if (member.status === "deactivated") fail(403, "ACCESS_OFF", "Your access to VESPER has been turned off. Ask your Mine Manager to restore it.");
    if (credential.temporary) return { account: null, mustChangePassword: true };
    return { account: startSession(member), mustChangePassword: false };
  },

  /** Single sign-on with a work Microsoft account: the identity provider has already checked the person, so only VESPER access is checked. */
  authenticateSso(email: string): AuthResult {
    const member = state.members.find((item) => item.email === normaliseEmail(email));
    if (!member) fail(401, "NO_ACCOUNT", "No VESPER account matches that Microsoft address. Ask your Mine Manager to add you.");
    if (member.status === "deactivated") fail(403, "ACCESS_OFF", "Your access to VESPER has been turned off. Ask your Mine Manager to restore it.");
    return { account: startSession(member), mustChangePassword: false };
  },

  /** Replaces a temporary password with one the person chose, then signs them in. */
  changePassword(email: string, current: string, next: string): AuthResult {
    const member = state.members.find((item) => item.email === normaliseEmail(email));
    const credential = member ? state.credentials[member.id] : undefined;
    if (!member || !credential || credential.password !== current) fail(401, "INVALID_CREDENTIALS", "That email and password do not match. Check them and try again.");
    if (member.status === "deactivated") fail(403, "ACCESS_OFF", "Your access to VESPER has been turned off. Ask your Mine Manager to restore it.");
    const problem = passwordProblem(next, current);
    if (problem) fail(400, "VALIDATION_ERROR", problem);
    state.credentials[member.id] = { password: next, temporary: false };
    member.mustChangePassword = false;
    touch(member);
    return { account: startSession(member), mustChangePassword: false };
  },

  /** A signed-in person changing their own password. They must know the current one. */
  changeOwnPassword(email: string, current: string, next: string) {
    const member = state.members.find((item) => item.email === normaliseEmail(email));
    const credential = member ? state.credentials[member.id] : undefined;
    if (!member || !credential || credential.password !== current) fail(401, "INVALID_CREDENTIALS", "Your current password is not correct.");
    const problem = passwordProblem(next, current);
    if (problem) fail(400, "VALIDATION_ERROR", problem);
    state.credentials[member.id] = { password: next, temporary: false };
    member.mustChangePassword = false;
    touch(member);
    logOrganisation({ name: member.name, role: member.role }, `${member.name} changed their password`);
    return { changed: true };
  },

  /** Someone updating their own contact number. Name, email and role stay with the administrator. */
  updateOwnDetails(input: Record<string, unknown>, actor: Actor) {
    const member = state.members.find((item) => item.name === actor.name) ?? fail(404, "NOT_FOUND", "Your account could not be found.");
    const phone = text(input.phone);
    if (phone.length > 40) fail(400, "VALIDATION_ERROR", "That phone number is too long.");
    member.phone = phone;
    touch(member);
    return member;
  },

  addMember(input: Record<string, unknown>, actor: Actor) {
    assertOrganisationManager(actor);
    const name = requireText(input.name, "The name", 2);
    const email = checkedEmail(input.email);
    const role = checkedRole(input.role);
    const employeeNumber = checkedEmployeeNumber(input.employeeNumber);
    if (state.members.some((member) => member.name.toLowerCase() === name.toLowerCase() && member.status !== "deactivated")) {
      fail(409, "DUPLICATE_NAME", "Someone with this name already has access. Use a distinguishing name.");
    }
    const at = tick();
    const member: Member = { id: nextId("member", "member"), name, email, role, phone: text(input.phone), employeeNumber, mustChangePassword: true, status: "invited", invitedAt: at, joinedAt: null, lastSignInAt: null, deactivatedAt: null, version: 1 };
    const temporaryPassword = newTemporaryPassword();
    state.members = [...state.members, member];
    state.credentials[member.id] = { password: temporaryPassword, temporary: true };
    logOrganisation(actor, `Added ${name} as ${role}`);
    return { member, temporaryPassword };
  },

  updateMember(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertOrganisationManager(actor);
    const member = findMember(id);
    assertRecordVersion(member, input.version);
    const changes: string[] = [];
    if (input.name !== undefined) {
      const name = requireText(input.name, "The name", 2);
      if (name !== member.name) {
        if (state.members.some((other) => other.id !== id && other.name.toLowerCase() === name.toLowerCase() && other.status !== "deactivated")) fail(409, "DUPLICATE_NAME", "Someone with this name already has access.");
        if (member.joinedAt && member.lastSignInAt) fail(409, "HAS_HISTORY", "A person who has signed in keeps the name on their records.");
        changes.push(`name to ${name}`);
        member.name = name;
      }
    }
    if (input.email !== undefined) {
      const email = checkedEmail(input.email, id);
      if (email !== member.email) {
        changes.push("email address");
        member.email = email;
      }
    }
    if (input.phone !== undefined && text(input.phone) !== member.phone) {
      member.phone = text(input.phone);
      changes.push("phone number");
    }
    if (input.employeeNumber !== undefined) {
      const employeeNumber = checkedEmployeeNumber(input.employeeNumber, id);
      if (employeeNumber !== member.employeeNumber) {
        member.employeeNumber = employeeNumber;
        changes.push("employee number");
      }
    }
    if (input.role !== undefined) {
      const role = checkedRole(input.role);
      if (role !== member.role) {
        if (member.name === actor.name) fail(409, "OWN_ACCOUNT", "You cannot change your own role. Ask another Mine Manager.");
        if (isLastManager(state.members, member)) fail(409, "LAST_MANAGER", "VESPER needs at least one active Mine Manager. Promote someone else first.");
        changes.push(`role to ${role}`);
        member.role = role;
      }
    }
    if (changes.length === 0) fail(400, "VALIDATION_ERROR", "Nothing was changed.");
    touch(member);
    logOrganisation(actor, `Changed ${member.name}: ${changes.join(", ")}`);
    return member;
  },

  setMemberAccess(id: string, access: "on" | "off", actor: Actor) {
    assertOrganisationManager(actor);
    const member = findMember(id);
    if (access === "off") {
      if (member.status === "deactivated") fail(409, "READ_ONLY", "This person's access is already off.");
      if (member.name === actor.name) fail(409, "OWN_ACCOUNT", "You cannot turn off your own access.");
      if (isLastManager(state.members, member)) fail(409, "LAST_MANAGER", "VESPER needs at least one active Mine Manager. Promote someone else first.");
      member.status = "deactivated";
      member.deactivatedAt = tick();
      logOrganisation(actor, `Turned off access for ${member.name}`);
    } else {
      if (member.status !== "deactivated") fail(409, "READ_ONLY", "This person already has access.");
      member.status = member.joinedAt ? "active" : "invited";
      member.deactivatedAt = null;
      logOrganisation(actor, `Restored access for ${member.name}`);
    }
    return touch(member);
  },

  /** Issues a temporary password. Nobody can read an existing password, so a reset is the only way in. */
  resetPassword(id: string, actor: Actor) {
    assertOrganisationManager(actor);
    const member = findMember(id);
    if (member.status === "deactivated") fail(409, "READ_ONLY", "Restore this person's access before resetting their password.");
    if (member.name === actor.name) fail(409, "OWN_ACCOUNT", "You cannot reset your own password here.");
    const temporaryPassword = newTemporaryPassword();
    state.credentials[member.id] = { password: temporaryPassword, temporary: true };
    member.mustChangePassword = true;
    touch(member);
    logOrganisation(actor, `Reset the password for ${member.name}`);
    return { member, temporaryPassword };
  },

  /** Deletes an employee only when nothing in VESPER refers to them. Otherwise they are deactivated so records stay whole. */
  deleteMember(id: string, actor: Actor) {
    assertOrganisationManager(actor);
    const member = findMember(id);
    if (member.name === actor.name) fail(409, "OWN_ACCOUNT", "You cannot delete your own account.");
    if (isLastManager(state.members, member)) fail(409, "LAST_MANAGER", "VESPER needs at least one active Mine Manager. Promote someone else first.");
    if (member.lastSignInAt || memberHasRecords(member.name)) fail(409, "HAS_HISTORY", `${member.name} appears in shifts, issues or equipment records. Turn off access instead so the records stay whole.`);
    state.members = state.members.filter((item) => item.id !== id);
    delete state.credentials[id];
    logOrganisation(actor, `Deleted ${member.name}`);
    return { id, deleted: true };
  },

  updateCompany(input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertOrganisationManager(actor);
    assertRecordVersion(state.company, input.version);
    const name = requireText(input.name, "The company name", 2);
    const contactEmail = text(input.contactEmail);
    if (contactEmail && !isValidEmail(contactEmail)) fail(400, "VALIDATION_ERROR", "Enter a valid contact email address.");
    state.company = touch({
      ...state.company,
      name,
      industry: text(input.industry),
      registration: text(input.registration),
      address: text(input.address),
      contactName: text(input.contactName),
      contactEmail,
      contactPhone: text(input.contactPhone),
    });
    logOrganisation(actor, "Updated company details");
    return state.company;
  },

  updateSite(input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertOrganisationManager(actor);
    assertRecordVersion(state.site, input.version);
    const name = requireText(input.name, "The site name", 2);
    state.site = touch({
      ...state.site,
      name,
      type: text(input.type),
      commodity: text(input.commodity),
      location: text(input.location),
      timezone: text(input.timezone),
      operatingHours: text(input.operatingHours),
      siteContact: text(input.siteContact),
    });
    state.context.siteName = name;
    logOrganisation(actor, "Updated site details");
    return state.site;
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
