/**
 * The in-browser domain store: the prototype's stand-in for a backend database and its business rules.
 * It holds every record (issues, equipment, shifts, people, providers, service requests), applies each change as one transaction,
 * enforces permissions and version checks, and persists to localStorage under a single versioned key so a refresh keeps the work.
 * The mock handlers (src/mocks/handlers.ts) are a thin HTTP layer over the functions exported here.
 *
 * Guidance when changing it: validate and authorise first, then mutate, then record an event or audit entry, then save. Fail with
 * a DemoError (it carries a code) rather than a thrown string, so screens can tell a conflict from a permission problem. Bump the
 * storage key when the stored shape changes, so old browsers start clean instead of loading a shape the code no longer reads.
 */
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
  DEMO_NOW,
  equipment,
  infrastructureAssets,
  notifications,
  primaryIssue,
  readinessActivity,
  secondaryIssue,
  shifts,
} from "./demo-data";
import type { CollectionRequest, MeasurementBasis, PriceRecord, PricingSource, ProductionEvent, ProductionRecord, Shipment, ShipmentEvent, StockMovement, Transporter, ValueSnapshot } from "@vesper/api-contracts";
import { blank as blankQuote, seedAgreements, seedCharges, seedCoalMovements, seedCoalShipment, seedCoalStockpile, seedEarlierDeliveries, seedProviders as seedTransportProviders, seedRequests as seedQuoteRequests, transportCounters } from "./transport-data";
import {
  COLLECTION_POINT,
  TRANSPORT_DEMO_DATE,
  TRANSPORT_DEMO_PERIOD,
  approvalLabels,
  canActOnTransport,
  chargeAmount,
  chargePeriods,
  eligibleAgreements,
  formatRand,
  periodName,
  quoteStatusNow,
  quoteTotal,
  type Agreement,
  type AgreementCharge,
  type AgreementPricingMethod,
  type AllowancePeriod,
  type Billing,
  type EarlierDelivery,
  type FeePeriod,
  type Quote as TransportQuote,
  type QuoteRequest,
  type Rollover,
  type TransportCapability,
  type Vat,
} from "./transport-rules";
import { GOLD_ACTIVITY_ID, GOLD_EQUIPMENT_ID, GOLD_ISSUE_ID, goldEquipment, goldIssue, goldReadiness, seedImpactScenario } from "./impact-data";
import type { AssetCondition } from "@vesper/api-contracts";
import { automationCatalogue, defaultRules, definitionOf, evaluate, recipientRoles, type AutomationRecipient, type AutomationRule, type AutomationRun, type Finding } from "./automation-rules";
import { buildBriefing, canReviewBriefing, changedSinceApproval, effectiveLines, reviewMessage, type BriefingRecord } from "./intelligence-rules";
import { calculateImpact, canActOnImpact, plannedSalesValue, type ImpactCapability, type ImpactChange, type ImpactScenario, type ImpactSnapshot } from "./impact-rules";
import { seedFinance, seedMovements, seedPrices, seedProduction, seedRequests as seedCollectionRequests, seedShipments, seedStockpiles, seedValueHistory, shipmentCounters } from "./shipment-data";
import { OWN_FLEET_ID, OWN_FLEET_NAME, assignedTonnes, earliestCollection, fleetCategories, fleetProblems, windowsOverlap, type FleetAlert, type FleetVehicle } from "./fleet-rules";
import { CURRENCY, PRICE_BASIS, QUANTITY_BASIS, canActOnShipments, canCancel, checkDifference, currentPrice, formatMoney, formatTonnes, readinessProblems, shiftTargetTonnes, shipmentFigures, shipmentValue, shortDate, stockPosition, type ShipmentCapability } from "./shipment-rules";
import { demoTimeAt, formatDemoDateTime, formatDemoTime } from "./demo-clock";
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
  assetKindOf,
  canActOnEquipment,
  categories,
  infrastructureGroupOf,
  isValidCode,
  mostUrgent,
  normaliseCode,
  planStatus,
  type EquipmentCapability,
  type EquipmentView,
} from "./equipment-rules";
import type { Account } from "./accounts";
import { seedProviders, seedRequests } from "./service-data";
import { canApproveProviders, canManageProviders, canRequestService, isApproved } from "./service-rules";
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

/**
 * A failed request. `status` is the HTTP status the mock API returns; `code` lets a screen tell cases apart
 * (NOT_FOUND, FORBIDDEN, VALIDATION_ERROR, VERSION_CONFLICT, READ_ONLY); `message` is plain words for the person.
 */
export class DemoError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Throws a DemoError. Typed `never`, so it can end an expression: `return found ?? fail(404, ...)`. */
function fail(status: number, code: string, message: string): never {
  throw new DemoError(status, code, message);
}

type DemoNotification = (typeof notifications)[number] & { recipient: string | null };

/** A deep copy, so seed data is never shared with (or changed through) the working state. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Everything the store holds, seeded from demo-data.ts, organisation-data.ts and service-data.ts. `clock` counts writes
 * (see tick). `counters` give each kind of record its next readable id (for example issue-043), so ids are stable.
 */
const initialState = {
  context: defaultContext,
  issues: [primaryIssue, secondaryIssue, goldIssue],
  areas,
  readiness: [readinessActivity, goldReadiness],
  equipment: [...equipment, goldEquipment, ...infrastructureAssets],
  shifts,
  members: seedMembers,
  providers: seedProviders,
  serviceRequests: seedRequests,
  credentials: seedCredentials,
  company: seedCompany,
  site: seedSite,
  activity: seedActivity,
  notifications: notifications.map((item): DemoNotification => ({ ...item, recipient: null })),
  stockpiles: [...seedStockpiles, seedCoalStockpile],
  movements: [...seedMovements, ...seedCoalMovements],
  production: seedProduction,
  shipments: [...seedShipments, seedCoalShipment],
  requests: seedCollectionRequests,
  transporters: seedTransportProviders,
  /** Quote requests with the provider quotes recorded on them, transport agreements, their recorded fees and earlier deliveries. */
  quoteRequests: seedQuoteRequests,
  agreements: seedAgreements,
  charges: seedCharges as AgreementCharge[],
  earlierDeliveries: seedEarlierDeliveries as EarlierDelivery[],
  /** The Gold demonstration's scenario and the history of changes to its estimate. */
  impact: seedImpactScenario,
  impactHistory: [] as ImpactChange[],
  briefings: [] as BriefingRecord[],
  automations: defaultRules() as AutomationRule[],
  automationRuns: [] as AutomationRun[],
  /** Every version of every price, and every value a shipment has had. Nothing here is ever overwritten. */
  prices: seedPrices,
  finance: seedFinance,
  valueHistory: seedValueHistory,
  /** Submission ids already accepted, so a repeated submission is refused instead of saved twice. */
  submissions: [] as string[],
  clock: 0,
  counters: { issue: 42, action: 4, dependency: 1, comment: 0, event: 200, review: 0, notification: 3, plan: 3, service: 3, equipmentEvent: 10, shift: 4, crew: 3, work: 4, shiftEvent: 20, member: 7, activity: 0, credential: 0, provider: 12, request: 0, invite: 0, requestEvent: 0, ...shipmentCounters, ...transportCounters },
};

export type DemoDomainState = typeof initialState;

/** The localStorage key for the whole store. Change the suffix when the stored shape changes, so old browsers start clean. */
const STORAGE_KEY = "vesper-demo-state-v13";

/** Keeps the records across a page refresh and between tabs, so a provider's reply page sees the same request. Reset clears them. */
function loadState(): DemoDomainState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoDomainState>;
    const valid = Array.isArray(parsed.issues) && typeof parsed.clock === "number" && Array.isArray(parsed.equipment) && parsed.equipment.every((item) => Array.isArray(item.plans)) && Array.isArray(parsed.shifts) && parsed.shifts.every((item) => Array.isArray(item.crew)) && Array.isArray(parsed.members) && Array.isArray(parsed.providers) && Array.isArray(parsed.serviceRequests) && Boolean(parsed.credentials) && parsed.members.every((item) => typeof item.phone === "string") && Boolean(parsed.company) && Boolean(parsed.site) && Array.isArray(parsed.briefings) && Array.isArray(parsed.automations) && Array.isArray(parsed.automationRuns) && Array.isArray(parsed.shipments) && parsed.shipments.every((item) => Boolean(item.fleet)) && Array.isArray(parsed.production) && Array.isArray(parsed.movements) && Array.isArray(parsed.requests) && Array.isArray(parsed.transporters) && Array.isArray(parsed.stockpiles) && Array.isArray(parsed.submissions) && Array.isArray(parsed.prices) && Array.isArray(parsed.finance) && Array.isArray(parsed.valueHistory) && Boolean(parsed.impact) && Array.isArray(parsed.impactHistory) && Array.isArray(parsed.quoteRequests) && Array.isArray(parsed.agreements) && Array.isArray(parsed.charges);
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

/** The working state: restored from localStorage if it is valid, otherwise a copy of the seed. Mutated in place by demoDomain. */
let state: DemoDomainState = loadState() ?? clone(initialState);

// When another tab saves, take its version so this tab never overwrites a provider's reply.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const next = loadState();
    if (next) state = next;
  });
}

/**
 * Domain time. It starts at the scenario's fixed 'now' and moves on one minute for every change (tick), so events from one
 * session are always in order and never share a timestamp. Nothing here reads the real clock.
 */
const now = () => demoTimeAt(state.clock);
const tick = () => {
  state.clock += 1;
  return now();
};
/** The next readable id for a kind of record, for example nextId('issue', 'issue-riv') gives 'issue-riv-043'. */
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

/** Finds a record, or fails with 404. The find* helpers below do the same for each kind of record. */
function findIssue(id: string) {
  const issue = state.issues.find((item) => item.id === id);
  return issue ?? fail(404, "NOT_FOUND", "This issue could not be found.");
}

/** Finished issues are read-only history. The person must reopen one before changing it. */
function assertEditable(issue: OperationalIssue) {
  if (isFinished(issue.workflowState)) {
    fail(409, "READ_ONLY", `${stateLabels[issue.workflowState]} issues are read-only history.${issue.workflowState === "closed" ? " Reopen the issue to change it." : ""}`);
  }
}

/**
 * Optimistic concurrency. The screen sends the `version` it loaded; if the record has changed since, the change is refused
 * with VERSION_CONFLICT rather than silently overwriting someone else's edit. Every change bumps `version`.
 * The assert*Version helpers for equipment, shifts, requests and records work the same way.
 */
function assertVersion(issue: OperationalIssue, version: number | undefined) {
  if (version !== undefined && version !== issue.version) {
    fail(409, "VERSION_CONFLICT", "This issue changed while you were editing. Reload to see the latest version, then try again.");
  }
}

/** The role check from issue-rules.ts, turned into a 403. The same function drives the interface, so they cannot disagree. */
function assertCan(capability: Parameters<typeof canAct>[0], actor: Actor, issue?: OperationalIssue) {
  const check = canAct(capability, actor, issue);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You do not have access to this step.");
}

/**
 * Appends an event to an issue's history and bumps its version. Every issue change goes through here, so the history
 * (who, what, when, from which state to which) is complete. recordEquipment, recordShift, logRequest and logOrganisation
 * do the same for their records.
 */
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

/** Adds a notification for one person, or for everyone when `recipient` is null. Newest first. */
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

/** Trims a value and requires a minimum length, failing with a VALIDATION_ERROR that names the field. */
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

function checkedResponsible(value: unknown) {
  const name = text(value);
  if (!name) return null;
  if (!ownerNames().includes(name)) fail(400, "VALIDATION_ERROR", "Choose a responsible person from the list.");
  return name;
}

function checkedCondition(value: unknown): AssetCondition {
  if (value === undefined || value === null || value === "") return "unknown";
  if (value !== "good" && value !== "needs_attention" && value !== "unknown") fail(400, "VALIDATION_ERROR", "Choose a condition.");
  return value;
}

/** The assets an asset depends on. Each must exist and be active; an asset cannot depend on itself, directly or through a chain. */
function checkedDependencies(value: unknown, selfId: string): string[] {
  const ids = Array.isArray(value) ? [...new Set(value.map(String))] : [];
  for (const id of ids) {
    if (id === selfId) fail(400, "VALIDATION_ERROR", "An asset cannot depend on itself.");
    const found = state.equipment.find((item) => item.id === id);
    if (!found) fail(400, "VALIDATION_ERROR", "A dependency is not in the register.");
    if (found.retiredAt) fail(409, "READ_ONLY", `${found.code} is retired, so nothing can depend on it.`);
    // Following the chain from the dependency must never lead back here.
    const seen = new Set<string>();
    const walk = (current: string): boolean => {
      if (current === selfId) return true;
      if (seen.has(current)) return false;
      seen.add(current);
      return (state.equipment.find((item) => item.id === current)?.dependsOn ?? []).some(walk);
    };
    if (walk(id)) fail(400, "VALIDATION_ERROR", `${found.code} already depends on this asset, so this would go in a circle.`);
  }
  return ids;
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

/**
 * Adds the worked-out fields to an equipment record for the screens: maintenance status per plan, what blocks retirement,
 * and so on. Stored equipment is never changed by presenting it.
 */
function presentEquipment(item: Equipment): EquipmentView {
  const current = now();
  const brief = (other: Equipment) => ({ id: other.id, code: other.code, name: other.name, state: other.state });
  const maintenance = item.plans.map((plan) => planStatus(plan, item, current));
  return {
    ...item,
    kind: assetKindOf(item.category),
    group: infrastructureGroupOf[item.category] ?? null,
    dependents: state.equipment.filter((other) => !other.retiredAt && other.dependsOn.includes(item.id)).map(brief),
    dependencies: item.dependsOn.map((id) => state.equipment.find((other) => other.id === id)).filter((other): other is Equipment => Boolean(other)).map(brief),
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

/** Adds the worked-out fields to a shift for the screens, for example its neighbouring shifts and unresolved items. */
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

/** What stops a provider being deleted: records that refer to it. Empty means it can be removed. */
function providerReferences(id: string): string[] {
  const requests = state.serviceRequests.filter((request) => request.invites.some((invite) => invite.providerId === id)).map((request) => request.number);
  return requests.length > 0 ? [`repair request${requests.length === 1 ? "" : "s"} ${requests.join(", ")}`] : [];
}

function findProvider(id: string) {
  return state.providers.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This service provider could not be found.");
}

function findRequest(id: string) {
  return state.serviceRequests.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This service request could not be found.");
}

function checkedProvider(input: Record<string, unknown>, selfId?: string) {
  const existing = selfId ? state.providers.find((item) => item.id === selfId) : undefined;
  const name = requireText(input.name, "The company name", 3);
  if (state.providers.some((item) => item.id !== selfId && item.name.toLowerCase() === name.toLowerCase())) fail(409, "DUPLICATE_NAME", "A provider with this name is already on the list.");
  const registration = text(input.registration);
  if (registration && state.providers.some((item) => item.id !== selfId && item.registration && item.registration.toLowerCase() === registration.toLowerCase())) fail(409, "DUPLICATE_NAME", "A provider with this registration number is already on the list.");
  const email = text(input.email);
  if (email && !isValidEmail(email)) fail(400, "VALIDATION_ERROR", "Enter a valid email address, or leave it blank.");
  const chosen = Array.isArray(input.categories) ? input.categories.map(String) : [];
  if (chosen.length === 0) fail(400, "VALIDATION_ERROR", "Choose at least one kind of equipment or infrastructure they service.");
  if (chosen.some((category) => !(categories as string[]).includes(category))) fail(400, "VALIDATION_ERROR", "One of the equipment types is not recognised.");
  const approvedUntil = text(input.approvedUntil);
  if (approvedUntil && !/^\d{4}-\d{2}-\d{2}$/.test(approvedUntil)) fail(400, "VALIDATION_ERROR", "Enter the approval end date as a date, or leave it blank.");
  const has = (key: string) => key in input;
  const specialisation = has("specialisation") ? text(input.specialisation).slice(0, 160) : existing?.specialisation ?? "";
  const serviceAreas = has("serviceAreas") ? (Array.isArray(input.serviceAreas) ? input.serviceAreas.map(String) : text(input.serviceAreas).split(",")).map((item) => item.trim()).filter(Boolean).slice(0, 12) : existing?.serviceAreas ?? [state.site.name];
  let responseHours: number | null = existing?.responseHours ?? null;
  if (has("responseHours")) {
    if (input.responseHours === "" || input.responseHours === null) responseHours = null;
    else {
      const parsed = Number(input.responseHours);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 720) fail(400, "VALIDATION_ERROR", "Enter the response time in hours, more than 0, or leave it blank.");
      responseHours = parsed;
    }
  }
  const documents = has("documents") ? (Array.isArray(input.documents) ? input.documents : []).map((item) => ({ name: text((item as { name?: unknown }).name).slice(0, 120), sizeLabel: text((item as { sizeLabel?: unknown }).sizeLabel).slice(0, 20) })).filter((item) => item.name).slice(0, 10) : existing?.documents ?? [];
  return { name, registration, contactName: text(input.contactName), email, phone: text(input.phone), categories: chosen as EquipmentCategory[], approvedUntil, notes: text(input.notes), specialisation, serviceAreas, responseHours, documents };
}

/** What changed between two versions of a provider's details, in words, for the audit history. */
function describeProviderChanges(before: ServiceProvider, after: ReturnType<typeof checkedProvider>) {
  const labels: [string, string][] = [["name", "company name"], ["registration", "registration number"], ["contactName", "contact person"], ["email", "email"], ["phone", "phone"], ["specialisation", "specialisation"], ["categories", "categories"], ["serviceAreas", "service areas"], ["responseHours", "response time"], ["documents", "documents"], ["approvedUntil", "approval end date"], ["notes", "notes"]];
  return labels.filter(([key]) => JSON.stringify(before[key as keyof ServiceProvider]) !== JSON.stringify(after[key as keyof typeof after])).map(([, label]) => label);
}

function recordProvider(provider: ServiceProvider, actor: Actor, summary: string, note: string | null = null) {
  provider.history = [...provider.history, { id: nextId("providerEvent", "prh"), at: tick(), actor: actor.name, summary, note }];
}

/** A link only the provider holds. In this build it identifies the invite; real access control arrives with the backend. */
function replyToken(n: number) {
  return `r${n.toString(36)}${(Math.imul(n + 7, 2654435761) >>> 0).toString(36)}${(Math.imul(n + 31, 40503) >>> 0).toString(36)}`;
}

/** A provider's reply link carries a token instead of a sign-in; the token finds the one invitation it belongs to. */
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

// ---- Production, inventory and shipment helpers ---------------------------------------------

/** A readable number such as SHP-0049: the prefix, then a four digit sequence. */
function nextNumber(key: "shipment" | "production" | "collection" | "quoteRequest" | "agreement", prefix: string) {
  const taken = new Set([...state.shipments.map((item) => item.number), ...state.requests.map((item) => item.number), ...state.production.map((item) => item.number), ...state.quoteRequests.map((item) => item.number), ...state.agreements.map((item) => item.number)]);
  let value = "";
  do {
    state.counters[key] += 1;
    value = `${prefix}-${String(state.counters[key]).padStart(4, "0")}`;
  } while (taken.has(value));
  return value;
}

/**
 * Stops a repeated submission (a double click, a retried request) from creating a second record. The screen sends one
 * `submissionId` for each form it opens. A request whose id was already saved is refused. The id is remembered only by calling
 * the returned function once the change has succeeded, so a form that failed validation can be corrected and sent again.
 */
function guardRepeat(input: Record<string, unknown>): () => void {
  const id = text(input.submissionId);
  if (!id) return () => {};
  if (state.submissions.includes(id)) fail(409, "DUPLICATE", "This was already saved. Refresh the page to see it.");
  return () => {
    state.submissions = [...state.submissions.slice(-199), id];
  };
}

function findProduction(id: string) {
  return state.production.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This production record could not be found.");
}
function findShipment(id: string) {
  return state.shipments.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This shipment could not be found.");
}
function findStockpile(id: unknown) {
  return state.stockpiles.find((item) => item.id === id) ?? fail(400, "VALIDATION_ERROR", "Choose a stockpile from the list.");
}
function findTransporter(id: unknown) {
  return state.transporters.find((item) => item.id === id) ?? fail(400, "VALIDATION_ERROR", "Choose a transporter from the list.");
}
function requestFor(shipment: Shipment) {
  return shipment.requestId ? state.requests.find((item) => item.id === shipment.requestId) ?? null : null;
}

function assertShipmentsCan(capability: ShipmentCapability, actor: Actor, reportedBy?: string) {
  const check = canActOnShipments(capability, actor, reportedBy);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You do not have access to this step.");
}
function assertShipmentVersion(shipment: Shipment, version: unknown) {
  if (typeof version === "number" && version !== shipment.version) fail(409, "VERSION_CONFLICT", "This shipment changed while you were editing. Reload to see the latest version, then try again.");
}
function assertProductionVersion(record: ProductionRecord, version: unknown) {
  if (typeof version === "number" && version !== record.version) fail(409, "VERSION_CONFLICT", "This record changed while you were editing. Reload to see the latest version, then try again.");
}

/** Adds a line to the stock ledger. Every balance in VESPER is worked out from these lines. */
function addMovement(type: StockMovement["type"], stockpileId: string, tonnes: number, ref: string, actor: Actor, note: string | null = null) {
  if (tonnes <= 0) return;
  state.movements = [...state.movements, { id: nextId("movement", "mv"), at: tick(), type, stockpileId, tonnes, ref, actor: actor.name, note }];
}

/** The finance record for a shipment, if finance has one. */
function financeFor(shipmentId: string) {
  return state.finance.find((item) => item.shipmentId === shipmentId) ?? null;
}

/**
 * Appends what a shipment is worth right now to its value history. The history is only ever added to, so the original estimate and
 * every later figure (a new price, a dispatch, finance settling) can be traced. Internal transfers have no value to record.
 */
function snapshotValue(shipment: Shipment, reason: ValueSnapshot["reason"], actor: Actor) {
  if (shipment.kind !== "sale") return;
  const price = currentPrice(state.prices, shipment.orderRef);
  const value = shipmentValue(shipment, price, financeFor(shipment.id));
  state.valueHistory = [
    ...state.valueHistory,
    { id: nextId("valueSnapshot", "vs"), shipmentId: shipment.id, at: tick(), actor: actor.name, reason, priceId: value.price?.id ?? null, pricePerTonne: value.price?.pricePerTonne ?? null, quantityTonnes: value.quantity, amount: value.amount, status: value.status },
  ];
}

// ---- Impact ("What happens if we wait?") helpers -----------------------------------------------

const impactResultOf = (scenario: ImpactScenario) =>
  calculateImpact({ outageHours: scenario.outageHours, usableStockTonnes: scenario.usableStockTonnes, catchUpTonnes: scenario.catchUpTonnes, recoveredGrams: scenario.recoveredGrams });

/** What the estimate says right now. `withValue` is false for people who may not see money, so no rand figure is ever stored for them. */
function impactSnapshot(scenario: ImpactScenario, withValue: boolean): ImpactSnapshot {
  const result = impactResultOf(scenario);
  return {
    outageHours: scenario.outageHours,
    usableStockTonnes: scenario.usableStockTonnes,
    catchUpTonnes: scenario.catchUpTonnes,
    recoveredGrams: scenario.recoveredGrams,
    goldAffectedGrams: result.goldAffectedGrams,
    forecastGrams: result.forecastGrams,
    valueDelayed: withValue ? result.valueDelayed : null,
  };
}

/** Adds a line to the estimate's history: what it was, what it is now, why, and who changed it. Never edited afterwards. */
function logImpact(kind: ImpactChange["kind"], reason: string, actor: Actor, previous: ImpactSnapshot) {
  state.impactHistory = [
    ...state.impactHistory,
    { id: nextId("impactChange", "imp"), at: tick(), actor: actor.name, actorRole: actor.role, kind, reason, previous, revised: impactSnapshot(state.impact, true) },
  ];
}

function hoursOf(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 72) fail(400, "VALIDATION_ERROR", `${label} must be between 0 and 72 hours.`);
  return Math.round(parsed * 100) / 100;
}

function stockOf(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000) fail(400, "VALIDATION_ERROR", `${label} must be a number of tonnes, 0 or more.`);
  return Math.round(parsed * 100) / 100;
}

function assertImpactCan(capability: ImpactCapability, actor: Actor) {
  const check = canActOnImpact(capability, actor);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You do not have access to this step.");
}

/** Everything the screens need about the Gold demonstration, from the one set of records and the one calculation. */
function buildImpact(actor?: Actor) {
  const scenario = state.impact;
  const showValue = Boolean(actor && canActOnShipments("view_value", actor).allowed);
  const result = impactResultOf(scenario);
  const equipment = state.equipment.find((item) => item.id === scenario.equipmentId);
  const issue = state.issues.find((item) => item.id === scenario.issueId);
  const activity = state.readiness.find((item) => item.id === scenario.activityId);
  const part = activity?.parts[0] ?? null;
  const repair = issue ? activeActions(issue).find((action) => action.state !== "complete") ?? null : null;
  const expectedMinutes = scenario.outageHours === null ? null : (Date.parse(scenario.breakdownStartedAt) + scenario.outageHours * 3_600_000 - Date.parse(DEMO_NOW)) / 60_000;
  return {
    now: now(),
    scenario,
    result: showValue ? result : { ...result, valueDelayed: null },
    canSeeValue: showValue,
    plannedValue: showValue ? plannedSalesValue : null,
    // The expected finish is the breakdown start plus the estimated outage, or the recorded finish once the repair is complete.
    expectedRepairCompletion: scenario.repairCompletedAt ?? (expectedMinutes === null ? null : demoTimeAt(expectedMinutes)),
    equipment: equipment ? { id: equipment.id, code: equipment.code, name: equipment.name, state: equipment.state, stateNote: equipment.stateNote } : null,
    issue: issue ? { id: issue.id, number: issue.issueNumber, title: issue.title, owner: issue.owner, state: issue.workflowState } : null,
    repair: repair ? { title: repair.title, owner: repair.owner, dueAt: repair.dueAt, state: repair.state } : null,
    part: part ? { name: part.name, required: part.required, onHand: part.onHand, inbound: part.inbound, quality: part.quality, note: part.sourceNote } : null,
    history: state.impactHistory.map((entry) => (showValue ? entry : { ...entry, previous: { ...entry.previous, valueDelayed: null }, revised: { ...entry.revised, valueDelayed: null } })),
    can: { update: Boolean(actor && canActOnImpact("update_impact", actor).allowed), recover: Boolean(actor && canActOnImpact("record_recovery", actor).allowed) },
  };
}

// ---- Service provider, quote and agreement helpers ------------------------------------------

function assertTransportCan(capability: TransportCapability, actor: Actor) {
  const check = canActOnTransport(capability, actor);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You do not have access to this step.");
}

function findQuoteRequest(id: unknown) {
  return state.quoteRequests.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This quote request could not be found.");
}
function findAgreement(id: unknown) {
  return state.agreements.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", "This agreement could not be found.");
}

/** A calendar date typed as yyyy-mm-dd. */
function dateOf(value: unknown, label: string) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) fail(400, "VALIDATION_ERROR", `${label} must be a date.`);
  return date;
}

function readAttachments(value: unknown): { name: string; sizeLabel: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 5)
    .map((item) => item as { name?: unknown; sizeLabel?: unknown })
    .filter((item) => typeof item.name === "string" && item.name.trim() !== "")
    .map((item) => ({ name: String(item.name).trim().slice(0, 120), sizeLabel: typeof item.sizeLabel === "string" ? item.sizeLabel.slice(0, 20) : "" }));
}

function readProviderFields(input: Record<string, unknown>) {
  const areas = Array.isArray(input.areasServed) ? input.areasServed.map(String) : text(input.areasServed).split(",");
  const email = text(input.email);
  if (email && !isValidEmail(normaliseEmail(email))) fail(400, "VALIDATION_ERROR", "Enter a valid email address, or leave it empty.");
  return {
    mode: requireText(input.mode, "The service type", 3),
    serviceNote: text(input.serviceNote).slice(0, 120),
    areasServed: areas.map((item) => item.trim()).filter(Boolean).slice(0, 12),
    contactPerson: text(input.contactPerson).slice(0, 120),
    email,
    phone: text(input.phone).slice(0, 40),
    notes: text(input.notes).slice(0, 600),
    attachments: readAttachments(input.attachments),
  };
}

/** Reads the terms of an agreement from a form. Missing prices are allowed in a draft and shown honestly; confirming needs them. */
function readAgreementFields(input: Record<string, unknown>) {
  const provider = findTransporter(input.providerId);
  const methods = ["fixed_fee", "unit_rate", "fixed_plus_usage", "manual_estimate"];
  const method = text(input.method) || "fixed_fee";
  if (!methods.includes(method)) fail(400, "VALIDATION_ERROR", "Choose how the agreement is priced.");
  const startDate = dateOf(input.startDate, "The start date");
  const endDate = dateOf(input.endDate, "The end date");
  if (endDate < startDate) fail(400, "VALIDATION_ERROR", "The end date cannot be before the start date.");
  const number = (value: unknown, label: string) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) fail(400, "VALIDATION_ERROR", `${label} must be a number, 0 or more.`);
    return parsed;
  };
  const estimate = input.manualEstimate as { amount?: unknown; period?: unknown; note?: unknown } | null | undefined;
  let manualEstimate: Agreement["manualEstimate"] = null;
  if (method === "manual_estimate") {
    const amount = Number(estimate?.amount);
    if (!estimate || !Number.isFinite(amount) || amount <= 0) fail(400, "VALIDATION_ERROR", "A manual estimate needs an amount, more than 0.");
    manualEstimate = { amount, period: (["month", "year", "agreement"].includes(String(estimate.period)) ? estimate.period : "month") as FeePeriod, note: requireText(estimate.note, "The note about the estimate", 3) };
  }
  const document = input.document as { name?: unknown; sizeLabel?: unknown } | null | undefined;
  const feePeriod = (["month", "year", "agreement"].includes(text(input.feePeriod)) ? text(input.feePeriod) : "month") as FeePeriod;
  return {
    providerId: provider.id,
    reference: requireText(input.reference, "The agreement reference", 2),
    document: document && typeof document.name === "string" && document.name.trim() ? { name: document.name.trim().slice(0, 120), sizeLabel: typeof document.sizeLabel === "string" ? document.sizeLabel.slice(0, 20) : "" } : null,
    material: requireText(input.material, "The material", 3),
    from: requireText(input.from, "The collection point", 3),
    to: requireText(input.to, "The destination", 3),
    service: requireText(input.service, "The transport service", 3),
    startDate,
    endDate,
    renewal: text(input.renewal).slice(0, 300),
    method: method as AgreementPricingMethod,
    fee: number(input.fee, "The fee or rate"),
    feePeriod: method === "unit_rate" ? ("agreement" as FeePeriod) : feePeriod,
    billing: (input.billing === "yearly" ? "yearly" : input.billing === "custom" ? "custom" : "monthly") as Billing,
    invoiceTiming: text(input.invoiceTiming).slice(0, 200),
    paymentTerms: text(input.paymentTerms).slice(0, 200),
    includedTonnes: number(input.includedTonnes, "The included quantity"),
    allowancePeriod: (input.allowancePeriod === "agreement" ? "agreement" : "calendar_month") as AllowancePeriod,
    excessRate: number(input.excessRate, "The excess charge"),
    // A minimum commitment is only recorded when the agreement explicitly has one. It is never assumed or inferred.
    minimumCommitment: text(input.minimumCommitment) || null,
    rollover: (input.rollover === "carry_forward" ? "carry_forward" : "none") as Rollover,
    included: text(input.included).slice(0, 300),
    excluded: text(input.excluded).slice(0, 300),
    vat: (input.vat === "included" ? "included" : input.vat === "not_stated" ? "not_stated" : "excluded") as Vat,
    manualEstimate,
    sourceQuoteId: text(input.sourceQuoteId) || null,
  };
}

/** What changed between two versions of an agreement's terms, in plain words, for its history. */
function describeAgreementChanges(before: Agreement, after: ReturnType<typeof readAgreementFields>): string[] {
  const show = (value: unknown) => (value === null || value === undefined || value === "" ? "not set" : typeof value === "number" ? new Intl.NumberFormat("en-GB").format(value) : typeof value === "object" ? JSON.stringify(value) : String(value));
  const fields: [keyof typeof after, string][] = [
    ["providerId", "Provider"], ["reference", "Reference"], ["material", "Material"], ["from", "Collection point"], ["to", "Destination"], ["service", "Service"], ["startDate", "Start date"], ["endDate", "End date"],
    ["renewal", "Renewal terms"], ["method", "Pricing method"], ["fee", "Fee or rate"], ["feePeriod", "Fee period"], ["billing", "Billing frequency"], ["invoiceTiming", "Invoice timing"], ["paymentTerms", "Payment terms"],
    ["includedTonnes", "Included quantity"], ["allowancePeriod", "Allowance period"], ["excessRate", "Excess charge"], ["minimumCommitment", "Minimum commitment"], ["rollover", "Rollover"],
    ["included", "Included costs"], ["excluded", "Excluded costs"], ["vat", "Tax treatment"], ["manualEstimate", "Manual estimate"], ["document", "Document"],
  ];
  return fields.filter(([key]) => JSON.stringify(before[key as keyof Agreement]) !== JSON.stringify(after[key])).map(([key, label]) => `${label} changed from ${show(before[key as keyof Agreement])} to ${show(after[key])}`);
}

/** Sets a shipment's one transport price source. Replacing it keeps the earlier source in the shipment's pricing history. */
function setPricingSource(shipment: Shipment, source: PricingSource, actor: Actor, note: string | null) {
  const previous = shipment.pricingSource;
  shipment.pricingSource = source;
  const summary = previous ? `Pricing source replaced: ${previous.label} to ${source.label}` : `Transport priced from ${source.label}`;
  shipment.pricingHistory = [...shipment.pricingHistory, { id: nextId("transportHistory", "spr"), at: source.setAt, actor: actor.name, summary, note }];
  recordShipment(shipment, actor, { type: "pricing_source_set", summary, note });
}

/** A shipment as someone who may not see transport prices sees it: the source is named, the cost is left out. */
function hideTransportCost(shipment: Shipment): Shipment {
  const hidden = shipment.fleet.internalCost ? { ...shipment, fleet: { ...shipment.fleet, internalCost: { amount: 0, note: "" } } } : shipment;
  return hidden.pricingSource ? { ...hidden, pricingSource: { ...hidden.pricingSource, costExVat: null } } : hidden;
}

// ---- Own fleet ----------------------------------------------------------------------------

/** Vehicles that can carry a load, from the equipment register, with whether each can take one now and why not. */
function fleetVehicles(): FleetVehicle[] {
  const current = now();
  return state.equipment
    .filter((item) => !item.retiredAt && (fleetCategories as readonly string[]).includes(item.category))
    .map((item) => {
      const urgent = mostUrgent(item.plans.map((plan) => planStatus(plan, item, current)));
      const maintenance = urgent?.state ?? "unknown";
      const reason = item.state === "unavailable" ? `unavailable${item.stateNote ? ` (${item.stateNote.replace(/\.$/, "")})` : ""}` : maintenance === "overdue" ? `its ${urgent?.name ?? "service"} is overdue` : null;
      return { id: item.id, code: item.code, name: item.name, category: item.category, state: item.state, stateNote: item.stateNote, maintenance, maintenanceLabel: urgent?.label ?? "No maintenance plan", assignable: reason === null, reason };
    });
}

/** Loads whose vehicle has a problem: unavailable, overdue for service, or with an open issue. Responsible person and next step included. */
function fleetAlertsFor(shipment: Shipment, vehicles: FleetVehicle[]): FleetAlert[] {
  if (shipment.transportMode !== "own_fleet" || shipment.state === "delivered" || shipment.state === "cancelled") return [];
  const alerts: FleetAlert[] = [];
  for (const load of shipment.fleet.loads) {
    const vehicle = vehicles.find((item) => item.id === load.vehicleId);
    if (!vehicle) continue;
    const issue = state.issues.find((item) => item.equipmentId === vehicle.id && isOpen(item));
    if (vehicle.assignable && !issue) continue;
    const action = issue ? activeActions(issue)[0] : undefined;
    alerts.push({
      loadId: load.id,
      vehicleCode: vehicle.code,
      reason: vehicle.reason ? `${vehicle.code} is ${vehicle.reason}.` : `${vehicle.code} has an open issue: ${issue?.title}.`,
      responsible: issue?.owner ?? shipment.fleet.coordinator ?? shipment.preparedBy,
      nextAction: action ? action.title : issue ? "Follow the repair on the issue, or reassign the load." : "Reassign the load to another vehicle, or report the breakdown.",
      issueId: issue?.id ?? null,
      issueNumber: issue?.issueNumber ?? null,
    });
  }
  return alerts;
}

function fleetPeople() {
  const active = state.members.filter((member) => member.status !== "deactivated");
  return {
    drivers: active.filter((member) => ["Field Employee", "Shift Supervisor"].includes(member.role)).map((member) => member.name),
    coordinators: active.filter((member) => ["Mine Manager", "Stores / Inventory Controller", "Shift Supervisor"].includes(member.role)).map((member) => member.name),
  };
}

/** After a change to the loads of a shipment that was waiting for, or had, a confirmed schedule: it must be confirmed again. */
function reopenFleetSchedule(shipment: Shipment, actor: Actor) {
  if (shipment.state !== "waiting" && shipment.state !== "confirmed") return;
  const request = state.requests.find((item) => item.id === shipment.requestId);
  if (request) request.state = "cancelled";
  shipment.requestId = null;
  shipment.state = "preparing";
  recordShipment(shipment, actor, { type: "fleet_changed", summary: "Fleet plan changed, so the schedule needs confirming again" });
}

function localTime(value: unknown, label: string) {
  const textValue = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(textValue) || Number.isNaN(Date.parse(`${textValue.slice(0, 16)}:00+02:00`))) fail(400, "VALIDATION_ERROR", `Choose ${label}.`);
  return `${textValue.slice(0, 16)}:00+02:00`;
}

function recordShipment(shipment: Shipment, actor: Actor, event: { type: ShipmentEvent["type"]; summary: string; note?: string | null }) {
  shipment.events = [...shipment.events, { id: nextId("shipmentEvent", "sev"), type: event.type, summary: event.summary, actor: actor.name, occurredAt: tick(), note: event.note?.trim() || null }];
  shipment.version += 1;
}
function recordProductionEvent(record: ProductionRecord, actor: Actor, event: { type: ProductionEvent["type"]; summary: string; note?: string | null }) {
  record.events = [...record.events, { id: nextId("productionEvent", "pev"), type: event.type, summary: event.summary, actor: actor.name, occurredAt: tick(), note: event.note?.trim() || null }];
  record.version += 1;
}

/** A tonnage the person typed: a number, not negative, with a sensible ceiling. */
function tonnesOf(value: unknown, label: string, { positive = true }: { positive?: boolean } = {}) {
  const parsed = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(parsed)) fail(400, "VALIDATION_ERROR", `${label} must be a number.`);
  if (positive ? parsed <= 0 : parsed < 0) fail(400, "VALIDATION_ERROR", `${label} must be ${positive ? "more than 0" : "0 or more"}.`);
  if (parsed > 1_000_000) fail(400, "VALIDATION_ERROR", `${label} looks too large. Check the number.`);
  return Math.round(parsed * 100) / 100;
}

const basisOf = (value: unknown): MeasurementBasis => {
  const found = ["estimate", "weighbridge", "survey", "other"].find((item) => item === value);
  return (found as MeasurementBasis | undefined) ?? fail(400, "VALIDATION_ERROR", "Choose how the amount was measured.");
};

/** Reads and checks the fields of a production record from a form. Shared by recording and editing. */
function readProduction(input: Record<string, unknown>) {
  const stockpile = findStockpile(input.stockpileId);
  return {
    mineral: requireText(input.mineral, "The mineral", 3),
    area: requireText(input.area, "The mining area", 2),
    reportedTonnes: tonnesOf(input.reportedTonnes, "The amount produced"),
    basis: basisOf(input.basis),
    stockpileId: stockpile.id,
    note: text(input.note).slice(0, 500),
    evidence: readEvidence(input.evidence),
  };
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

/**
 * The store's public face, grouped by area (issues, actions, dependencies, equipment, shifts, providers, requests,
 * organisation, notifications). Each method validates, authorises, changes the records, records history and returns the
 * result. The mock handlers call these; nothing else changes the state. After a change, handlers call `save`.
 */
/** Shared by save and approve: validates the corrections against the generated lines and records who did what. */
function saveBriefingRecord(input: Record<string, unknown>, actor: Actor, approve: boolean) {
  if (!canReviewBriefing(actor)) fail(403, "FORBIDDEN", reviewMessage);
  const generated = buildBriefing({ shifts: demoDomain.listShifts(), issues: demoDomain.listIssues() });
  if (!generated.shiftId) fail(409, "READ_ONLY", "There is no shift to brief.");
  let record = state.briefings.find((item) => item.shiftId === generated.shiftId);
  if (record?.state === "approved") fail(409, "READ_ONLY", "This briefing is approved. Reopen it to change it.");
  const given = (input.corrections ?? {}) as Record<string, unknown>;
  const corrections: Record<string, string> = {};
  for (const line of generated.lines) {
    const value = given[line.id];
    if (value === undefined || value === null) continue;
    const wording = text(value);
    if (wording.length === 0) fail(400, "VALIDATION_ERROR", "A corrected line cannot be empty.");
    if (wording.length > 300) fail(400, "VALIDATION_ERROR", "A corrected line can be up to 300 characters.");
    if (wording !== line.text) corrections[line.id] = wording;
  }
  const note = text(input.note).slice(0, 600);
  const at = tick();
  if (!record) {
    record = { shiftId: generated.shiftId, state: "draft", corrections: {}, note: "", approvedBy: null, approvedAt: null, approvedGenerated: null, history: [] };
    state.briefings = [...state.briefings, record];
  }
  const changed = JSON.stringify(corrections) !== JSON.stringify(record.corrections) || note !== record.note;
  record.corrections = corrections;
  record.note = note;
  if (approve) {
    record.state = "approved";
    record.approvedBy = actor.name;
    record.approvedAt = at;
    record.approvedGenerated = Object.fromEntries(generated.lines.map((line) => [line.id, line.text]));
    const count = Object.keys(corrections).length;
    record.history = [...record.history, { id: nextId("briefingEvent", "bre"), at, actor: actor.name, summary: count > 0 ? `Approved with ${count} correction${count === 1 ? "" : "s"}` : "Approved as generated" }];
    const nextSupervisor = demoDomain.listShifts().find((item) => item.id === generated.shiftId)?.next?.supervisor ?? null;
    notify(nextSupervisor, "Shift briefing approved", `${generated.shiftName} briefing approved by ${actor.name}. The handover is sent separately.`, `/shifts/${generated.shiftId}/handover`, "shifts");
  } else if (changed) {
    record.history = [...record.history, { id: nextId("briefingEvent", "bre"), at, actor: actor.name, summary: "Corrections saved as a draft" }];
  }
  return demoDomain.briefing(actor);
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
      location: text(input.location).slice(0, 80) || null,
      responsible: checkedResponsible(input.responsible),
      condition: checkedCondition(input.condition),
      usage: text(input.usage).slice(0, 60) || null,
      dependsOn: checkedDependencies(input.dependsOn, `eq-${code.toLowerCase()}`),
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
    if ("location" in input) {
      const value = text(input.location).slice(0, 80) || null;
      if (value !== item.location) changes.push("location");
      item.location = value;
    }
    if ("responsible" in input) {
      const value = checkedResponsible(input.responsible);
      if (value !== item.responsible) changes.push("responsible person");
      item.responsible = value;
    }
    if ("condition" in input) {
      const value = checkedCondition(input.condition);
      if (value !== item.condition) changes.push("condition");
      item.condition = value;
    }
    if ("usage" in input) {
      const value = text(input.usage).slice(0, 60) || null;
      if (value !== item.usage) changes.push("usage");
      item.usage = value;
    }
    if ("dependsOn" in input) {
      const value = checkedDependencies(input.dependsOn, item.id);
      if (JSON.stringify(value) !== JSON.stringify(item.dependsOn)) changes.push("dependencies");
      item.dependsOn = value;
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
    const dependents = state.equipment.filter((other) => !other.retiredAt && other.dependsOn.includes(item.id));
    if (dependents.length) blockers.push(`${dependents.map((other) => other.code).join(", ")} ${dependents.length === 1 ? "depends" : "depend"} on it`);
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
    const commit = guardRepeat(input);
    const fields = checkedProvider(input);
    // A new provider waits for approval unless someone allowed to approve explicitly approves it.
    const wanted = input.approval === "approved" || input.approval === "inactive" ? input.approval : "pending";
    const approval = wanted !== "pending" && !canApproveProviders(actor).allowed ? "pending" : wanted;
    const provider: ServiceProvider = { id: nextId("provider", "prov"), ...fields, approval, active: approval === "approved", history: [], createdAt: tick(), version: 1 };
    recordProvider(provider, actor, approval === "approved" ? "Added and approved" : approval === "inactive" ? "Added as inactive" : "Added; waiting for approval");
    state.providers = [...state.providers, provider];
    logOrganisation(actor, `Added service provider ${provider.name}`);
    commit();
    return provider;
  },

  updateProvider(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    assertProviderManager(actor);
    const provider = findProvider(id);
    assertRecordVersion(provider, input.version);
    const next = checkedProvider(input, id);
    const changed = describeProviderChanges(provider, next);
    Object.assign(provider, next);
    touch(provider);
    if (changed.length > 0) recordProvider(provider, actor, `Updated ${changed.join(", ")}`);
    logOrganisation(actor, `Updated service provider ${provider.name}`);
    return provider;
  },

  /** Approves, deactivates or returns a provider to pending. A provider with repair work in progress cannot be deactivated. */
  setProviderApproval(id: string, input: Record<string, unknown> & { version?: number }, actor: Actor) {
    const allowed = canApproveProviders(actor);
    if (!allowed.allowed) fail(403, "FORBIDDEN", allowed.reason ?? "Not permitted.");
    const provider = findProvider(id);
    assertRecordVersion(provider, input.version);
    const approval = input.approval;
    if (approval !== "pending" && approval !== "approved" && approval !== "inactive") fail(400, "VALIDATION_ERROR", "Choose pending approval, approved or inactive.");
    if (approval === provider.approval) fail(409, "READ_ONLY", `This provider is already ${approval === "pending" ? "pending approval" : approval}.`);
    const note = approval === "inactive" ? requireText(input.note, "The reason", 5) : text(input.note) || null;
    if (approval !== "approved") {
      const open = state.serviceRequests.filter((request) => request.status !== "completed" && request.status !== "cancelled" && request.invites.some((invite) => invite.providerId === id && (invite.state === "accepted")));
      if (open.length > 0) fail(409, "IN_USE", `${provider.name} has repair work in progress (${open.map((request) => request.number).join(", ")}). Finish or cancel it first.`);
    }
    const before = provider.approval;
    provider.approval = approval;
    provider.active = approval === "approved";
    touch(provider);
    const words = { pending: "pending approval", approved: "approved", inactive: "inactive" } as const;
    recordProvider(provider, actor, `Approval changed from ${words[before]} to ${words[approval]}`, note);
    logOrganisation(actor, `${approval === "approved" ? "Approved" : approval === "inactive" ? "Deactivated" : "Returned to pending"} service provider ${provider.name}`);
    return provider;
  },

  /** Kept for the Admin screen: switching a provider on or off is an approval change. */
  setProviderActive(id: string, active: boolean, actor: Actor) {
    const provider = findProvider(id);
    return demoDomain.setProviderApproval(id, { approval: active ? "approved" : "inactive", note: active ? "" : "Deactivated from the Admin screen.", version: provider.version }, actor);
  },

  /** Permanently removes a provider that nothing refers to. Otherwise the provider must be deactivated so the history stays whole. */
  deleteProvider(id: string, actor: Actor) {
    const allowed = canApproveProviders(actor);
    if (!allowed.allowed) fail(403, "FORBIDDEN", allowed.reason ?? "Not permitted.");
    const provider = findProvider(id);
    const used = providerReferences(id);
    if (used.length > 0) fail(409, "HAS_HISTORY", `${provider.name} appears on ${used.join(", ")}. Deactivate them instead so the history stays whole.`);
    state.providers = state.providers.filter((item) => item.id !== id);
    logOrganisation(actor, `Deleted service provider ${provider.name}`);
    return { id, deleted: true };
  },

  /** One provider with the repair requests it appears on, what has been completed, and reply times worked out from recorded quotes only. */
  providerDetail(id: string) {
    const provider = findProvider(id);
    const requests = state.serviceRequests
      .filter((request) => request.invites.some((invite) => invite.providerId === id))
      .map((request) => {
        const invite = request.invites.find((item) => item.providerId === id)!;
        const equipment = state.equipment.find((item) => item.id === request.equipmentId);
        const chosen = request.awardedInviteId === invite.id;
        return { id: request.id, number: request.number, title: request.title, equipmentId: request.equipmentId, equipmentCode: equipment?.code ?? "", status: request.status, invite: invite.state, chosen, sentAt: invite.sentAt, quotedAt: invite.quote?.recordedAt ?? null, completedAt: chosen ? request.completedAt : null };
      })
      .sort((a, b) => b.number.localeCompare(a.number));
    const replyHours = requests.filter((item) => item.quotedAt).map((item) => (Date.parse(item.quotedAt!) - Date.parse(item.sentAt)) / 3_600_000);
    const references = providerReferences(id);
    return {
      provider,
      requests,
      performance: {
        asked: requests.length,
        replied: replyHours.length,
        declined: requests.filter((item) => item.invite === "declined").length,
        completedJobs: requests.filter((item) => item.chosen && item.status === "completed").length,
        averageReplyHours: replyHours.length === 0 ? null : Math.round((replyHours.reduce((total, hours) => total + hours, 0) / replyHours.length) * 10) / 10,
      },
      canDelete: references.length === 0,
      deleteBlockedBy: references,
    };
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

  // ---- Production, inventory and shipments -------------------------------------------------
  /** Everything the Shift Control Production tab and the Shipments module read, in one answer so their figures always agree. */
  logistics(actor?: Actor) {
    const stockpiles = state.stockpiles.map((item) => ({ ...item, ...stockPosition(item, state.movements) }));
    const movements = [...state.movements].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);
    const viewTerms = Boolean(actor && canActOnTransport("view_terms", actor).allowed);
    const byNewest = <T extends { createdAt: string }>(items: T[]) => [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
      now: now(),
      stockpiles,
      movements,
      production: byNewest(state.production),
      shipments: [...state.shipments].sort((a, b) => b.number.localeCompare(a.number)).map((shipment) => (viewTerms ? shipment : hideTransportCost(shipment))),
      requests: [...state.requests].sort((a, b) => b.number.localeCompare(a.number)),
      transporters: state.transporters,
      fleet: (() => {
        const vehicles = fleetVehicles();
        return { vehicles, ...fleetPeople(), canSeeCost: viewTerms, alerts: Object.fromEntries(state.shipments.map((shipment) => [shipment.id, fleetAlertsFor(shipment, vehicles)]).filter(([, list]) => (list as FleetAlert[]).length > 0)) as Record<string, FleetAlert[]> };
      })(),
      // Money is only sent to people allowed to see it. Everyone else gets no price, value or finance record at all, so there is
      // nothing for a screen, an export or a network inspector to reveal.
      commercial: actor && canActOnShipments("view_value", actor).allowed
        ? {
            prices: state.prices,
            history: state.valueHistory,
            finance: canActOnShipments("view_finance", actor).allowed ? state.finance : null,
            canSetPrices: canActOnShipments("manage_prices", actor).allowed,
          }
        : null,
    };
  },

  recordProduction(input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("record_production", actor);
    const commit = guardRepeat(input);
    const shift = typeof input.shiftId === "string" && input.shiftId ? findShift(input.shiftId) : null;
    const fields = readProduction(input);
    const submit = input.submit !== false;
    const twin = state.production.find((item) => item.state === "needs_checking" && item.shiftId === (shift?.id ?? null) && item.mineral === fields.mineral && item.area === fields.area && item.reportedTonnes === fields.reportedTonnes && item.reportedBy === actor.name);
    if (submit && twin) fail(409, "DUPLICATE", `${twin.number} already has these figures and is waiting to be checked.`);
    const at = tick();
    const record: ProductionRecord = {
      id: `prod-${state.counters.production + 1}`,
      number: nextNumber("production", "PR"),
      shiftId: shift?.id ?? null,
      shiftName: shift?.name ?? requireText(input.shiftName, "The shift", 2),
      ...fields,
      targetTonnes: shiftTargetTonnes,
      reportedBy: actor.name,
      state: submit ? "needs_checking" : "draft",
      sentBackReason: null,
      check: null,
      events: [],
      version: 1,
      createdAt: at,
    };
    recordProductionEvent(record, actor, { type: submit ? "submitted" : "recorded", summary: submit ? "Sent for checking" : "Saved as a draft" });
    record.version = 1;
    state.production = [...state.production, record];
    if (submit) notify(null, "Production needs checking", `${record.shiftName}: ${formatTonnes(record.reportedTonnes)} ${record.mineral.toLowerCase()} reported by ${actor.name}.`, `/shipments/inventory/check/${record.id}`, "production");
    commit();
    return record;
  },

  updateProduction(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("record_production", actor);
    const record = findProduction(id);
    assertProductionVersion(record, input.version);
    if (record.state !== "draft" && record.state !== "sent_back") fail(409, "READ_ONLY", "Only a draft or a record that was sent back can be changed.");
    Object.assign(record, readProduction(input));
    const submit = input.submit === true;
    if (submit) {
      record.state = "needs_checking";
      record.sentBackReason = null;
    }
    recordProductionEvent(record, actor, { type: submit ? "submitted" : "edited", summary: submit ? "Sent for checking" : "Draft saved" });
    if (submit) notify(null, "Production needs checking", `${record.shiftName}: ${formatTonnes(record.reportedTonnes)} ${record.mineral.toLowerCase()} reported by ${record.reportedBy}.`, `/shipments/inventory/check/${record.id}`, "production");
    return record;
  },

  checkProduction(id: string, input: Record<string, unknown>, actor: Actor) {
    const record = findProduction(id);
    assertShipmentsCan("check_production", actor, record.reportedBy);
    assertProductionVersion(record, input.version);
    if (record.state !== "needs_checking") fail(409, "READ_ONLY", record.state === "checked" ? "This amount has already been checked." : "Only an amount that is waiting to be checked can be confirmed.");
    const confirmed = tonnesOf(input.confirmedTonnes, "The confirmed amount", { positive: false });
    const basis = basisOf(input.basis);
    const file = requireText(input.record, "The measurement record", 3);
    const stockpile = findStockpile(input.stockpileId);
    const difference = checkDifference(record, confirmed);
    const reason = text(input.reason);
    if (difference !== 0 && reason.length < 8) fail(400, "VALIDATION_ERROR", `The confirmed amount is ${formatTonnes(Math.abs(difference))} ${difference < 0 ? "less" : "more"} than reported. Record the reason (at least 8 characters).`);
    record.check = { confirmedTonnes: confirmed, basis, record: file, reason: difference !== 0 ? reason : null, stockpileId: stockpile.id, checkedBy: actor.name, checkedAt: tick() };
    record.state = "checked";
    addMovement("receipt", stockpile.id, confirmed, record.number, actor, difference !== 0 ? reason : null);
    recordProductionEvent(record, actor, { type: "checked", summary: `${formatTonnes(confirmed)} confirmed into ${stockpile.code}`, note: difference !== 0 ? reason : null });
    notify(record.reportedBy, "Your production was checked", `${record.number}: ${formatTonnes(confirmed)} confirmed into ${stockpile.code}.`, "/shifts/production", "production");
    return record;
  },

  sendBackProduction(id: string, input: { reason?: unknown; version?: number }, actor: Actor) {
    const record = findProduction(id);
    assertShipmentsCan("check_production", actor, record.reportedBy);
    assertProductionVersion(record, input.version);
    if (record.state !== "needs_checking") fail(409, "READ_ONLY", "Only an amount that is waiting to be checked can be sent back.");
    const reason = requireText(input.reason, "The reason", 8);
    record.state = "sent_back";
    record.sentBackReason = reason;
    recordProductionEvent(record, actor, { type: "sent_back", summary: "Sent back for correction", note: reason });
    notify(record.reportedBy, "Production sent back", `${record.number}: ${reason}`, `/shifts/production/new?id=${record.id}`, "production");
    return record;
  },

  createShipment(input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const commit = guardRepeat(input);
    const kind: Shipment["kind"] = input.kind === "internal_transfer" ? "internal_transfer" : "sale";
    const stockpile = findStockpile(input.stockpileId);
    if (stockpile.condition !== "ready_for_shipment") fail(409, "NOT_ELIGIBLE", `${stockpile.code} holds material that needs processing. It cannot be reserved for a shipment yet.`);
    const tonnes = tonnesOf(input.tonnes, "The amount to reserve");
    const position = stockPosition(stockpile, state.movements);
    if (tonnes > position.available) fail(409, "INSUFFICIENT_STOCK", position.available > 0 ? `Only ${formatTonnes(position.available)} is available in ${stockpile.code}. Reduce the amount.` : `Nothing is available to reserve in ${stockpile.code}.`);
    const orderRef = requireText(input.orderRef, "The customer or order reference", 3);
    const clash = state.shipments.find((item) => item.state !== "cancelled" && item.orderRef.toLowerCase() === orderRef.toLowerCase());
    if (clash) fail(409, "DUPLICATE", `${orderRef} is already used by ${clash.number}. Use a different reference, or open that shipment.`);
    const destination = requireText(input.destination, "The destination", 3);
    const date = text(input.preferredDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) fail(400, "VALIDATION_ERROR", "Choose the preferred collection date.");
    const ownFleet = input.transportMode === "own_fleet";
    const transporter = ownFleet ? null : findTransporter(input.transporterId);
    if (transporter && !transporter.active) fail(409, "NOT_ELIGIBLE", `${transporter.name} is not an approved transporter at the moment.`);
    const shipment: Shipment = {
      id: `ship-${state.counters.shipment + 1}`,
      number: nextNumber("shipment", "SHP"),
      kind,
      pricingSource: null,
      pricingHistory: [],
      transportMode: ownFleet ? "own_fleet" : "provider",
      fleet: { coordinator: null, loads: [], internalCost: null },
      mineral: stockpile.mineral,
      stockpileId: stockpile.id,
      tonnes,
      orderRef,
      destination,
      preferredDate: date,
      transporterId: transporter ? transporter.id : OWN_FLEET_ID,
      note: text(input.note).slice(0, 500),
      state: "preparing",
      checks: { quality: false, instructions: false, documents: false, loading: false },
      requestId: null,
      dispatches: [],
      deliveries: [],
      events: [],
      preparedBy: actor.name,
      cancelledReason: null,
      version: 1,
      createdAt: tick(),
    };
    addMovement("reserve", stockpile.id, tonnes, shipment.number, actor);
    recordShipment(shipment, actor, { type: "created", summary: `Shipment created and ${formatTonnes(tonnes)} reserved` });
    shipment.version = 1;
    state.shipments = [...state.shipments, shipment];
    snapshotValue(shipment, "created", actor);
    commit();
    return shipment;
  },

  updateShipment(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.state !== "preparing" && shipment.state !== "declined") fail(409, "READ_ONLY", "Checks and the transporter can only be changed before a collection request is sent.");
    const before = JSON.stringify(shipment.checks) + shipment.transporterId + shipment.preferredDate;
    if (input.checks && typeof input.checks === "object") {
      const given = input.checks as Record<string, unknown>;
      for (const key of ["quality", "instructions", "documents", "loading"] as const) if (typeof given[key] === "boolean") shipment.checks[key] = given[key] as boolean;
    }
    if (input.transporterId !== undefined && shipment.transportMode === "provider") {
      const transporter = findTransporter(input.transporterId);
      if (!transporter.active) fail(409, "NOT_ELIGIBLE", `${transporter.name} is not an approved transporter at the moment.`);
      shipment.transporterId = transporter.id;
    }
    if (input.preferredDate !== undefined) {
      const date = text(input.preferredDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, "VALIDATION_ERROR", "Choose the preferred collection date.");
      shipment.preferredDate = date;
    }
    if (before !== JSON.stringify(shipment.checks) + shipment.transporterId + shipment.preferredDate) recordShipment(shipment, actor, { type: "checks_updated", summary: "Checks or collection details updated" });
    return shipment;
  },

  /** The one step that asks a transporter to collect. It creates exactly one request; asking again is refused. */
  markShipmentReady(id: string, input: { version?: number }, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.state === "waiting" || shipment.state === "confirmed") fail(409, "ALREADY_SENT", `A collection request has already been recorded for ${shipment.number}.`);
    if (shipment.state !== "preparing" && shipment.state !== "declined") fail(409, "READ_ONLY", "A collection request can only be sent while the shipment is being prepared.");
    const ownFleet = shipment.transportMode === "own_fleet";
    const transporter = state.transporters.find((item) => item.id === shipment.transporterId);
    const problems = [...readinessProblems(shipment, transporter), ...(ownFleet ? fleetProblems(shipment, fleetVehicles()) : [])];
    if (problems.length > 0) fail(409, "NOT_READY", problems[0]);
    state.counters.token += 1;
    const request: CollectionRequest = {
      id: `req-${state.counters.collection + 1}`,
      number: nextNumber("collection", "LR"),
      shipmentId: shipment.id,
      transporterId: shipment.transporterId,
      token: `${shipment.number.toLowerCase().replace("shp", "lr")}-${(0xa1b2c3 + state.counters.token * 7919).toString(16)}`,
      state: "sent",
      sentAt: tick(),
      collectionAt: null,
      reply: null,
      repliedAt: null,
      reminders: 0,
      simulated: true,
    };
    state.requests = [...state.requests, request];
    shipment.requestId = request.id;
    shipment.state = "waiting";
    if (ownFleet) {
      recordShipment(shipment, actor, { type: "request_sent", summary: `Transport plan ${request.number} recorded for the mine's own fleet; ${shipment.fleet.coordinator} confirms the schedule` });
      notify(shipment.fleet.coordinator, "Confirm the fleet schedule", `${shipment.number}: ${shipment.fleet.loads.length} load${shipment.fleet.loads.length === 1 ? "" : "s"} planned. Confirm the schedule when the vehicles and drivers are ready.`, `/shipments/${shipment.id}`, "logistics");
      return { shipment, request };
    }
    recordShipment(shipment, actor, { type: "request_sent", summary: `Collection request ${request.number} recorded for ${transporter?.name ?? "the transporter"} (demo: nothing was sent)` });
    notify(actor.name, "Collection request recorded", `${shipment.number}: waiting for ${transporter?.name ?? "the transporter"} to reply. In this demo no message is sent.`, "/shipments/logistics", "logistics");
    return { shipment, request };
  },

  /** Chooses who moves the shipment: a logistics provider or the mine's own fleet. Allowed until the transport is arranged. */
  setTransportMode(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.state !== "preparing" && shipment.state !== "declined") fail(409, "READ_ONLY", "Who handles the transport can only be changed before it is arranged.");
    const mode = input.mode === "own_fleet" ? "own_fleet" : input.mode === "provider" ? "provider" : fail(400, "VALIDATION_ERROR", "Choose Our fleet or Logistics provider.");
    if (mode === shipment.transportMode) fail(400, "VALIDATION_ERROR", `Transport is already handled by ${mode === "own_fleet" ? "our fleet" : "a logistics provider"}.`);
    const reason = text(input.reason);
    if (shipment.pricingSource && reason.length < 5) fail(400, "VALIDATION_ERROR", `This shipment is priced from ${shipment.pricingSource.label}. Say why it is changing so the earlier pricing source is kept in the history.`);
    if (shipment.pricingSource) {
      shipment.pricingHistory = [...shipment.pricingHistory, { id: nextId("transportHistory", "spr"), at: tick(), actor: actor.name, summary: `Pricing source removed: ${shipment.pricingSource.label}`, note: reason }];
      shipment.pricingSource = null;
    }
    shipment.transportMode = mode;
    if (mode === "own_fleet") {
      shipment.transporterId = OWN_FLEET_ID;
    } else {
      const first = state.transporters.find((item) => item.active) ?? fail(409, "NOT_ELIGIBLE", "There is no approved logistics provider yet.");
      shipment.transporterId = first.id;
      shipment.fleet = { coordinator: null, loads: [], internalCost: null };
    }
    recordShipment(shipment, actor, { type: "fleet_changed", summary: mode === "own_fleet" ? "Transport will be handled by our own fleet" : "Transport will be handled by a logistics provider", note: reason || null });
    return shipment;
  },

  /** Adds a load: one vehicle from the equipment register and one driver, with planned collection and delivery times. */
  addFleetLoad(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const commit = guardRepeat(input);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.transportMode !== "own_fleet") fail(409, "READ_ONLY", "This shipment is handled by a logistics provider. Switch it to our fleet first.");
    if (!["preparing", "waiting", "confirmed"].includes(shipment.state)) fail(409, "READ_ONLY", "Loads cannot be changed once material has left the mine.");
    const vehicles = fleetVehicles();
    const vehicle = vehicles.find((item) => item.id === input.vehicleId) ?? fail(400, "VALIDATION_ERROR", "Choose a vehicle from the equipment register.");
    if (!vehicle.assignable) fail(409, "NOT_ELIGIBLE", `${vehicle.code} cannot take a load: ${vehicle.reason}.`);
    const driverName = text(input.driverName);
    if (!fleetPeople().drivers.includes(driverName)) fail(400, "VALIDATION_ERROR", "Choose a driver from the list.");
    const tonnes = tonnesOf(input.tonnes, "The amount on this load");
    const left = Math.round((shipment.tonnes - assignedTonnes(shipment)) * 100) / 100;
    if (tonnes > left) fail(409, "TOO_MUCH", left > 0 ? `Only ${formatTonnes(left)} of ${shipment.number} is not yet on a load.` : `All ${formatTonnes(shipment.tonnes)} of ${shipment.number} is already on loads.`);
    const plannedCollectionAt = localTime(input.plannedCollectionAt, "the planned collection time");
    const plannedDeliveryAt = localTime(input.plannedDeliveryAt, "the planned delivery time");
    if (plannedDeliveryAt <= plannedCollectionAt) fail(400, "VALIDATION_ERROR", "Delivery has to be planned after collection.");
    for (const other of state.shipments) {
      if (other.state === "cancelled" || other.state === "delivered") continue;
      for (const load of other.fleet.loads) {
        if (!windowsOverlap(plannedCollectionAt, plannedDeliveryAt, load.plannedCollectionAt, load.plannedDeliveryAt)) continue;
        if (load.vehicleId === vehicle.id) fail(409, "DUPLICATE", `${vehicle.code} is already planned for ${other.number} in that time.`);
        if (load.driverName === driverName) fail(409, "DUPLICATE", `${driverName} is already planned for ${other.number} in that time.`);
      }
    }
    reopenFleetSchedule(shipment, actor);
    shipment.fleet.loads = [...shipment.fleet.loads, { id: nextId("fleetLoad", "ld"), vehicleId: vehicle.id, driverName, tonnes, plannedCollectionAt, plannedDeliveryAt, addedBy: actor.name, addedAt: tick() }];
    recordShipment(shipment, actor, { type: "fleet_changed", summary: `${vehicle.code} with ${driverName} assigned to ${formatTonnes(tonnes)}` });
    commit();
    return shipment;
  },

  removeFleetLoad(id: string, loadId: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (!["preparing", "waiting", "confirmed"].includes(shipment.state)) fail(409, "READ_ONLY", "Loads cannot be changed once material has left the mine.");
    const load = shipment.fleet.loads.find((item) => item.id === loadId) ?? fail(404, "NOT_FOUND", "This load could not be found.");
    const code = state.equipment.find((item) => item.id === load.vehicleId)?.code ?? "The vehicle";
    reopenFleetSchedule(shipment, actor);
    shipment.fleet.loads = shipment.fleet.loads.filter((item) => item.id !== loadId);
    recordShipment(shipment, actor, { type: "fleet_changed", summary: `${code} with ${load.driverName} taken off ${formatTonnes(load.tonnes)}`, note: text(input.reason) || null });
    return shipment;
  },

  /** Sets who is responsible and, optionally, an internal cost estimate. A cleared estimate goes back to "Cost not yet assessed". */
  updateFleetPlan(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.transportMode !== "own_fleet") fail(409, "READ_ONLY", "This shipment is handled by a logistics provider.");
    if (shipment.state === "delivered" || shipment.state === "cancelled") fail(409, "READ_ONLY", "This shipment is finished.");
    const lines: string[] = [];
    if (input.coordinator !== undefined) {
      const name = text(input.coordinator);
      if (!fleetPeople().coordinators.includes(name)) fail(400, "VALIDATION_ERROR", "Choose who is responsible from the list.");
      if (name !== shipment.fleet.coordinator) lines.push(`${name} is responsible for the transport`);
      shipment.fleet.coordinator = name;
    }
    if ("internalCostAmount" in input) {
      if (input.internalCostAmount === "" || input.internalCostAmount === null) {
        if (shipment.fleet.internalCost) lines.push("Internal cost estimate cleared");
        shipment.fleet.internalCost = null;
      } else {
        const amount = Number(input.internalCostAmount);
        if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) fail(400, "VALIDATION_ERROR", "The internal cost estimate must be a number, 0 or more.");
        shipment.fleet.internalCost = { amount, note: text(input.internalCostNote).slice(0, 200) };
        lines.push(`Internal cost estimate set to ${formatMoney(amount)} (an estimate, not an invoice)`);
      }
    }
    if (lines.length === 0) fail(400, "VALIDATION_ERROR", "Nothing was changed.");
    for (const summary of lines) recordShipment(shipment, actor, { type: "fleet_changed", summary });
    return shipment;
  },

  /** The coordinator confirms the schedule once vehicles and drivers are ready. This is the own-fleet equivalent of a provider's confirmation. */
  confirmFleetSchedule(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.transportMode !== "own_fleet") fail(409, "READ_ONLY", "This shipment is handled by a logistics provider, who confirms collection themselves.");
    if (shipment.state !== "waiting") fail(409, "READ_ONLY", shipment.state === "confirmed" ? "The fleet schedule is already confirmed." : "Mark the shipment ready before confirming the schedule.");
    const problems = fleetProblems(shipment, fleetVehicles());
    if (problems.length > 0) fail(409, "NOT_READY", problems[0]);
    const request = state.requests.find((item) => item.id === shipment.requestId) ?? fail(404, "NOT_FOUND", "The transport plan could not be found.");
    const when = earliestCollection(shipment.fleet.loads) ?? fail(409, "NOT_READY", "Assign at least one vehicle and driver.");
    request.state = "confirmed";
    request.collectionAt = when;
    request.reply = `Schedule confirmed by ${actor.name} for ${OWN_FLEET_NAME.toLowerCase()}.`;
    request.repliedAt = tick();
    shipment.state = "confirmed";
    recordShipment(shipment, actor, { type: "confirmed", summary: `${actor.name} confirmed the fleet schedule: first collection ${formatDemoDateTime(when)}` });
    return shipment;
  },

  sendReminder(requestId: string, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const request = state.requests.find((item) => item.id === requestId) ?? fail(404, "NOT_FOUND", "This request could not be found.");
    if (request.state !== "sent") fail(409, "READ_ONLY", "A reminder only makes sense while the transporter has not replied.");
    const shipment = findShipment(request.shipmentId);
    request.reminders += 1;
    recordShipment(shipment, actor, { type: "reminder_sent", summary: `Reminder recorded for ${request.number} (demo: nothing was sent)` });
    return request;
  },

  /** What the transporter sees on their reply page, from the token in their link. No sign-in. */
  transportView(token: string) {
    const request = state.requests.find((item) => item.token === token) ?? fail(404, "NOT_FOUND", "This link is not valid. Ask the mine to send a new one.");
    const shipment = findShipment(request.shipmentId);
    const transporter = state.transporters.find((item) => item.id === request.transporterId);
    return {
      request,
      mineName: state.company.name,
      siteName: state.site.name,
      transporterName: transporter?.name ?? "Transporter",
      shipment: { number: shipment.number, mineral: shipment.mineral, tonnes: shipment.tonnes, destination: shipment.destination, preferredDate: shipment.preferredDate },
      open: request.state === "sent",
    };
  },

  transporterRespond(token: string, input: Record<string, unknown>) {
    const request = state.requests.find((item) => item.token === token) ?? fail(404, "NOT_FOUND", "This link is not valid. Ask the mine to send a new one.");
    if (request.state !== "sent") fail(409, "READ_ONLY", "This request has already been answered or was cancelled.");
    const shipment = findShipment(request.shipmentId);
    const transporter = state.transporters.find((item) => item.id === request.transporterId);
    const actor: Actor = { name: transporter?.name ?? "Transporter", role: "Transporter" };
    const who = shipment.preparedBy;
    if (input.answer === "confirm") {
      const date = text(input.date);
      const time = text(input.time);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, "VALIDATION_ERROR", "Choose the collection date and time.");
      const when = `${date}T${time}:00+02:00`;
      if (Date.parse(when) < Date.parse(now())) fail(400, "VALIDATION_ERROR", "The collection time cannot be in the past.");
      request.state = "confirmed";
      request.collectionAt = when;
      request.reply = text(input.note).slice(0, 300) || null;
      request.repliedAt = tick();
      shipment.state = "confirmed";
      recordShipment(shipment, actor, { type: "confirmed", summary: `${actor.name} confirmed collection on ${formatDemoDateTime(when)}` });
      notify(who, "Collection confirmed", `${shipment.number}: ${actor.name} will collect on ${formatDemoDateTime(when)}.`, `/shipments/${shipment.id}`, "logistics");
    } else if (input.answer === "decline") {
      const reason = requireText(input.note, "The reason", 5);
      request.state = "declined";
      request.reply = reason;
      request.repliedAt = tick();
      shipment.state = "declined";
      recordShipment(shipment, actor, { type: "declined", summary: `${actor.name} declined the collection request`, note: reason });
      notify(who, "Collection declined", `${shipment.number}: ${actor.name} cannot collect. ${reason}`, `/shipments/${shipment.id}`, "logistics");
    } else {
      fail(400, "VALIDATION_ERROR", "Choose Confirm collection or Decline.");
    }
    return { state: request.state };
  },

  recordDispatch(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const commit = guardRepeat(input);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.state !== "confirmed" && shipment.state !== "dispatched") fail(409, "READ_ONLY", shipment.transportMode === "own_fleet" ? "Dispatch can be recorded once the fleet schedule has been confirmed." : "Dispatch can be recorded once the transporter has confirmed collection.");
    if (shipment.transportMode === "own_fleet" && shipment.state === "confirmed") {
      const alert = fleetAlertsFor(shipment, fleetVehicles())[0];
      if (alert) fail(409, "NOT_READY", `${alert.reason} Reassign the load before dispatch.`);
    }
    const figures = shipmentFigures(shipment);
    const tonnes = tonnesOf(input.tonnes, "The amount dispatched");
    if (tonnes > figures.remaining) fail(409, "TOO_MUCH", `Only ${formatTonnes(figures.remaining)} of ${shipment.number} is still at the mine.`);
    shipment.dispatches = [...shipment.dispatches, { id: nextId("dispatch", "dsp"), at: tick(), tonnes, by: actor.name, reference: text(input.reference).slice(0, 120) || null }];
    shipment.state = "dispatched";
    addMovement("dispatch", shipment.stockpileId, tonnes, shipment.number, actor);
    const after = shipmentFigures(shipment);
    recordShipment(shipment, actor, { type: "dispatched", summary: after.remaining > 0 ? `${formatTonnes(tonnes)} dispatched; ${formatTonnes(after.remaining)} still at the mine` : `${formatTonnes(tonnes)} dispatched` });
    if (after.remaining === 0) snapshotValue(shipment, "dispatched", actor);
    commit();
    return shipment;
  },

  recordDelivery(id: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const commit = guardRepeat(input);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (shipment.state !== "dispatched") fail(409, "READ_ONLY", "Delivery can be recorded once material has been dispatched.");
    const figures = shipmentFigures(shipment);
    if (figures.inTransit <= 0) fail(409, "READ_ONLY", "Everything dispatched has already been delivered.");
    const settles = input.settles === undefined || input.settles === "" ? figures.inTransit : tonnesOf(input.settles, "The dispatched amount this delivery settles");
    if (settles > figures.inTransit) fail(409, "TOO_MUCH", `Only ${formatTonnes(figures.inTransit)} is on its way.`);
    const received = tonnesOf(input.tonnes, "The amount received", { positive: false });
    const evidence = requireText(input.evidence, "The delivery evidence", 3);
    const difference = Math.round((received - settles) * 100) / 100;
    const reason = text(input.reason);
    if (difference !== 0 && reason.length < 8) fail(400, "VALIDATION_ERROR", `${formatTonnes(Math.abs(difference))} ${difference < 0 ? "less" : "more"} arrived than was dispatched. Record the reason (at least 8 characters).`);
    shipment.deliveries = [...shipment.deliveries, { id: nextId("delivery", "dlv"), at: tick(), tonnes: received, settles, by: actor.name, evidence, reason: difference !== 0 ? reason : null, reviewed: difference === 0, reviewedBy: null }];
    const after = shipmentFigures(shipment);
    const complete = after.remaining === 0 && after.inTransit === 0;
    if (complete) shipment.state = "delivered";
    recordShipment(shipment, actor, {
      type: "delivered",
      summary: complete ? `${formatTonnes(received)} received${difference !== 0 ? " with a difference to review" : " and checked"}` : `${formatTonnes(received)} received; ${formatTonnes(after.inTransit + after.remaining)} still to come`,
      note: difference !== 0 ? reason : null,
    });
    commit();
    return shipment;
  },

  reviewDifference(id: string, deliveryId: string, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    const delivery = shipment.deliveries.find((item) => item.id === deliveryId) ?? fail(404, "NOT_FOUND", "This delivery could not be found.");
    if (delivery.reviewed) fail(409, "READ_ONLY", "This difference has already been reviewed.");
    delivery.reviewed = true;
    delivery.reviewedBy = actor.name;
    recordShipment(shipment, actor, { type: "difference_reviewed", summary: "Delivery difference reviewed" });
    return shipment;
  },

  cancelShipment(id: string, input: { reason?: unknown; version?: number }, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(id);
    assertShipmentVersion(shipment, input.version);
    if (!canCancel(shipment)) fail(409, "READ_ONLY", shipment.dispatches.length > 0 ? "Some of this shipment has already left the mine, so it cannot be cancelled." : "This shipment is already finished.");
    const reason = requireText(input.reason, "The reason", 8);
    addMovement("release", shipment.stockpileId, shipment.tonnes, shipment.number, actor, reason);
    const request = requestFor(shipment);
    if (request && request.state === "sent") request.state = "cancelled";
    shipment.state = "cancelled";
    shipment.cancelledReason = reason;
    recordShipment(shipment, actor, { type: "cancelled", summary: `Shipment cancelled before dispatch; ${formatTonnes(shipment.tonnes)} released`, note: reason });
    return shipment;
  },

  /**
   * Supplies or changes the price for a customer order or contract. Only the Commercial / Finance Officer may. The old price is kept
   * as an earlier version, and every open shipment on that order gets a new line in its value history, so the original estimate stays.
   */
  setPrice(input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_prices", actor);
    const commit = guardRepeat(input);
    const reference = requireText(input.reference, "The customer order or contract", 3);
    const perTonne = tonnesOf(input.pricePerTonne, "The price per tonne");
    const source = requireText(input.source, "The source of the price", 3);
    const previous = currentPrice(state.prices, reference);
    if (previous && previous.pricePerTonne === perTonne) fail(409, "DUPLICATE", `${reference} is already priced at ${formatMoney(perTonne)} per tonne.`);
    const record: PriceRecord = {
      id: nextId("price", "price"),
      reference,
      customer: text(input.customer) || previous?.customer || null,
      pricePerTonne: perTonne,
      currency: CURRENCY,
      quantityBasis: QUANTITY_BASIS,
      priceBasis: PRICE_BASIS,
      source,
      suppliedBy: actor.name,
      updatedAt: tick(),
      version: (previous?.version ?? 0) + 1,
      supersedesId: previous?.id ?? null,
    };
    state.prices = [...state.prices, record];
    for (const shipment of state.shipments) {
      if (shipment.kind !== "sale" || shipment.state === "cancelled" || shipment.orderRef.trim().toLowerCase() !== reference.toLowerCase()) continue;
      // A value finance has settled is final, and a new price does not reopen it.
      if (financeFor(shipment.id)?.finalValue != null) continue;
      snapshotValue(shipment, previous ? "price_changed" : "priced", actor);
    }
    commit();
    return record;
  },

  // ---- Service providers, transport quotes and transport agreements ------------------------------
  /** What the Service providers pages read. Prices and terms are only sent to roles allowed to see them. */
  transport(actor?: Actor) {
    const can = (capability: TransportCapability) => Boolean(actor && canActOnTransport(capability, actor).allowed);
    return {
      now: now(),
      today: TRANSPORT_DEMO_DATE,
      period: TRANSPORT_DEMO_PERIOD,
      providers: state.transporters,
      terms: can("view_terms") ? { requests: state.quoteRequests, agreements: state.agreements, charges: state.charges, earlier: state.earlierDeliveries } : null,
      can: { viewTerms: can("view_terms"), manage: can("manage_providers"), approve: can("approve_providers"), record: can("record_quotes"), decide: can("decide_quotes"), confirm: can("confirm_agreements"), shipments: Boolean(actor && canActOnShipments("manage_shipments", actor).allowed) },
    };
  },

  addTransportProvider(input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("manage_providers", actor);
    const commit = guardRepeat(input);
    const name = requireText(input.name, "The company name", 3);
    if (state.transporters.some((item) => item.name.toLowerCase() === name.toLowerCase())) fail(409, "DUPLICATE", `${name} is already on the list.`);
    const fields = readProviderFields(input);
    const at = tick();
    // A new provider needs the mine's approval before it can be used for transport.
    const provider: Transporter = { id: nextId("transporter", "tr"), name, ...fields, contact: fields.email, approval: "needs_review", approvedUntil: null, active: false, history: [{ id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: "Added; needs mine approval", note: null }] };
    state.transporters = [...state.transporters, provider];
    commit();
    return provider;
  },

  /** Edits a provider's details and, for the Mine Manager, the mine's approval. Providers are never deleted: inactive ones keep their history. */
  updateTransportProvider(id: string, input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("manage_providers", actor);
    const provider = findTransporter(id);
    const lines: string[] = [];
    if (input.name !== undefined) {
      const name = requireText(input.name, "The company name", 3);
      if (name.toLowerCase() !== provider.name.toLowerCase() && state.transporters.some((item) => item.name.toLowerCase() === name.toLowerCase())) fail(409, "DUPLICATE", `${name} is already on the list.`);
      if (name !== provider.name) lines.push(`Name changed to ${name}`);
      provider.name = name;
    }
    const fields = readProviderFields({ ...provider, ...input });
    if (JSON.stringify({ ...fields }) !== JSON.stringify({ mode: provider.mode, serviceNote: provider.serviceNote, areasServed: provider.areasServed, contactPerson: provider.contactPerson, email: provider.email, phone: provider.phone, notes: provider.notes, attachments: provider.attachments })) lines.push("Details updated");
    Object.assign(provider, fields, { contact: fields.email });
    if (input.approval !== undefined && input.approval !== provider.approval) {
      assertTransportCan("approve_providers", actor);
      if (input.approval !== "needs_review" && input.approval !== "approved" && input.approval !== "inactive") fail(400, "VALIDATION_ERROR", "Choose needs review, approved or inactive.");
      if (input.approval !== "approved" && state.shipments.some((item) => item.transporterId === provider.id && ["preparing", "waiting", "confirmed", "declined", "dispatched"].includes(item.state))) {
        fail(409, "IN_USE", `${provider.name} still has shipments in progress, so it cannot be taken off the approved list.`);
      }
      const note = input.approval === "inactive" ? requireText(input.note, "The reason", 5) : text(input.note) || null;
      lines.push(`Mine approval changed from ${approvalLabels[provider.approval]} to ${approvalLabels[input.approval]}${note ? `: ${note}` : ""}`);
      provider.approval = input.approval;
    }
    provider.active = provider.approval === "approved";
    if (lines.length === 0) fail(400, "VALIDATION_ERROR", "Nothing was changed.");
    const at = tick();
    provider.history = [...provider.history, ...lines.map((summary) => ({ id: nextId("transportHistory", "tph"), at, actor: actor.name, summary, note: null }))];
    return provider;
  },

  /** Saves a quote request as a draft. For one shipment it is prefilled from the shipment. An agreement request needs no shipment. */
  createQuoteRequest(input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("record_quotes", actor);
    const commit = guardRepeat(input);
    const kind: QuoteRequest["kind"] = input.kind === "agreement" ? "agreement" : "shipment";
    const ids = Array.isArray(input.providerIds) ? input.providerIds.map(String) : [];
    if (ids.length === 0) fail(400, "VALIDATION_ERROR", "Choose at least one provider to ask.");
    for (const providerId of ids) {
      const provider = findTransporter(providerId);
      if (provider.approval !== "approved") fail(409, "NOT_ELIGIBLE", `${provider.name} is not approved by the mine, so it cannot be asked to quote.`);
    }
    const replyText = text(input.replyBy);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(replyText) || Number.isNaN(Date.parse(`${replyText.slice(0, 16)}:00+02:00`))) fail(400, "VALIDATION_ERROR", "Choose when the quote is needed by.");
    const requirements = text(input.requirements).slice(0, 800);
    const at = tick();
    let request: QuoteRequest;
    if (kind === "shipment") {
      const shipment = findShipment(String(input.shipmentId));
      if (shipment.state === "dispatched" || shipment.state === "delivered" || shipment.state === "cancelled") fail(409, "READ_ONLY", `${shipment.number} has already left the mine or is finished.`);
      const open = state.quoteRequests.find((item) => item.shipmentId === shipment.id && (item.status === "draft" || item.status === "sent"));
      if (open) fail(409, "DUPLICATE", `${shipment.number} already has an open quote request, ${open.number}.`);
      request = {
        id: `qr-${state.counters.quoteRequest + 1}`, number: nextNumber("quoteRequest", "QR"), kind, status: "draft", shipmentId: shipment.id, material: shipment.mineral, from: COLLECTION_POINT, to: shipment.destination,
        service: text(input.service) || "Road · Bulk tipper · Multiple loads", quantityTonnes: shipment.tonnes, unit: "tonnes", collectionWindow: text(input.collectionWindow) || shortDate(shipment.preferredDate), requiredBy: text(input.requiredBy) || null,
        requirements, startDate: null, endDate: null, expectedVolume: null, volumePeriod: null, preferredBilling: null, providerIds: ids, replyBy: `${replyText.slice(0, 16)}:00+02:00`,
        sentRecordedAt: null, sentBy: null, createdBy: actor.name, createdAt: at, quotes: [], history: [],
      };
    } else {
      const startDate = dateOf(input.startDate, "The start date");
      const endDate = dateOf(input.endDate, "The end date");
      if (endDate < startDate) fail(400, "VALIDATION_ERROR", "The end date cannot be before the start date.");
      const volume = Number(input.expectedVolume);
      if (!Number.isFinite(volume) || volume <= 0) fail(400, "VALIDATION_ERROR", "Enter the expected quantity, more than 0. It is a planning estimate.");
      request = {
        id: `qr-${state.counters.quoteRequest + 1}`, number: nextNumber("quoteRequest", "QR"), kind, status: "draft", shipmentId: null, material: requireText(input.material, "The material", 3), from: requireText(input.from, "The collection point", 3), to: requireText(input.to, "The destination", 3),
        service: requireText(input.service, "The transport service", 3), quantityTonnes: null, unit: "tonnes", collectionWindow: null, requiredBy: null, requirements,
        startDate, endDate, expectedVolume: volume, volumePeriod: input.volumePeriod === "agreement" ? "agreement" : "calendar_month", preferredBilling: input.preferredBilling === "yearly" ? "yearly" : "monthly", providerIds: ids,
        replyBy: `${replyText.slice(0, 16)}:00+02:00`, sentRecordedAt: null, sentBy: null, createdBy: actor.name, createdAt: at, quotes: [], history: [],
      };
    }
    request.quotes = ids.map((providerId) => blankQuote(nextId("quote", "q"), providerId));
    request.history = [{ id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: "Request saved as a draft", note: null }];
    state.quoteRequests = [...state.quoteRequests, request];
    commit();
    return request;
  },

  /** Records that the request was sent by hand. Nothing is sent from VESPER. */
  recordRequestSent(id: string, actor: Actor) {
    assertTransportCan("record_quotes", actor);
    const request = findQuoteRequest(id);
    if (request.status !== "draft") fail(409, "READ_ONLY", "This request has already been recorded as sent.");
    const at = tick();
    request.status = "sent";
    request.sentRecordedAt = at;
    request.sentBy = actor.name;
    request.history = [...request.history, { id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: "Request recorded as sent (demo: nothing was sent)", note: null }];
    notify(null, "Quote request recorded as sent (demo)", `${request.number}: record each reply when it arrives. No message was sent.`, `/shipments/providers/quotes/${request.id}`, "logistics");
    return request;
  },

  /** Enters what a provider quoted, by hand, or records that the provider cannot quote. */
  recordTransportQuote(requestId: string, quoteId: string, input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("record_quotes", actor);
    const request = findQuoteRequest(requestId);
    if (request.status === "draft") fail(409, "READ_ONLY", "Record the request as sent before entering a reply.");
    const quote = request.quotes.find((item) => item.id === quoteId) ?? fail(404, "NOT_FOUND", "This quote could not be found.");
    if (quote.status === "accepted" || quote.status === "not_selected") fail(409, "READ_ONLY", "A decision has already been recorded for this quote.");
    const provider = findTransporter(quote.providerId);
    const at = tick();
    if (input.unavailable === true) {
      quote.status = "unavailable";
      quote.conditions = requireText(input.reason, "The reason", 3);
      request.history = [...request.history, { id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: `${provider.name} cannot quote`, note: quote.conditions }];
      return request;
    }
    const shipmentMethods = ["whole_shipment", "per_tonne", "per_load"];
    const agreementMethods = ["fixed_fee", "unit_rate", "fixed_plus_usage"];
    const method = text(input.method);
    if (!(request.kind === "shipment" ? shipmentMethods : agreementMethods).includes(method)) fail(400, "VALIDATION_ERROR", "Choose how the provider priced it.");
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) fail(400, "VALIDATION_ERROR", "Enter the quoted fee or rate, more than 0.");
    const receivedOn = dateOf(input.receivedOn, "The date received");
    const validUntil = dateOf(input.validUntil, "The date the quote is valid until");
    if (validUntil < receivedOn) fail(400, "VALIDATION_ERROR", "A quote cannot be valid until before it was received.");
    let loads: number | null = null;
    if (method === "per_load") {
      loads = Number(input.loads);
      if (!Number.isInteger(loads) || loads <= 0) fail(400, "VALIDATION_ERROR", "A per-load price needs the number of loads.");
    }
    const feePeriod = request.kind === "shipment" ? "shipment" : (["month", "year", "agreement"].includes(text(input.feePeriod)) ? (text(input.feePeriod) as FeePeriod) : fail(400, "VALIDATION_ERROR", "Choose what the fee covers: a month, a year or the whole agreement."));
    const optionalTonnes = (value: unknown) => (value === undefined || value === null || value === "" ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fail(400, "VALIDATION_ERROR", "Quantities and rates must be numbers, 0 or more."));
    Object.assign(quote, {
      status: "to_review" as const,
      reference: requireText(input.reference, "The quote reference", 2),
      receivedOn,
      validUntil,
      method: method as TransportQuote["method"],
      amount,
      feePeriod,
      loads,
      quantityTonnes: request.kind === "shipment" ? request.quantityTonnes : null,
      includedTonnes: request.kind === "agreement" ? optionalTonnes(input.includedTonnes) : null,
      allowancePeriod: request.kind === "agreement" ? (input.allowancePeriod === "agreement" ? "agreement" : "calendar_month") : null,
      billing: request.kind === "agreement" ? (input.billing === "yearly" ? "yearly" : input.billing === "custom" ? "custom" : "monthly") : null,
      excessRate: request.kind === "agreement" ? optionalTonnes(input.excessRate) : null,
      inclusions: text(input.inclusions).slice(0, 400),
      availability: text(input.availability).slice(0, 300),
      vat: input.vat === "included" ? "included" : input.vat === "excluded" ? "excluded" : "not_stated",
      fuelAdjustment: text(input.fuelAdjustment).slice(0, 300),
      otherCharges: text(input.otherCharges).slice(0, 300),
      exclusions: text(input.exclusions).slice(0, 300),
      conditions: text(input.conditions).slice(0, 400),
      attachments: readAttachments(input.attachments),
    });
    request.history = [...request.history, { id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: `Quote ${quote.reference} recorded from ${provider.name}`, note: null }];
    return request;
  },

  /**
   * Accepts or does not select a quote, keeping who decided, when and why. Accepting a shipment quote sets the shipment's provider and its
   * agreed transport cost, and is the shipment's one pricing source. Replacing an existing source needs an explicit `replace`.
   */
  decideTransportQuote(requestId: string, quoteId: string, input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("decide_quotes", actor);
    const request = findQuoteRequest(requestId);
    const quote = request.quotes.find((item) => item.id === quoteId) ?? fail(404, "NOT_FOUND", "This quote could not be found.");
    const reason = requireText(input.reason, "The reason", 5);
    const status = quoteStatusNow(quote, now().slice(0, 10));
    if (quote.status === "accepted" || quote.status === "not_selected") fail(409, "READ_ONLY", "A decision has already been recorded for this quote.");
    const provider = findTransporter(quote.providerId);
    const at = tick();
    if (input.decision === "not_selected") {
      if (status !== "to_review" && status !== "expired") fail(409, "READ_ONLY", "Only a quote that has been received can be marked not selected.");
      quote.status = "not_selected";
      quote.decision = { by: actor.name, at, reason };
      request.history = [...request.history, { id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: `${provider.name} not selected`, note: reason }];
    } else if (input.decision === "accept") {
      if (status === "expired") fail(409, "EXPIRED", "This quote has expired. Ask the provider to confirm it before accepting.");
      if (status !== "to_review") fail(409, "READ_ONLY", "Only a quote that has been received can be accepted.");
      if (request.quotes.some((item) => item.status === "accepted")) fail(409, "READ_ONLY", "Another quote has already been accepted for this request.");
      if (provider.approval !== "approved") fail(409, "NOT_ELIGIBLE", `${provider.name} is not approved by the mine.`);
      if (request.kind === "shipment") {
        const shipment = findShipment(String(request.shipmentId));
        if (shipment.state === "dispatched" || shipment.state === "delivered" || shipment.state === "cancelled") fail(409, "READ_ONLY", `${shipment.number} has already left the mine or is finished.`);
        const total = quoteTotal(quote);
        if (total === null) fail(409, "NOT_READY", "This quote's total cannot be worked out yet. A per-load price needs the number of loads.");
        if (shipment.pricingSource && input.replace !== true) fail(409, "PRICING_SOURCE", `${shipment.number} already has a transport price (${shipment.pricingSource.label}). Replace it explicitly to use this quote instead.`);
        setPricingSource(shipment, { type: "quote", quoteId: quote.id, requestId: request.id, agreementId: null, providerId: provider.id, costExVat: total, label: `Quote ${request.number} · ${provider.name}`, setBy: actor.name, setAt: at }, actor, text(input.replaceReason) || reason);
        shipment.transporterId = provider.id;
      }
      quote.status = "accepted";
      quote.decision = { by: actor.name, at, reason };
      request.history = [...request.history, { id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: `Accepted ${provider.name}`, note: reason }];
    } else {
      fail(400, "VALIDATION_ERROR", "Choose accept or not selected.");
    }
    if (request.quotes.some((item) => item.status === "accepted") || request.quotes.every((item) => !["waiting", "to_review"].includes(item.status))) request.status = "decision_recorded";
    return request;
  },

  /** Records an agreement: from an accepted proposal, or directly from its document. It stays a draft until an authorised user confirms its terms. */
  createAgreement(input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("record_quotes", actor);
    const commit = guardRepeat(input);
    const fields = readAgreementFields(input);
    const at = tick();
    const agreement: Agreement = {
      ...fields, id: `ag-${String(state.counters.agreement + 1).padStart(4, "0")}`, number: nextNumber("agreement", "AG"), currency: "ZAR", confirmedBy: null, confirmedAt: null, endedAt: null, endReason: null,
      history: [{ id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: fields.sourceQuoteId ? "Draft prefilled from an accepted proposal; terms still to be reviewed" : "Recorded from its document; terms still to be reviewed", note: null }], version: 1, createdAt: at,
    };
    state.agreements = [...state.agreements, agreement];
    commit();
    return agreement;
  },

  updateAgreement(id: string, input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("record_quotes", actor);
    const agreement = findAgreement(id);
    if (typeof input.version === "number" && input.version !== agreement.version) fail(409, "VERSION_CONFLICT", "This agreement changed while you were editing. Reload to see the latest version, then try again.");
    if (agreement.endedAt) fail(409, "READ_ONLY", "An ended agreement is kept as it is.");
    // Changing terms that were already confirmed is itself a decision for an authorised user.
    if (agreement.confirmedAt) assertTransportCan("confirm_agreements", actor);
    const next = readAgreementFields({ ...agreement, ...input });
    const changes = describeAgreementChanges(agreement, next);
    if (changes.length === 0) fail(400, "VALIDATION_ERROR", "Nothing was changed.");
    Object.assign(agreement, next);
    agreement.version += 1;
    const at = tick();
    agreement.history = [...agreement.history, ...changes.map((summary) => ({ id: nextId("transportHistory", "tph"), at, actor: actor.name, summary, note: text(input.reason) || null }))];
    return agreement;
  },

  confirmAgreement(id: string, input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("confirm_agreements", actor);
    const agreement = findAgreement(id);
    if (agreement.confirmedAt) fail(409, "READ_ONLY", "This agreement has already been confirmed.");
    if (agreement.endedAt) fail(409, "READ_ONLY", "An ended agreement cannot be confirmed.");
    const provider = findTransporter(agreement.providerId);
    if (provider.approval !== "approved") fail(409, "NOT_ELIGIBLE", `${provider.name} is not approved by the mine, so its agreement cannot be activated.`);
    if (agreement.method !== "manual_estimate" && agreement.fee === null) fail(409, "NOT_READY", "The agreement has no fee or rate yet. Complete its terms before confirming.");
    const at = tick();
    agreement.confirmedBy = actor.name;
    agreement.confirmedAt = at;
    agreement.version += 1;
    agreement.history = [...agreement.history, { id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: "Terms reviewed and agreement confirmed", note: text(input.note) || null }];
    return agreement;
  },

  endAgreement(id: string, input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("confirm_agreements", actor);
    const agreement = findAgreement(id);
    if (agreement.endedAt) fail(409, "READ_ONLY", "This agreement has already ended.");
    const reason = requireText(input.reason, "The reason", 5);
    const at = tick();
    agreement.endedAt = at;
    agreement.endReason = reason;
    agreement.version += 1;
    agreement.history = [...agreement.history, { id: nextId("transportHistory", "tph"), at, actor: actor.name, summary: "Agreement ended", note: reason }];
    return agreement;
  },

  /** Records an agreement's fixed fee once for a charge period. Linked shipments are never charged the fee again. */
  recordCharge(id: string, input: Record<string, unknown>, actor: Actor) {
    assertTransportCan("confirm_agreements", actor);
    const agreement = findAgreement(id);
    if (!agreement.confirmedAt) fail(409, "NOT_READY", "Confirm the agreement before recording its fees.");
    const period = text(input.period);
    if (!chargePeriods(agreement).includes(period)) fail(400, "VALIDATION_ERROR", "That is not a charge period of this agreement.");
    if (state.charges.some((item) => item.agreementId === agreement.id && item.period === period)) fail(409, "DUPLICATE", `The fee for ${periodName(period)} has already been recorded for ${agreement.number}.`);
    const amount = chargeAmount(agreement);
    if (amount === null) fail(409, "NOT_READY", "This agreement has no fee to record. Add a manual estimate if its terms are more complex.");
    const charge: AgreementCharge = { id: nextId("charge", "chg"), agreementId: agreement.id, period, amount, recordedBy: actor.name, recordedAt: tick() };
    state.charges = [...state.charges, charge];
    agreement.history = [...agreement.history, { id: nextId("transportHistory", "tph"), at: charge.recordedAt, actor: actor.name, summary: `Fee recorded for ${periodName(period)}: ${formatRand(amount)}`, note: null }];
    return charge;
  },

  /** Uses an agreement as a shipment's transport price. One source at a time: replacing needs `replace` and a reason, and the history is kept. */
  applyAgreement(shipmentId: string, agreementId: string, input: Record<string, unknown>, actor: Actor) {
    assertShipmentsCan("manage_shipments", actor);
    const shipment = findShipment(shipmentId);
    const agreement = findAgreement(agreementId);
    if (shipment.state === "dispatched" || shipment.state === "delivered" || shipment.state === "cancelled") fail(409, "READ_ONLY", `${shipment.number} has already left the mine or is finished.`);
    const { eligible, rejected } = eligibleAgreements(state.agreements, state.transporters, shipment, TRANSPORT_DEMO_DATE);
    if (!eligible.some((item) => item.id === agreement.id)) fail(409, "NOT_ELIGIBLE", rejected.find((item) => item.agreement.id === agreement.id)?.reason ?? "This agreement cannot be used for this shipment.");
    if (shipment.pricingSource && input.replace !== true) fail(409, "PRICING_SOURCE", `${shipment.number} already has a transport price (${shipment.pricingSource.label}). Replace it explicitly to use this agreement instead.`);
    if (shipment.pricingSource?.type === "agreement" && shipment.pricingSource.agreementId === agreement.id) fail(409, "DUPLICATE", `${shipment.number} already uses ${agreement.number}.`);
    const reason = shipment.pricingSource ? requireText(input.reason, "The reason for replacing it", 5) : text(input.reason) || null;
    const at = tick();
    setPricingSource(shipment, { type: "agreement", quoteId: null, requestId: null, agreementId: agreement.id, providerId: agreement.providerId, costExVat: null, label: `Agreement ${agreement.number}`, setBy: actor.name, setAt: at }, actor, reason);
    shipment.transporterId = agreement.providerId;
    return shipment;
  },


  // ---- Impact ("What happens if we wait?") --------------------------------------------------
  // ---- Automations ------------------------------------------------------------------------------

  /** The seven rules as set, with their definitions, and the recent runs. Only the Mine Manager manages them. */
  automations(actor?: Actor) {
    const canManage = Boolean(actor && canManageOrganisation(actor).allowed);
    return {
      now: now(),
      canManage,
      recipients: recipientRoles,
      rules: automationCatalogue.map((definition) => ({ definition, rule: state.automations.find((item) => item.key === definition.key)! })),
      runs: [...state.automationRuns].reverse().slice(0, 15),
    };
  },

  /** Switches a rule on or off, chooses who is told, or sets how early or late it counts. Every change is kept in the history. */
  updateAutomation(key: string, input: Record<string, unknown>, actor: Actor) {
    assertOrganisationManager(actor);
    const definition = definitionOf(key) ?? fail(404, "NOT_FOUND", "This automation could not be found.");
    const rule = state.automations.find((item) => item.key === definition.key)!;
    const lines: string[] = [];
    if (typeof input.enabled === "boolean" && input.enabled !== rule.enabled) {
      rule.enabled = input.enabled;
      // A rule that has been off starts fresh: whatever is wrong when it is switched back on counts as new.
      if (!input.enabled) rule.fired = [];
      lines.push(input.enabled ? "switched on" : "switched off");
    }
    if (input.recipient !== undefined && input.recipient !== rule.recipient) {
      const recipient = String(input.recipient);
      const allowed = recipient === "owner" ? definition.hasOwner : (recipientRoles as readonly string[]).includes(recipient);
      if (!allowed) fail(400, "VALIDATION_ERROR", "Choose who is told from the list.");
      rule.recipient = recipient as AutomationRecipient;
      lines.push(`now tells ${recipient === "owner" ? "the owner of the record" : recipient}`);
    }
    if (input.threshold !== undefined && definition.threshold) {
      const value = Number(input.threshold);
      if (!Number.isFinite(value) || value < definition.threshold.min || value > definition.threshold.max) fail(400, "VALIDATION_ERROR", `Enter ${definition.threshold.label.toLowerCase()} between ${definition.threshold.min} and ${definition.threshold.max} ${definition.threshold.unit}.`);
      if (value !== rule.threshold) {
        rule.threshold = value;
        rule.fired = [];
        lines.push(`${definition.threshold.label.toLowerCase()} ${value} ${definition.threshold.unit}`);
      }
    }
    if (lines.length === 0) fail(400, "VALIDATION_ERROR", "Nothing was changed.");
    state.automationRuns = [...state.automationRuns, { id: nextId("automationRun", "arn"), at: tick(), actor: actor.name, kind: "setting", ruleKey: definition.key, found: 0, notified: 0, summary: `${definition.name}: ${lines.join(", ")}` }];
    return demoDomain.automations(actor);
  },

  /**
   * Runs one rule, or every rule that is on, against the records as they are now. New findings notify the chosen people; findings that
   * were already announced are not announced again. Nothing but notifications is created, and nothing leaves VESPER.
   */
  runAutomations(input: Record<string, unknown>, actor: Actor) {
    assertOrganisationManager(actor);
    const key = typeof input.key === "string" && input.key ? input.key : null;
    const selected = key ? [state.automations.find((item) => item.key === key) ?? fail(404, "NOT_FOUND", "This automation could not be found.")] : state.automations.filter((item) => item.enabled);
    if (key && !selected[0].enabled) fail(409, "READ_ONLY", "Switch this automation on before running it.");
    if (selected.length === 0) fail(409, "READ_ONLY", "No automation is switched on. Switch one on to run it.");
    const vehicles = fleetVehicles();
    const inputs = {
      now: now(),
      issues: demoDomain.listIssues(),
      equipment: demoDomain.listEquipment(),
      shifts: demoDomain.listShifts(),
      shipments: state.shipments,
      providers: state.providers,
      fleetAlerts: state.shipments.flatMap((shipment) => fleetAlertsFor(shipment, vehicles).map((alert) => ({ shipment, alert }))),
    };
    const peopleWith = (role: string) => state.members.filter((member) => member.status !== "deactivated" && member.role === role).map((member) => member.name);
    let totalFound = 0;
    let totalNotified = 0;
    for (const rule of selected) {
      const definition = definitionOf(rule.key)!;
      const findings: Finding[] = evaluate(rule.key, rule.threshold, inputs);
      const fresh = findings.filter((item) => !rule.fired.includes(item.recordKey));
      let notified = 0;
      for (const finding of fresh) {
        const names = rule.recipient === "owner" ? [finding.owner ?? peopleWith("Mine Manager")[0] ?? null] : peopleWith(rule.recipient);
        for (const name of names) {
          if (!name) continue;
          notify(name, definition.name, `${finding.title}. ${finding.detail}`, finding.href, "automation");
          notified += 1;
        }
      }
      rule.fired = findings.map((item) => item.recordKey);
      rule.lastRunAt = tick();
      rule.lastFound = findings.length;
      rule.lastNotified = notified;
      totalFound += findings.length;
      totalNotified += notified;
      state.automationRuns = [...state.automationRuns, { id: nextId("automationRun", "arn"), at: rule.lastRunAt, actor: actor.name, kind: "run", ruleKey: rule.key, found: findings.length, notified, summary: findings.length === 0 ? `${definition.name}: nothing found` : `${definition.name}: ${findings.length} found, ${notified} notified${fresh.length < findings.length ? `, ${findings.length - fresh.length} already announced` : ""}` }];
    }
    return { ...demoDomain.automations(actor), summary: { rulesRun: selected.length, found: totalFound, notified: totalNotified } };
  },

  // ---- Shift briefing review (VESPER Intelligence) ------------------------------------------

  /** The generated briefing for the current shift, any supervisor corrections, and whether it has been approved. Reading changes nothing. */
  briefing(actor?: Actor) {
    const generated = buildBriefing({ shifts: demoDomain.listShifts(), issues: demoDomain.listIssues() });
    const record = generated.shiftId ? state.briefings.find((item) => item.shiftId === generated.shiftId) ?? null : null;
    const view = record ?? { shiftId: generated.shiftId ?? "", state: "draft" as const, corrections: {}, note: "", approvedBy: null, approvedAt: null, approvedGenerated: null, history: [] };
    return {
      shiftId: generated.shiftId,
      shiftName: generated.shiftName,
      generated,
      record: view,
      lines: effectiveLines(generated, view),
      changedLines: changedSinceApproval(generated, view),
      canReview: Boolean(actor && canReviewBriefing(actor)),
    };
  },

  /** Saves a supervisor's corrections and note. The briefing stays a draft until it is approved. */
  saveBriefing(input: Record<string, unknown>, actor: Actor) {
    return saveBriefingRecord(input, actor, false);
  },

  /** Approves the briefing as it stands, with the supervisor's corrections. Approving does not send the handover or change any record. */
  approveBriefing(input: Record<string, unknown>, actor: Actor) {
    return saveBriefingRecord(input, actor, true);
  },

  /** Takes an approved briefing back to a draft so it can be corrected and approved again. The earlier approval stays in the history. */
  reopenBriefing(input: Record<string, unknown>, actor: Actor) {
    if (!canReviewBriefing(actor)) fail(403, "FORBIDDEN", reviewMessage);
    const generated = buildBriefing({ shifts: demoDomain.listShifts(), issues: demoDomain.listIssues() });
    const record = generated.shiftId ? state.briefings.find((item) => item.shiftId === generated.shiftId) : undefined;
    if (!record || record.state !== "approved") fail(409, "READ_ONLY", "This briefing has not been approved, so there is nothing to reopen.");
    const reason = requireText(input.reason, "The reason", 5);
    record.state = "draft";
    record.approvedBy = null;
    record.approvedAt = null;
    record.history = [...record.history, { id: nextId("briefingEvent", "bre"), at: tick(), actor: actor.name, summary: `Reopened for review: ${reason}` }];
    return demoDomain.briefing(actor);
  },

  impact: (actor?: Actor) => buildImpact(actor),

  /** Changes the estimate (outage length, usable stock, approved catch-up). The previous estimate stays in the history with the reason. */
  updateImpact(input: Record<string, unknown>, actor: Actor) {
    assertImpactCan("update_impact", actor);
    const scenario = state.impact;
    const reason = requireText(input.reason, "The reason for the change", 5);
    const before = impactSnapshot(scenario, true);
    let changed = false;
    if ("outageHours" in input) {
      if (scenario.repairCompletedAt) fail(409, "READ_ONLY", "The repair is recorded as complete, so the outage is the recorded actual and is kept.");
      scenario.outageHours = hoursOf(input.outageHours, "The outage length");
      changed = true;
    }
    if ("usableStockTonnes" in input) {
      scenario.usableStockTonnes = stockOf(input.usableStockTonnes, "The usable stock");
      changed = true;
    }
    if ("catchUpTonnes" in input) {
      scenario.catchUpTonnes = stockOf(input.catchUpTonnes, "The approved catch-up");
      changed = true;
    }
    if (!changed) fail(400, "VALIDATION_ERROR", "Change at least one input.");
    scenario.updatedAt = tick();
    scenario.updatedBy = actor.name;
    logImpact("estimate", reason, actor, before);
    notify(scenario.responsible, "Repair estimate updated (demo)", `${scenario.label}: ${reason} No message was sent to anyone.`, `/exceptions/${scenario.issueId}`, "impact");
    return buildImpact(actor);
  },

  /**
   * Records the repair as complete with the actual outage. The actual downtime is kept and the forecast is recalculated from it. Any
   * shortfall that remains stays until a recovery is recorded: finishing the repair does not recover the lost output, and the
   * equipment and issue are marked as reported, not verified.
   */
  completeRepair(input: Record<string, unknown>, actor: Actor) {
    assertImpactCan("update_impact", actor);
    const scenario = state.impact;
    if (scenario.repairCompletedAt) fail(409, "READ_ONLY", "The repair has already been recorded as complete.");
    const hours = hoursOf(input.actualOutageHours, "The actual outage");
    if (hours === null || hours <= 0) fail(400, "VALIDATION_ERROR", "Enter how many hours the crusher was out, from the breakdown to the repair.");
    const note = text(input.note);
    const before = impactSnapshot(scenario, true);
    scenario.outageHours = hours;
    scenario.actualOutageHours = hours;
    scenario.repairCompletedAt = tick();
    scenario.updatedAt = scenario.repairCompletedAt;
    scenario.updatedBy = actor.name;
    const equipment = state.equipment.find((item) => item.id === scenario.equipmentId);
    if (equipment) {
      equipment.state = "available";
      equipment.stateNote = "Repair recorded as complete. Not yet independently verified.";
      equipment.stateQuality = "reported";
      equipment.stateUpdatedAt = scenario.repairCompletedAt;
      recordEquipment(equipment, actor, { type: "state_changed", summary: "Reported available: repair complete", note: note || null, state: "available", reason: null });
    }
    const issue = state.issues.find((item) => item.id === scenario.issueId);
    if (issue && isOpen(issue) && issue.workflowState !== "resolution_reported") {
      const previousState = issue.workflowState;
      issue.workflowState = "resolution_reported";
      issue.resolutionReportedBy = actor.name;
      record(issue, actor, { type: "state_changed", summary: "Repair recorded as complete; waiting for independent verification", previousState, nextState: "resolution_reported", note: note || null });
    }
    logImpact("repair_complete", note || `Repair complete after ${hours} hours.`, actor, before);
    notify(scenario.responsible, "Repair recorded complete (demo)", `${scenario.label}: actual outage ${hours} hours. The remaining shortfall is unchanged until a recovery is recorded. No message was sent to anyone.`, `/exceptions/${scenario.issueId}`, "impact");
    return buildImpact(actor);
  },

  /** Records gold produced towards the shortfall. This is recorded progress. It is not verified stock and releases nothing for dispatch. */
  recordRecovery(input: Record<string, unknown>, actor: Actor) {
    assertImpactCan("record_recovery", actor);
    const scenario = state.impact;
    const result = impactResultOf(scenario);
    if (!result.assessed || !result.remainingShortfallGrams) fail(409, "READ_ONLY", "There is no shortfall to recover.");
    const grams = Number(input.grams);
    if (!Number.isFinite(grams) || grams <= 0) fail(400, "VALIDATION_ERROR", "Enter the grams recovered, more than 0.");
    if (grams > result.remainingShortfallGrams) fail(409, "TOO_MUCH", `Only ${result.remainingShortfallGrams} g is still short.`);
    const reason = requireText(input.note, "The production record or plan", 5);
    const before = impactSnapshot(scenario, true);
    scenario.recoveredGrams = Math.round((scenario.recoveredGrams + grams) * 100) / 100;
    scenario.updatedAt = tick();
    scenario.updatedBy = actor.name;
    logImpact("recovery", reason, actor, before);
    return buildImpact(actor);
  },

  /** Puts the Gold demonstration back to how it started: the crusher stopped, a four hour estimate, and an empty history. */
  resetImpact(actor: Actor) {
    assertImpactCan("update_impact", actor);
    state.impact = clone(seedImpactScenario);
    state.impactHistory = [];
    const index = (list: { id: string }[], id: string) => list.findIndex((item) => item.id === id);
    state.equipment[index(state.equipment, GOLD_EQUIPMENT_ID)] = clone(goldEquipment);
    state.issues[index(state.issues, GOLD_ISSUE_ID)] = clone(goldIssue);
    state.readiness[index(state.readiness, GOLD_ACTIVITY_ID)] = clone(goldReadiness);
    return buildImpact(actor);
  },

  // ---- Notifications ---------------------------------------------------------------------
  /** Tells everyone who holds a role. Trade uses it to ask for an approval. */
  notifyRole(role: string, title: string, detail: string, href: string, category = "trade") {
    for (const member of state.members.filter((item) => item.role === role)) notify(member.name, title, detail, href, category);
  },

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
