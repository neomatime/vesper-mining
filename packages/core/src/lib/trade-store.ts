/**
 * The Trade store: the commercial records (see trade-rules.ts) and every change to them, with the rules applied on the server side of
 * the demo API so the screens cannot bypass them. Persisted to localStorage under its own versioned key; reset with the rest of the
 * demonstration.
 *
 * Trade never copies Mining Operations records. It reads shipments, areas, shifts and issues from the Mining Operations store each
 * time a view is built, so a dispatch or delivery recorded there appears here at once, and Trade's changes never alter them.
 *
 * Prices, values, balances and confidential documents are left out of the view for roles without pricing access.
 */
import { demoTimeAt } from "./demo-clock";
import { DemoError, demoDomain } from "./demo-store";
import { isOpen } from "./issue-rules";
import type { Actor } from "./issue-rules";
import {
  addDays,
  agreementHealth,
  approverFor,
  canDecide,
  canTrade,
  COMMODITIES,
  daysBetween,
  deliveryStage,
  deliveryTiming,
  documentKinds,
  folderLabels,
  formatRand,
  formatTonnes,
  frequencyLabels,
  fulfilmentShare,
  quantitiesOf,
  reportKindLabels,
  settlementPaid,
  settlementStatus,
  type Agreement,
  type Approval,
  type ApprovalType,
  type Client,
  type Commitment,
  type Commodity,
  type Delivery,
  type DeliveryLocation,
  type DeliveryPlan,
  type Enquiry,
  loadFormLabels,
  locationSourceLabels,
  offloadingLabels,
  requiredDocumentLabels,
  routeSourceLabels,
  straightKm,
  validPosition,
  type SavedLocation,
  type Folder,
  type OperationLink,
  type ReportKind,
  type SavedReport,
  type Settlement,
  type ShipmentFacts,
  type TradeCapability,
  type TradeDocument,
  type TradeEvent,
} from "./trade-rules";
import { seedAgreements, seedApprovals, seedClients, seedDeliveries, seedDocuments, seedEnquiries, seedLinks, seedLocations, seedReports, seedSettlements, TRADE_TODAY, tradeCounters } from "./trade-data";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const initial = () => ({
  clock: 0,
  clients: clone(seedClients),
  enquiries: clone(seedEnquiries),
  agreements: clone(seedAgreements),
  deliveries: clone(seedDeliveries),
  settlements: clone(seedSettlements),
  approvals: clone(seedApprovals),
  documents: clone(seedDocuments),
  links: clone(seedLinks),
  reports: clone(seedReports),
  locations: clone(seedLocations),
  counters: { ...tradeCounters },
  submissions: [] as string[],
});

export type TradeState = ReturnType<typeof initial>;

const STORAGE_KEY = "vesper-trade-state-v1";

function load(): TradeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TradeState>;
    const valid = typeof parsed.clock === "number" && [parsed.clients, parsed.enquiries, parsed.agreements, parsed.deliveries, parsed.settlements, parsed.approvals, parsed.documents, parsed.links, parsed.reports, parsed.submissions].every(Array.isArray) && Boolean(parsed.counters);
    if (!valid) return null;
    // Saved before exact locations existed: add the standard locations and plans, keep everything else.
    if (!Array.isArray(parsed.locations)) {
      parsed.locations = clone(seedLocations);
      parsed.counters = { ...parsed.counters!, location: seedLocations.length };
      for (const delivery of parsed.deliveries!) if (delivery.plan === undefined) delivery.plan = clone(seedDeliveries.find((item) => item.id === delivery.id)?.plan ?? null);
    }
    return parsed as TradeState;
  } catch {
    return null;
  }
}

let state: TradeState = load() ?? initial();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const next = load();
    if (next) state = next;
  });
}

function save() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or unavailable; the change still applies for this page view.
  }
}

// ---- Small helpers -------------------------------------------------------------------------------------------------------

function fail(status: number, code: string, message: string): never {
  throw new DemoError(status, code, message);
}

/** Trade time: the scenario's 'now' plus one minute per Trade change, so Trade events stay in order. */
const now = () => demoTimeAt(state.clock);
const tick = () => {
  state.clock += 1;
  return now();
};
const today = () => TRADE_TODAY;

const event = (actor: Actor, summary: string, note: string | null = null): TradeEvent => {
  state.counters.event += 1;
  return { id: `tev-${String(state.counters.event).padStart(4, "0")}`, at: tick(), actor: actor.name, summary, note };
};

function assertCan(capability: TradeCapability, actor: Actor) {
  const check = canTrade(capability, actor);
  if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You cannot do this.");
}

/** Refuses a submission that was already accepted (a double click or a retried request), so nothing is saved twice. */
function guardRepeat(input: Record<string, unknown>) {
  const id = typeof input.submissionId === "string" ? input.submissionId : null;
  if (!id) return;
  if (state.submissions.includes(id)) fail(409, "DUPLICATE_SUBMISSION", "This was already saved. Refresh to see it.");
  state.submissions = [id, ...state.submissions].slice(0, 200);
}

function checkVersion(record: { version: number }, input: Record<string, unknown>) {
  if (typeof input.version === "number" && input.version !== record.version) fail(409, "VERSION_CONFLICT", "Someone else changed this record. Refresh and try again.");
}

const text = (value: unknown, label: string, min = 2, max = 200) => {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < min) fail(400, "VALIDATION", `${label} needs at least ${min} characters.`);
  if (result.length > max) fail(400, "VALIDATION", `${label} can be at most ${max} characters.`);
  return result;
};
const optionalText = (value: unknown, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const positive = (value: unknown, label: string, max = 1_000_000) => {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result) || result <= 0) fail(400, "VALIDATION", `${label} must be more than zero.`);
  if (result > max) fail(400, "VALIDATION", `${label} looks too large. Check the number.`);
  return Math.round(result * 100) / 100;
};
const date = (value: unknown, label: string) => {
  const result = typeof value === "string" ? value.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result))) fail(400, "VALIDATION", `${label} must be a valid date.`);
  return result;
};
const commodity = (value: unknown): Commodity => ((COMMODITIES as readonly string[]).includes(String(value)) ? (value as Commodity) : fail(400, "VALIDATION", "Choose a commodity.") as never);
const nextNumber = (key: keyof TradeState["counters"], prefix: string, width = 4) => {
  state.counters[key] += 1;
  return `${prefix}-${String(state.counters[key]).padStart(width, "0")}`;
};

const choice = <T extends Record<string, string>>(labels: T, value: unknown, label: string): keyof T & string => (typeof value === "string" && value in labels ? value : fail(400, "VALIDATION", `Choose ${label}.`));
const clockTime = (value: unknown, label: string) => {
  const result = typeof value === "string" ? value.trim() : "";
  if (result && !/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) fail(400, "VALIDATION", `${label} must be a time such as 07:00.`);
  return result;
};
const phone = (value: unknown, label: string) => {
  const result = optionalText(value, 30);
  if (result && !/^\+?[\d\s()-]{7,20}$/.test(result)) fail(400, "VALIDATION", `${label} is not a valid phone number.`);
  return result;
};
const email = (value: unknown, label: string) => {
  const result = optionalText(value, 120);
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, "VALIDATION", `${label} is not a valid email address.`);
  return result;
};
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** An exact point: a name, an address and coordinates, and where they came from. */
function location(value: unknown, label: string): DeliveryLocation {
  const input = record(value);
  const position = Array.isArray(input.position) ? input.position.map(Number) : null;
  if (!validPosition(position)) fail(400, "VALIDATION", `Set the ${label} on the map, by search or with coordinates.`);
  return {
    name: text(input.name, `The ${label} name`, 2, 120),
    address: optionalText(input.address, 240),
    position: [Math.round(position[0] * 1e6) / 1e6, Math.round(position[1] * 1e6) / 1e6],
    source: choice(locationSourceLabels, input.source, `how the ${label} was found`),
    placeId: optionalText(input.placeId, 300) || null,
    savedLocationId: optionalText(input.savedLocationId, 60) || null,
  };
}

/** The full plan: both sites with contacts and windows, the route, the load, transport and documents. */
function deliveryPlan(value: unknown, tonnes: number): DeliveryPlan {
  const input = record(value);
  const collection = record(input.collection);
  const receiving = record(input.receiving);
  const route = record(input.route);
  const load = record(input.load);
  const logistics = record(input.logistics);
  const compliance = record(input.compliance);
  const from = location(collection.location, "collection point");
  const to = location(receiving.location, "delivery point");
  if (straightKm(from.position, to.position) < 0.2) fail(400, "VALIDATION", "The collection and delivery points are the same place. Check both locations.");
  const site = (part: Record<string, unknown>, label: string) => {
    const windowFrom = clockTime(part.windowFrom, `The ${label} window start`);
    const windowTo = clockTime(part.windowTo, `The ${label} window end`);
    if (windowFrom && windowTo && windowTo <= windowFrom) fail(400, "VALIDATION", `The ${label} window must end after it starts.`);
    return { contactName: text(part.contactName, `The ${label} contact`, 2, 80), contactPhone: phone(part.contactPhone, `The ${label} phone`), contactEmail: email(part.contactEmail, `The ${label} email`), windowFrom, windowTo, instructions: optionalText(part.instructions, 500) };
  };
  const points = (Array.isArray(route.points) ? route.points : []).map((point) => (Array.isArray(point) ? point.map(Number) : null)).filter(validPosition);
  const km = positive(route.km, "The route distance", 5000);
  const loadCount = Math.round(positive(load.loadCount, "The number of loads", 500));
  const tonnesPerLoad = positive(load.tonnesPerLoad, "The tonnes per load", 80);
  if (loadCount * tonnesPerLoad < tonnes) fail(400, "VALIDATION", `${loadCount} loads of ${formatTonnes(tonnesPerLoad)} carry ${formatTonnes(loadCount * tonnesPerLoad)}, less than the ${formatTonnes(tonnes)} planned. Add loads.`);
  const moisture = load.moisturePercent === null || load.moisturePercent === "" || load.moisturePercent === undefined ? null : Number(load.moisturePercent);
  if (moisture !== null && (!Number.isFinite(moisture) || moisture < 0 || moisture > 40)) fail(400, "VALIDATION", "Moisture must be between 0 and 40%.");
  const vehicles = (Array.isArray(logistics.vehicles) ? logistics.vehicles : []).map(record).map((vehicle, index) => ({
    registration: text(vehicle.registration, `Vehicle ${index + 1} registration`, 4, 20).toUpperCase(),
    driverName: optionalText(vehicle.driverName, 80),
    driverPhone: phone(vehicle.driverPhone, `Vehicle ${index + 1} driver phone`),
    trackingUnit: optionalText(vehicle.trackingUnit, 40),
  }));
  if (vehicles.length > loadCount) fail(400, "VALIDATION", `${vehicles.length} vehicles are listed for ${loadCount} loads.`);
  if (new Set(vehicles.map((item) => item.registration)).size < vehicles.length) fail(400, "VALIDATION", "A vehicle is listed twice.");
  const transporterId = optionalText(logistics.transporterId, 40) || null;
  const transporter = transporterId ? demoDomain.get().transporters.find((item) => item.id === transporterId) ?? fail(400, "VALIDATION", "Choose a transport provider from the list.") : null;
  const documents = (Array.isArray(compliance.documents) ? compliance.documents : []).filter((item): item is keyof typeof requiredDocumentLabels => typeof item === "string" && item in requiredDocumentLabels);
  return {
    collection: { location: from, ...site(collection, "collection") },
    receiving: { location: to, ...site(receiving, "delivery"), offloading: choice(offloadingLabels, receiving.offloading, "the offloading method"), weighbridgeOnSite: receiving.weighbridgeOnSite === true, safetyRequirements: optionalText(receiving.safetyRequirements, 500) },
    route: { points: points.length >= 2 ? points : [from.position, to.position], km: Math.round(km * 10) / 10, minutes: Math.round(positive(route.minutes, "The travel time", 10_000)), source: choice(routeSourceLabels, route.source, "the route source") },
    load: { grade: optionalText(load.grade, 80), form: choice(loadFormLabels, load.form, "how the load is carried"), loadCount, tonnesPerLoad, moisturePercent: moisture },
    logistics: { transporterId: transporter?.id ?? null, transporterName: transporter?.name ?? "", vehicles, trackingRequired: logistics.trackingRequired !== false },
    compliance: { documents: [...new Set(documents)], hazardous: compliance.hazardous === true, specialInstructions: optionalText(compliance.specialInstructions, 1000) },
  };
}

/** Saves the plan's new sites for reuse when the planner asked for it (saveCollection / saveDelivery). */
function rememberLocations(plan: DeliveryPlan, clientId: string | null, input: Record<string, unknown>, actor: Actor) {
  const keep = (point: DeliveryLocation, kind: "collection" | "delivery") => {
    if (point.savedLocationId || state.locations.some((item) => item.kind === kind && straightKm(item.position, point.position) < 0.05)) return;
    state.counters.location += 1;
    const id = `loc-${String(state.counters.location).padStart(3, "0")}`;
    state.locations.push({ ...point, id, savedLocationId: id, kind, clientId: kind === "delivery" ? clientId : null, notes: "", createdBy: actor.name, createdAt: now() });
    point.savedLocationId = id;
  };
  if (input.saveCollection === true) keep(plan.collection.location, "collection");
  if (input.saveDelivery === true) keep(plan.receiving.location, "delivery");
}

const find = <T extends { id: string }>(items: T[], id: string, what: string): T => items.find((item) => item.id === id) ?? fail(404, "NOT_FOUND", `This ${what} could not be found.`);
const clientName = (id: string | null) => (id ? state.clients.find((item) => item.id === id)?.name ?? "Unknown client" : "All clients");

// ---- Mining Operations facts, read each time --------------------------------------------------------------------------

function miningFacts() {
  const mining = demoDomain.get();
  const transporterName = (id: string | null) => (id ? mining.transporters.find((item) => item.id === id)?.name ?? null : null);
  const shipments = new Map<string, ShipmentFacts>(
    mining.shipments.map((shipment) => [
      shipment.id,
      {
        id: shipment.id,
        number: shipment.number,
        state: shipment.state,
        tonnes: shipment.tonnes,
        dispatched: shipment.dispatches.reduce((total, item) => total + item.tonnes, 0),
        received: shipment.deliveries.reduce((total, item) => total + item.tonnes, 0),
        dispatchedAt: shipment.dispatches.at(-1)?.at ?? null,
        receivedAt: shipment.deliveries.at(-1)?.at ?? null,
        preferredDate: shipment.preferredDate,
        transporter: shipment.transportMode === "own_fleet" ? "Own fleet" : transporterName(shipment.transporterId),
      },
    ]),
  );
  return { mining, shipments };
}

// ---- Views ---------------------------------------------------------------------------------------------------------------

function buildView(actor: Actor) {
  const pricing = canTrade("pricing", actor).allowed;
  const { mining, shipments } = miningFacts();
  const day = today();
  const money = <T extends number | null>(value: T) => (pricing ? value : null);

  const deliveries = state.deliveries.map((delivery) => {
    const shipment = delivery.shipmentId ? shipments.get(delivery.shipmentId) : undefined;
    const quantities = quantitiesOf(delivery, shipment);
    const stage = deliveryStage(delivery, quantities);
    const agreement = state.agreements.find((item) => item.id === delivery.agreementId);
    const settled = state.settlements.some((item) => item.deliveryIds.includes(delivery.id));
    return {
      ...delivery,
      clientId: agreement?.clientId ?? "",
      commodity: agreement?.commodity ?? ("Chrome concentrate" as Commodity),
      agreementNumber: agreement?.number ?? "",
      commitmentLabel: agreement?.commitments.find((item) => item.id === delivery.commitmentId)?.label ?? "",
      quantities,
      stage,
      timing: deliveryTiming(stage, delivery.scheduledDate, day),
      shipment: shipment ?? null,
      invoiced: settled,
      value: money(agreement?.pricePerTonne != null ? agreement.pricePerTonne * delivery.tonnes : null),
      documents: state.documents.filter((doc) => doc.reference === delivery.number && (pricing || !doc.confidential)).map((doc) => ({ id: doc.id, name: doc.name, kind: doc.kind })),
    };
  });
  type DeliveryView = (typeof deliveries)[number];

  const commitmentView = (agreement: Agreement, commitment: Commitment) => {
    const own = deliveries.filter((item) => item.commitmentId === commitment.id && item.stage !== "cancelled");
    const sum = (pick: (item: DeliveryView) => number) => own.reduce((total, item) => total + pick(item), 0);
    const accepted = sum((item) => item.quantities.accepted);
    return {
      ...commitment,
      planned: sum((item) => item.tonnes),
      dispatched: sum((item) => item.quantities.dispatched),
      received: sum((item) => item.quantities.received),
      accepted,
      share: fulfilmentShare(accepted, commitment.tonnes),
      state: accepted >= commitment.tonnes ? ("fulfilled" as const) : commitment.dueDate < day ? ("overdue" as const) : own.length === 0 ? ("unplanned" as const) : ("in_progress" as const),
      deliveryIds: own.map((item) => item.id),
      agreementId: agreement.id,
    };
  };

  const agreements = state.agreements.map((agreement) => {
    const commitments = agreement.commitments.map((item) => commitmentView(agreement, item));
    const committed = commitments.reduce((total, item) => total + item.tonnes, 0);
    const accepted = commitments.reduce((total, item) => total + item.accepted, 0);
    const due = commitments.filter((item) => item.dueDate < day);
    const committedDue = due.reduce((total, item) => total + item.tonnes, 0);
    const acceptedDue = due.reduce((total, item) => total + item.accepted, 0);
    const settlements = state.settlements.filter((item) => item.agreementId === agreement.id);
    const invoiced = settlements.reduce((total, item) => total + (item.amount ?? 0), 0);
    const paid = settlements.reduce((total, item) => total + settlementPaid(item), 0);
    const current = commitments.find((item) => item.dueDate >= day && item.state !== "fulfilled") ?? null;
    return {
      ...agreement,
      pricePerTonne: money(agreement.pricePerTonne),
      commitments,
      clientName: clientName(agreement.clientId),
      committed,
      dispatched: commitments.reduce((total, item) => total + item.dispatched, 0),
      received: commitments.reduce((total, item) => total + item.received, 0),
      accepted,
      share: fulfilmentShare(accepted, committed),
      dueShare: committedDue > 0 ? acceptedDue / committedDue : null,
      health: agreementHealth(agreement, committedDue, acceptedDue, day),
      contractValue: money(agreement.pricePerTonne != null ? agreement.pricePerTonne * committed : null),
      outstanding: money(invoiced - paid),
      current,
    };
  });

  const settlements = state.settlements.map((settlement) => {
    const agreement = state.agreements.find((item) => item.id === settlement.agreementId)!;
    const paid = settlementPaid(settlement);
    return {
      ...settlement,
      amount: money(settlement.amount),
      payments: pricing ? settlement.payments : [],
      dispute: settlement.dispute ? { ...settlement.dispute, amount: money(settlement.dispute.amount) } : null,
      paid: money(paid),
      balance: money((settlement.amount ?? 0) - paid),
      status: settlementStatus(settlement, day),
      daysOverdue: Math.max(0, daysBetween(settlement.dueDate, day)),
      agreementNumber: agreement.number,
      clientId: agreement.clientId,
      commodity: agreement.commodity,
      deliveryNumbers: settlement.deliveryIds.map((id) => state.deliveries.find((item) => item.id === id)?.number ?? id),
    };
  });

  const clients = state.clients.map((client) => {
    const own = agreements.filter((item) => item.clientId === client.id);
    const active = own.filter((item) => item.status === "active");
    const ownSettlements = settlements.filter((item) => item.clientId === client.id);
    return {
      ...client,
      creditLimit: money(client.creditLimit),
      activeAgreements: active.length,
      committed: active.reduce((total, item) => total + item.committed, 0),
      accepted: active.reduce((total, item) => total + item.accepted, 0),
      share: fulfilmentShare(active.reduce((total, item) => total + item.accepted, 0), active.reduce((total, item) => total + item.committed, 0)),
      /** Accepted of the tonnes due so far on active agreements: how the client is tracking, not how far through the contract it is. */
      dueShare: (() => {
        const due = active.flatMap((item) => item.commitments.filter((c) => c.dueDate < day));
        const total = due.reduce((sum, c) => sum + c.tonnes, 0);
        return total > 0 ? due.reduce((sum, c) => sum + c.accepted, 0) / total : null;
      })(),
      outstanding: money(ownSettlements.reduce((total, item) => total + (item.balance ?? 0), 0)),
      overdue: ownSettlements.filter((item) => item.status === "overdue").length,
      openEnquiries: state.enquiries.filter((item) => item.clientId === client.id && !["won", "lost"].includes(item.stage)).length,
      atRisk: own.some((item) => item.health === "at_risk"),
      nextEnd: active.map((item) => item.endDate).sort()[0] ?? null,
    };
  });

  const enquiries = state.enquiries.map((enquiry) => ({
    ...enquiry,
    pricePerTonne: money(enquiry.pricePerTonne),
    value: money(enquiry.pricePerTonne != null ? enquiry.pricePerTonne * enquiry.tonnes : null),
    clientName: clientName(enquiry.clientId),
    quotationPending: Boolean(enquiry.quotationApprovalId && state.approvals.find((item) => item.id === enquiry.quotationApprovalId)?.status === "pending"),
    agreementNumber: enquiry.agreementId ? state.agreements.find((item) => item.id === enquiry.agreementId)?.number ?? null : null,
  }));

  const approvals = state.approvals.map((approval) => {
    const check = canDecide(approval, actor);
    return { ...approval, value: money(approval.value), clientName: clientName(approval.clientId), ageHours: Math.max(0, Math.round((Date.parse(now()) - Date.parse(approval.submittedAt)) / 3_600_000)), canDecide: check.allowed, decideReason: check.reason ?? null };
  });

  const documents = state.documents.filter((doc) => pricing || !doc.confidential).map((doc) => ({ ...doc, clientName: doc.clientId ? clientName(doc.clientId) : "—", expiresInDays: doc.expiresOn ? daysBetween(day, doc.expiresOn) : null }));

  const areaOf = (id: string) => mining.areas.find((area) => area.id === id);
  const links = state.links.filter((link) => !link.removed).map((link) => {
    const agreement = agreements.find((item) => item.id === link.agreementId)!;
    const commitment = agreement.commitments.find((item) => item.id === link.commitmentId) ?? null;
    const area = areaOf(link.areaId);
    const shift = link.shiftId ? mining.shifts.find((item) => item.id === link.shiftId) ?? null : null;
    const linkedShipments = link.shipmentIds.map((id) => shipments.get(id)).filter((item): item is ShipmentFacts => Boolean(item));
    const issues = mining.issues.filter((issue) => isOpen(issue) && issue.areaId === link.areaId).map((issue) => ({ id: issue.id, number: issue.issueNumber, title: issue.title, priority: issue.priority }));
    const dispatched = linkedShipments.reduce((total, item) => total + item.dispatched, 0);
    const allocated = linkedShipments.filter((item) => item.state !== "cancelled").reduce((total, item) => total + item.tonnes, 0);
    const target = commitment?.tonnes ?? 0;
    const readiness = commitment && commitment.state === "fulfilled" ? ("completed" as const)
      : linkedShipments.length === 0 && !shift ? ("awaiting_link" as const)
      : issues.length > 0 || area?.status === "blocked" || area?.status === "at_risk" ? ("at_risk" as const)
      : linkedShipments.length > 0 && linkedShipments.every((item) => ["confirmed", "dispatched", "delivered", "cancelled"].includes(item.state)) ? ("ready" as const)
      : ("on_track" as const);
    return {
      ...link,
      agreementNumber: agreement.number,
      clientId: agreement.clientId,
      clientName: agreement.clientName,
      commodity: agreement.commodity,
      commitment: commitment ? { id: commitment.id, label: commitment.label, tonnes: commitment.tonnes, dueDate: commitment.dueDate, accepted: commitment.accepted } : null,
      area: area ? { id: area.id, name: area.name, status: area.status, rationale: area.rationale } : { id: link.areaId, name: "Unknown area", status: "unknown", rationale: "" },
      shift: shift ? { id: shift.id, name: shift.name, startsAt: shift.startsAt, state: shift.state, supervisor: shift.supervisor } : null,
      shipments: linkedShipments,
      issues,
      allocated,
      dispatched,
      progress: target > 0 ? Math.min(1, dispatched / target) : 0,
      readiness,
    };
  });

  const transport = { providers: mining.transporters.length, requests: mining.quoteRequests.length };

  return {
    today: day,
    now: now(),
    actor: { name: actor.name, role: actor.role },
    can: {
      pricing,
      manageClients: canTrade("manage_clients", actor).allowed,
      manageEnquiries: canTrade("manage_enquiries", actor).allowed,
      manageAgreements: canTrade("manage_agreements", actor).allowed,
      manageDeliveries: canTrade("manage_deliveries", actor).allowed,
      recordAcceptance: canTrade("record_acceptance", actor).allowed,
      manageSettlements: canTrade("manage_settlements", actor).allowed,
      uploadDocuments: canTrade("upload_documents", actor).allowed,
      linkOperations: canTrade("link_operations", actor).allowed,
      manageReports: canTrade("manage_reports", actor).allowed,
    },
    clients,
    enquiries,
    agreements,
    deliveries,
    settlements,
    approvals,
    documents,
    hiddenDocuments: state.documents.length - documents.length,
    links,
    reports: state.reports,
    locations: state.locations.map((item) => ({ ...item, clientName: item.clientId ? clientName(item.clientId) : null })),
    transporters: mining.transporters.map((item) => ({ id: item.id, name: item.name, active: item.active })),
    transport,
    mining: {
      areas: mining.areas.map((area) => ({ id: area.id, name: area.name, status: area.status })),
      shifts: mining.shifts.filter((shift) => shift.state !== "cancelled").map((shift) => ({ id: shift.id, name: shift.name, startsAt: shift.startsAt, state: shift.state })),
      shipments: [...shipments.values()],
    },
  };
}

export type TradeView = ReturnType<typeof buildView>;

// ---- Changes -------------------------------------------------------------------------------------------------------------

function requestApproval(type: ApprovalType, subject: { id: string; number: string }, description: string, clientId: string, value: number | null, actor: Actor) {
  const number = nextNumber("approval", "APP");
  const approval: Approval = {
    id: `apr-${number.slice(4)}`,
    number,
    type, subjectId: subject.id, subjectNumber: subject.number, description, clientId, value,
    submittedBy: actor.name, submittedAt: now(), approverRole: approverFor[type], status: "pending", decidedBy: null, decidedAt: null, note: null, version: 1,
  };
  state.approvals.unshift(approval);
  demoDomain.notifyRole(approval.approverRole, `Approval needed: ${approval.number}`, `${description} (${clientName(clientId)}).`, "/trade/approvals");
  return approval;
}

function readClient(input: Record<string, unknown>, existing?: Client) {
  const name = text(input.name, "The client name", 2, 80);
  const duplicate = state.clients.find((item) => item.id !== existing?.id && item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) fail(409, "DUPLICATE", "A client with this name is already in the portfolio.");
  const registration = optionalText(input.registration, 40);
  if (registration && state.clients.some((item) => item.id !== existing?.id && item.registration === registration)) fail(409, "DUPLICATE", "A client with this registration number is already in the portfolio.");
  const email = text(input.email, "The email address", 5, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "VALIDATION", "Enter a valid email address.");
  const terms = Number(input.paymentTermsDays ?? 30);
  if (!Number.isInteger(terms) || terms < 0 || terms > 120) fail(400, "VALIDATION", "Payment terms must be between 0 and 120 days.");
  const limit = input.creditLimit === "" || input.creditLimit === null || input.creditLimit === undefined ? null : positive(input.creditLimit, "The credit limit", 10_000_000_000);
  return {
    name,
    registration,
    email,
    segment: text(input.segment, "The segment", 2, 60),
    city: text(input.city, "The city", 2, 60),
    country: optionalText(input.country, 60) || "South Africa",
    phone: optionalText(input.phone, 40),
    website: optionalText(input.website, 80),
    accountOwner: text(input.accountOwner, "The account owner", 2, 80),
    paymentTermsDays: terms,
    creditLimit: limit,
    notes: optionalText(input.notes, 1000),
  };
}

function diffSummary(before: Record<string, unknown>, after: Record<string, unknown>, labels: Record<string, string>) {
  const changed = Object.keys(labels).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return changed.length ? `Updated ${changed.map((key) => labels[key]).join(", ")}` : null;
}

export const tradeDomain = {
  view: buildView,
  now,
  save,
  get: () => state,
  reset() {
    state = initial();
    save();
  },

  // ---- Clients ----------------------------------------------------------------------------------------------------------

  createClient(input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_clients", actor);
    const fields = readClient(input);
    guardRepeat(input);
    state.counters.client += 1;
    const id = `cl-${String(state.counters.client).padStart(2, "0")}`;
    const contactName = optionalText(input.contactName, 80);
    const client: Client = {
      id, code: fields.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(), ...fields, status: "onboarding", since: today(),
      contacts: contactName ? [{ id: `${id}-ct1`, name: contactName, role: optionalText(input.contactRole, 60) || "Main contact", email: fields.email, phone: fields.phone }] : [],
      version: 1, history: [],
    };
    client.history.push(event(actor, "Client added; onboarding"));
    state.clients.push(client);
    return client;
  },

  updateClient(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_clients", actor);
    const client = find(state.clients, id, "client");
    checkVersion(client, input);
    const fields = readClient(input, client);
    const summary = diffSummary(client, fields, { name: "name", registration: "registration", email: "email", segment: "segment", city: "city", phone: "phone", website: "website", accountOwner: "account owner", paymentTermsDays: "payment terms", creditLimit: "credit limit", notes: "notes" });
    if (!summary) return client;
    Object.assign(client, fields);
    client.version += 1;
    client.history.push(event(actor, summary));
    return client;
  },

  setClientStatus(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_clients", actor);
    const client = find(state.clients, id, "client");
    checkVersion(client, input);
    const status = String(input.status) as Client["status"];
    if (!["active", "onboarding", "on_hold", "inactive"].includes(status)) fail(400, "VALIDATION", "Choose a status.");
    if (status === client.status) fail(409, "NO_CHANGE", "The client already has this status.");
    const note = optionalText(input.note, 300);
    if ((status === "on_hold" || status === "inactive") && note.length < 5) fail(400, "VALIDATION", "Say why, so the team knows.");
    if (status === "inactive" && state.agreements.some((item) => item.clientId === id && item.status === "active")) fail(409, "ACTIVE_AGREEMENTS", "This client has active agreements. Complete or terminate them first, or put the client on hold.");
    const before = client.status;
    client.status = status;
    client.version += 1;
    client.history.push(event(actor, `Status changed from ${before.replace("_", " ")} to ${status.replace("_", " ")}`, note || null));
    return client;
  },

  addContact(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_clients", actor);
    const client = find(state.clients, id, "client");
    const name = text(input.name, "The contact name", 2, 80);
    const email = text(input.email, "The email address", 5, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "VALIDATION", "Enter a valid email address.");
    if (client.contacts.some((item) => item.email.toLowerCase() === email.toLowerCase())) fail(409, "DUPLICATE", "This contact is already listed.");
    state.counters.contact += 1;
    client.contacts.push({ id: `ct-new-${state.counters.contact}`, name, role: optionalText(input.role, 60) || "Contact", email, phone: optionalText(input.phone, 40) });
    client.version += 1;
    client.history.push(event(actor, `Contact ${name} added`));
    return client;
  },

  removeContact(id: string, contactId: string, actor: Actor) {
    assertCan("manage_clients", actor);
    const client = find(state.clients, id, "client");
    const contact = find(client.contacts, contactId, "contact");
    client.contacts = client.contacts.filter((item) => item.id !== contactId);
    client.version += 1;
    client.history.push(event(actor, `Contact ${contact.name} removed`));
    return client;
  },

  // ---- Enquiries --------------------------------------------------------------------------------------------------------

  createEnquiry(input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_enquiries", actor);
    const client = find(state.clients, String(input.clientId ?? ""), "client");
    if (client.status === "inactive") fail(409, "CLIENT_INACTIVE", "This client is inactive. Reactivate the client before logging an enquiry.");
    const fields = { commodity: commodity(input.commodity), tonnes: positive(input.tonnes, "The quantity", 500_000), deliveryWindow: text(input.deliveryWindow, "The delivery window", 3, 40) };
    const duplicate = state.enquiries.find((item) => item.clientId === client.id && item.commodity === fields.commodity && item.tonnes === fields.tonnes && item.deliveryWindow.toLowerCase() === fields.deliveryWindow.toLowerCase() && !["won", "lost"].includes(item.stage));
    if (duplicate) fail(409, "DUPLICATE", `This looks like ${duplicate.number}, which is still open.`);
    guardRepeat(input);
    const number = nextNumber("enquiry", "ENQ");
    const enquiry: Enquiry = {
      id: `enq-${number.slice(4)}`, number, clientId: client.id, ...fields, stage: "new", owner: text(input.owner ?? actor.name, "The owner", 2, 80),
      pricePerTonne: null, quotationRef: null, quotationApprovalId: null, nextAction: optionalText(input.nextAction, 120) || "Qualify the enquiry", nextActionDate: input.nextActionDate ? date(input.nextActionDate, "The follow-up date") : null,
      lostReason: null, agreementId: null, receivedAt: now(), version: 1, history: [],
    };
    enquiry.history.push(event(actor, "Enquiry logged"));
    state.enquiries.unshift(enquiry);
    return enquiry;
  },

  /** Moves an enquiry through its stages. A quotation needs a price, and goes to the buyer only after finance approves it. */
  advanceEnquiry(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_enquiries", actor);
    const enquiry = find(state.enquiries, id, "enquiry");
    checkVersion(enquiry, input);
    const to = String(input.stage) as Enquiry["stage"];
    const note = optionalText(input.note, 300) || null;
    if (["won", "lost"].includes(enquiry.stage)) fail(409, "CLOSED", "This enquiry is closed.");
    if (to === "qualified") {
      if (enquiry.stage !== "new") fail(409, "STAGE", "Only a new enquiry can be qualified.");
    } else if (to === "quotation_sent") {
      if (!["qualified", "negotiation"].includes(enquiry.stage)) fail(409, "STAGE", "Qualify the enquiry before quoting.");
      const price = positive(input.pricePerTonne, "The price per tonne", 100_000);
      const pending = enquiry.quotationApprovalId ? state.approvals.find((item) => item.id === enquiry.quotationApprovalId) : undefined;
      if (pending?.status === "pending") fail(409, "APPROVAL_PENDING", `Quotation ${enquiry.quotationRef} is waiting for approval (${pending.number}).`);
      if (pending?.status === "approved" && enquiry.pricePerTonne === price) {
        // Approved at this price: it can go to the buyer now.
      } else {
        state.counters.quotation += 1;
        enquiry.quotationRef = `QTN-${String(state.counters.quotation).padStart(4, "0")}`;
        enquiry.pricePerTonne = price;
        const approval = requestApproval("quotation", { id: enquiry.id, number: enquiry.number }, `Quotation ${enquiry.quotationRef}: ${formatTonnes(enquiry.tonnes)} ${enquiry.commodity.toLowerCase()} at ${formatRand(price)}/t`, enquiry.clientId, price * enquiry.tonnes, actor);
        enquiry.quotationApprovalId = approval.id;
        enquiry.nextAction = "Quotation waiting for finance approval";
        enquiry.version += 1;
        enquiry.history.push(event(actor, `Quotation ${enquiry.quotationRef} prepared and sent for approval`, note));
        return enquiry;
      }
    } else if (to === "negotiation") {
      if (enquiry.stage !== "quotation_sent") fail(409, "STAGE", "Negotiation follows a quotation.");
    } else if (to === "won") {
      if (!["quotation_sent", "negotiation"].includes(enquiry.stage)) fail(409, "STAGE", "An enquiry is won after a quotation.");
    } else if (to === "lost") {
      if (!note || note.length < 5) fail(400, "VALIDATION", "Say why the enquiry was lost.");
      enquiry.lostReason = note;
    } else {
      fail(400, "VALIDATION", "Choose the next stage.");
    }
    const before = enquiry.stage;
    enquiry.stage = to;
    enquiry.nextAction = to === "won" ? "Draft the agreement" : to === "lost" ? null : optionalText(input.nextAction, 120) || enquiry.nextAction;
    enquiry.nextActionDate = input.nextActionDate ? date(input.nextActionDate, "The follow-up date") : enquiry.nextActionDate;
    enquiry.version += 1;
    enquiry.history.push(event(actor, `Stage changed from ${before.replace("_", " ")} to ${to.replace("_", " ")}`, note));
    return enquiry;
  },

  // ---- Agreements -------------------------------------------------------------------------------------------------------

  /** Creates a draft agreement with its commitments. From a won enquiry, the enquiry is linked and cannot produce a second agreement. */
  createAgreement(input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_agreements", actor);
    const client = find(state.clients, String(input.clientId ?? ""), "client");
    if (client.status === "inactive") fail(409, "CLIENT_INACTIVE", "This client is inactive.");
    const enquiry = input.enquiryId ? find(state.enquiries, String(input.enquiryId), "enquiry") : null;
    if (enquiry && enquiry.agreementId) fail(409, "DUPLICATE", `This enquiry already has an agreement (${state.agreements.find((item) => item.id === enquiry.agreementId)?.number}).`);
    if (enquiry && enquiry.stage !== "won") fail(409, "STAGE", "Mark the enquiry as won before drafting its agreement.");
    const startDate = date(input.startDate, "The start date");
    const endDate = date(input.endDate, "The end date");
    if (endDate <= startDate) fail(400, "VALIDATION", "The end date must be after the start date.");
    const raw = Array.isArray(input.commitments) ? (input.commitments as Record<string, unknown>[]) : [];
    if (raw.length === 0) fail(400, "VALIDATION", "Add at least one fulfilment commitment. An agreement must say what will be delivered, when and where.");
    guardRepeat(input);
    const number = nextNumber("agreement", "AGR");
    const id = `ag-${number.slice(4)}`;
    const commitments = raw.map((item, index): Commitment => {
      const due = date(item.dueDate, `Commitment ${index + 1}'s due date`);
      if (due < startDate || due > endDate) fail(400, "VALIDATION", `Commitment ${index + 1} must fall within the agreement dates.`);
      return { id: `${id}-c${index + 1}`, label: text(item.label, `Commitment ${index + 1}'s name`, 2, 60), tonnes: positive(item.tonnes, `Commitment ${index + 1}'s quantity`, 500_000), dueDate: due, deliveryPoint: text(item.deliveryPoint, `Commitment ${index + 1}'s delivery point`, 3, 100) };
    });
    const agreement: Agreement = {
      id, number, clientId: client.id, commodity: commodity(input.commodity), title: text(input.title, "The title", 3, 100), status: "draft", startDate, endDate,
      pricePerTonne: positive(input.pricePerTonne, "The price per tonne", 100_000), incoterm: text(input.incoterm, "The delivery terms", 3, 60), paymentTermsDays: Number(input.paymentTermsDays ?? client.paymentTermsDays) || client.paymentTermsDays,
      owner: actor.name, enquiryId: enquiry?.id ?? null, approvalId: null, commitments, amendments: [], version: 1, history: [],
    };
    agreement.history.push(event(actor, enquiry ? `Agreement drafted from enquiry ${enquiry.number}` : "Agreement drafted"));
    state.agreements.unshift(agreement);
    if (enquiry) {
      enquiry.agreementId = agreement.id;
      enquiry.nextAction = null;
      enquiry.version += 1;
      enquiry.history.push(event(actor, `Agreement ${agreement.number} drafted`));
    }
    return agreement;
  },

  submitAgreement(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_agreements", actor);
    const agreement = find(state.agreements, id, "agreement");
    checkVersion(agreement, input);
    if (agreement.status !== "draft") fail(409, "STAGE", "Only a draft agreement can be sent for approval.");
    const committed = agreement.commitments.reduce((total, item) => total + item.tonnes, 0);
    const approval = requestApproval("agreement", { id: agreement.id, number: agreement.number }, `New agreement: ${agreement.title} (${formatTonnes(committed)})`, agreement.clientId, (agreement.pricePerTonne ?? 0) * committed, actor);
    agreement.status = "pending_approval";
    agreement.approvalId = approval.id;
    agreement.version += 1;
    agreement.history.push(event(actor, `Sent for approval (${approval.number})`));
    return agreement;
  },

  /** Proposes a change. An amendment never changes the agreement until it is approved. */
  amendAgreement(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_agreements", actor);
    const agreement = find(state.agreements, id, "agreement");
    checkVersion(agreement, input);
    if (agreement.status !== "active") fail(409, "STAGE", "Only an active agreement can be amended.");
    if (agreement.amendments.some((item) => item.status === "pending")) fail(409, "PENDING", "An amendment is already waiting for approval.");
    const kind = input.kind === "extend_end" ? "extend_end" : "add_commitment";
    let summary: string;
    let detail: { commitment?: Commitment; endDate?: string };
    let value: number;
    if (kind === "extend_end") {
      const endDate = date(input.endDate, "The new end date");
      if (endDate <= agreement.endDate) fail(400, "VALIDATION", "The new end date must be later than the current one.");
      summary = `Extend the end date to ${endDate}`;
      detail = { endDate };
      value = 0;
    } else {
      const dueDate = date(input.dueDate, "The due date");
      if (dueDate < today()) fail(400, "VALIDATION", "A new commitment cannot be due in the past.");
      const commitment: Commitment = { id: `${agreement.id}-x${agreement.commitments.length + 1}`, label: text(input.label, "The commitment name", 2, 60), tonnes: positive(input.tonnes, "The quantity", 500_000), dueDate, deliveryPoint: text(input.deliveryPoint, "The delivery point", 3, 100) };
      summary = `Add ${formatTonnes(commitment.tonnes)} (${commitment.label})`;
      detail = { commitment };
      value = (agreement.pricePerTonne ?? 0) * commitment.tonnes;
    }
    guardRepeat(input);
    const approval = requestApproval("amendment", { id: agreement.id, number: agreement.number }, `Amendment: ${summary}`, agreement.clientId, value || null, actor);
    agreement.amendments.push({ id: `am-${approval.number.slice(4)}`, at: now(), actor: actor.name, summary, kind, detail, status: "pending", approvalId: approval.id });
    agreement.version += 1;
    agreement.history.push(event(actor, `Amendment proposed: ${summary}`, optionalText(input.note, 300) || null));
    return agreement;
  },

  setAgreementStatus(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_agreements", actor);
    const agreement = find(state.agreements, id, "agreement");
    checkVersion(agreement, input);
    const to = String(input.status);
    const note = optionalText(input.note, 300);
    const allowed: Record<string, string[]> = { active: ["suspended", "completed", "terminated"], suspended: ["active", "terminated"], draft: ["terminated"] };
    if (!(allowed[agreement.status] ?? []).includes(to)) fail(409, "STAGE", `An agreement that is ${agreement.status.replace("_", " ")} cannot be ${to}.`);
    if ((to === "suspended" || to === "terminated") && note.length < 5) fail(400, "VALIDATION", "Say why.");
    if (to === "completed") {
      // Completion is a commercial decision on accepted tonnes, never on a proof of delivery: every commitment must be accepted in full.
      const view = buildView(actor).agreements.find((item) => item.id === id)!;
      const short = view.commitments.filter((item) => item.accepted < item.tonnes);
      if (short.length) fail(409, "NOT_FULFILLED", `${short.length} commitment${short.length === 1 ? " has" : "s have"} not been accepted in full. Record customer acceptance first.`);
    }
    const before = agreement.status;
    agreement.status = to as Agreement["status"];
    agreement.version += 1;
    agreement.history.push(event(actor, `Status changed from ${before.replace("_", " ")} to ${to}`, note || null));
    return agreement;
  },

  // ---- Deliveries -------------------------------------------------------------------------------------------------------

  createDelivery(input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const agreement = find(state.agreements, String(input.agreementId ?? ""), "agreement");
    if (agreement.status !== "active") fail(409, "STAGE", "Deliveries are planned only against an active agreement.");
    const commitment = find(agreement.commitments, String(input.commitmentId ?? ""), "commitment");
    const tonnes = positive(input.tonnes, "The quantity", 500_000);
    const scheduledDate = date(input.scheduledDate, "The scheduled date");
    if (scheduledDate < today()) fail(400, "VALIDATION", "A new delivery cannot be scheduled in the past.");
    const plannedAlready = state.deliveries.filter((item) => item.commitmentId === commitment.id && !item.cancelled).reduce((total, item) => total + item.tonnes, 0);
    if (plannedAlready + tonnes > commitment.tonnes * 1.1) fail(409, "OVER_COMMITMENT", `This would plan ${formatTonnes(plannedAlready + tonnes)} against a ${formatTonnes(commitment.tonnes)} commitment. Amend the agreement first.`);
    const client = state.clients.find((item) => item.id === agreement.clientId);
    const shipmentId = typeof input.shipmentId === "string" && input.shipmentId ? input.shipmentId : null;
    if (shipmentId) {
      if (!demoDomain.get().shipments.some((item) => item.id === shipmentId)) fail(400, "VALIDATION", "That shipment does not exist in Mining Operations.");
      if (state.deliveries.some((item) => item.shipmentId === shipmentId && !item.cancelled)) fail(409, "DUPLICATE", "That shipment already carries another delivery.");
    }
    const plan = input.plan === undefined || input.plan === null ? null : deliveryPlan(input.plan, tonnes);
    guardRepeat(input);
    const number = nextNumber("delivery", "DEL");
    const delivery: Delivery = {
      id: `del-${number.slice(4)}`, number, agreementId: agreement.id, commitmentId: commitment.id, tonnes, scheduledDate,
      destination: plan?.receiving.location.name ?? (optionalText(input.destination, 100) || commitment.deliveryPoint),
      shipmentId, operations: null, acceptance: null, discrepancy: null, cancelled: null, plan, version: 1, history: [],
    };
    delivery.history.push(event(actor, `Delivery planned for ${scheduledDate}`, plan ? `${plan.collection.location.name} to ${plan.receiving.location.name}, ${Math.round(plan.route.km)} km` : null));
    if (plan) rememberLocations(plan, agreement.clientId, input, actor);
    state.deliveries.push(delivery);
    if (client?.status === "on_hold") {
      requestApproval("delivery", { id: delivery.id, number }, `Release delivery to a client on hold (${formatTonnes(tonnes)})`, client.id, (agreement.pricePerTonne ?? 0) * tonnes, actor);
    }
    return delivery;
  },

  /** Changes the locations, route and details of a delivery that has not left yet. */
  updateDeliveryPlan(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const delivery = find(state.deliveries, id, "delivery");
    checkVersion(delivery, input);
    if (delivery.cancelled || delivery.acceptance) fail(409, "STAGE", "This delivery is closed; its plan can no longer change.");
    const { shipments } = miningFacts();
    const shipment = delivery.shipmentId ? shipments.get(delivery.shipmentId) : undefined;
    if (quantitiesOf(delivery, shipment).dispatched > 0) fail(409, "STAGE", "This delivery has left the mine. Its route and sites can no longer change.");
    const plan = deliveryPlan(input.plan, delivery.tonnes);
    const agreement = state.agreements.find((item) => item.id === delivery.agreementId);
    const moved = !delivery.plan || straightKm(delivery.plan.receiving.location.position, plan.receiving.location.position) > 0.05 || straightKm(delivery.plan.collection.location.position, plan.collection.location.position) > 0.05;
    delivery.plan = plan;
    delivery.destination = plan.receiving.location.name;
    delivery.version += 1;
    delivery.history.push(event(actor, moved ? "Locations and route updated" : "Delivery details updated", moved ? `${plan.collection.location.name} to ${plan.receiving.location.name}, ${Math.round(plan.route.km)} km` : null));
    rememberLocations(plan, agreement?.clientId ?? null, input, actor);
    return delivery;
  },

  /** Keeps a collection or delivery point for reuse. */
  saveLocation(input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const point = location(input, "location");
    const kind = input.kind === "collection" ? "collection" : "delivery";
    const duplicate = state.locations.find((item) => item.kind === kind && straightKm(item.position, point.position) < 0.05);
    if (duplicate) fail(409, "DUPLICATE", `${duplicate.name} is already saved at this point.`);
    state.counters.location += 1;
    const id = `loc-${String(state.counters.location).padStart(3, "0")}`;
    const saved: SavedLocation = { ...point, source: point.source === "saved" ? "coordinates" : point.source, id, savedLocationId: id, kind, clientId: optionalText(input.clientId, 40) || null, notes: optionalText(input.notes, 300), createdBy: actor.name, createdAt: now() };
    state.locations.push(saved);
    return saved;
  },

  removeLocation(id: string, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const saved = find(state.locations, id, "saved location");
    state.locations = state.locations.filter((item) => item.id !== saved.id);
    return { id };
  },

  rescheduleDelivery(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const delivery = find(state.deliveries, id, "delivery");
    checkVersion(delivery, input);
    if (delivery.cancelled || delivery.acceptance) fail(409, "STAGE", "This delivery can no longer be rescheduled.");
    const next = date(input.scheduledDate, "The new date");
    if (next === delivery.scheduledDate) fail(409, "NO_CHANGE", "That is the current date.");
    const reason = text(input.note, "The reason", 5, 300);
    const commitment = state.agreements.find((item) => item.id === delivery.agreementId)?.commitments.find((item) => item.id === delivery.commitmentId);
    const before = delivery.scheduledDate;
    delivery.scheduledDate = next;
    delivery.version += 1;
    delivery.history.push(event(actor, `Rescheduled from ${before} to ${next}`, reason));
    if (commitment && next > commitment.dueDate) {
      const agreement = state.agreements.find((item) => item.id === delivery.agreementId)!;
      requestApproval("delivery", { id: delivery.id, number: delivery.number }, `Reschedule past the commitment due date (${commitment.dueDate})`, agreement.clientId, null, actor);
    }
    return delivery;
  },

  linkShipment(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const delivery = find(state.deliveries, id, "delivery");
    if (delivery.shipmentId) fail(409, "LINKED", "This delivery is already linked to a shipment.");
    const shipmentId = String(input.shipmentId ?? "");
    const shipment = demoDomain.get().shipments.find((item) => item.id === shipmentId) ?? fail(400, "VALIDATION", "Choose a Mining Operations shipment.");
    if (state.deliveries.some((item) => item.shipmentId === shipmentId && !item.cancelled)) fail(409, "DUPLICATE", "That shipment already carries another delivery.");
    delivery.shipmentId = shipmentId;
    delivery.version += 1;
    delivery.history.push(event(actor, `Linked to Mining Operations shipment ${shipment.number}`));
    return delivery;
  },

  /** Records what the customer accepted. Only received tonnes can be accepted, and acceptance is a separate decision from receipt. */
  recordAcceptance(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("record_acceptance", actor);
    const delivery = find(state.deliveries, id, "delivery");
    checkVersion(delivery, input);
    if (delivery.cancelled) fail(409, "STAGE", "This delivery was cancelled.");
    if (delivery.acceptance) fail(409, "STAGE", "Acceptance is already recorded for this delivery.");
    const { shipments } = miningFacts();
    const quantities = quantitiesOf(delivery, delivery.shipmentId ? shipments.get(delivery.shipmentId) : undefined);
    if (quantities.received <= 0) fail(409, "NOT_RECEIVED", "Nothing has been received yet. Acceptance follows receipt, which Mining Operations records.");
    const tonnes = Number(input.tonnes);
    if (!Number.isFinite(tonnes) || tonnes < 0) fail(400, "VALIDATION", "Enter the accepted quantity.");
    if (tonnes > quantities.received) fail(400, "VALIDATION", `Accepted tonnes cannot be more than the ${formatTonnes(quantities.received)} received.`);
    const note = optionalText(input.note, 300);
    const short = quantities.received - tonnes;
    if (short > 0 && note.length < 5) fail(400, "VALIDATION", "Say why part of the delivery was not accepted.");
    delivery.acceptance = { tonnes, at: now(), by: actor.name, note };
    if (short > 0) delivery.discrepancy = { tonnes: short, reason: note, at: now(), by: actor.name, resolution: null };
    delivery.version += 1;
    delivery.history.push(event(actor, `${formatTonnes(tonnes)} accepted by the customer${short > 0 ? `; ${formatTonnes(short)} not accepted` : ""}`, note || null));
    return delivery;
  },

  raiseDiscrepancy(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const delivery = find(state.deliveries, id, "delivery");
    if (delivery.cancelled) fail(409, "STAGE", "This delivery was cancelled.");
    if (delivery.discrepancy && !delivery.discrepancy.resolution) fail(409, "OPEN", "A discrepancy is already open on this delivery.");
    const tonnes = Number(input.tonnes ?? 0);
    if (!Number.isFinite(tonnes) || tonnes < 0) fail(400, "VALIDATION", "Enter the tonnes in question, or 0.");
    const reason = text(input.reason, "The reason", 5, 300);
    delivery.discrepancy = { tonnes, reason, at: now(), by: actor.name, resolution: null };
    delivery.version += 1;
    delivery.history.push(event(actor, "Discrepancy raised", reason));
    return delivery;
  },

  resolveDiscrepancy(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("record_acceptance", actor);
    const delivery = find(state.deliveries, id, "delivery");
    if (!delivery.discrepancy || delivery.discrepancy.resolution) fail(409, "NONE", "There is no open discrepancy.");
    const resolution = text(input.resolution, "The resolution", 5, 300);
    delivery.discrepancy.resolution = resolution;
    delivery.version += 1;
    delivery.history.push(event(actor, "Discrepancy resolved", resolution));
    return delivery;
  },

  cancelDelivery(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_deliveries", actor);
    const delivery = find(state.deliveries, id, "delivery");
    checkVersion(delivery, input);
    if (delivery.cancelled) fail(409, "STAGE", "This delivery is already cancelled.");
    const { shipments } = miningFacts();
    const quantities = quantitiesOf(delivery, delivery.shipmentId ? shipments.get(delivery.shipmentId) : undefined);
    if (quantities.dispatched > 0) fail(409, "DISPATCHED", "Stock has already been dispatched for this delivery. Raise a discrepancy instead.");
    const reason = text(input.note, "The reason", 5, 300);
    delivery.cancelled = { reason, at: now(), by: actor.name };
    delivery.version += 1;
    delivery.history.push(event(actor, "Delivery cancelled", reason));
    return delivery;
  },

  // ---- Settlements ------------------------------------------------------------------------------------------------------

  /** Raises an invoice on accepted, not yet invoiced tonnes of one agreement. */
  createInvoice(input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_settlements", actor);
    const agreement = find(state.agreements, String(input.agreementId ?? ""), "agreement");
    const ids = Array.isArray(input.deliveryIds) ? (input.deliveryIds as string[]) : [];
    if (ids.length === 0) fail(400, "VALIDATION", "Choose the accepted deliveries to invoice.");
    const invoiced = new Set(state.settlements.flatMap((item) => item.deliveryIds));
    const chosen = ids.map((deliveryId) => find(state.deliveries, deliveryId, "delivery"));
    for (const delivery of chosen) {
      if (delivery.agreementId !== agreement.id) fail(400, "VALIDATION", `${delivery.number} belongs to another agreement.`);
      if (!delivery.acceptance) fail(409, "NOT_ACCEPTED", `${delivery.number} has no customer acceptance yet. Invoices are raised on accepted tonnes only.`);
      if (invoiced.has(delivery.id)) fail(409, "DUPLICATE", `${delivery.number} is already on an invoice.`);
    }
    guardRepeat(input);
    const tonnes = chosen.reduce((total, item) => total + (item.acceptance?.tonnes ?? 0), 0);
    const amount = tonnes * (agreement.pricePerTonne ?? 0);
    const issuedAt = today();
    state.counters.invoice += 1;
    const settlement: Settlement = {
      id: `set-${state.counters.settlement + 1}`, number: nextNumber("settlement", "SET"), invoiceNumber: `INV-${state.counters.invoice}`, agreementId: agreement.id, deliveryIds: chosen.map((item) => item.id),
      tonnes, amount, issuedAt, dueDate: addDays(issuedAt, agreement.paymentTermsDays), payments: [], dispute: null, version: 1, history: [],
    };
    settlement.history.push(event(actor, `Invoice ${settlement.invoiceNumber} issued for ${formatTonnes(tonnes)}`));
    state.settlements.push(settlement);
    return settlement;
  },

  recordPayment(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_settlements", actor);
    const settlement = find(state.settlements, id, "settlement");
    checkVersion(settlement, input);
    const balance = (settlement.amount ?? 0) - settlementPaid(settlement);
    if (balance <= 0) fail(409, "SETTLED", "This invoice is already paid in full.");
    const amount = positive(input.amount, "The amount", 10_000_000_000);
    if (amount > balance + 0.005) fail(400, "VALIDATION", `The payment is more than the ${formatRand(balance)} outstanding.`);
    const reference = text(input.reference, "The payment reference", 3, 60);
    if (settlement.payments.some((item) => item.reference.toLowerCase() === reference.toLowerCase())) fail(409, "DUPLICATE", "A payment with this reference is already recorded.");
    const paidOn = input.date ? date(input.date, "The payment date") : today();
    guardRepeat(input);
    state.counters.payment += 1;
    settlement.payments.push({ id: `pay-new-${state.counters.payment}`, at: `${paidOn}T12:00:00+02:00`, amount, reference, by: actor.name });
    settlement.version += 1;
    settlement.history.push(event(actor, `Payment of ${formatRand(amount)} recorded`, reference));
    return settlement;
  },

  disputeSettlement(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_settlements", actor);
    const settlement = find(state.settlements, id, "settlement");
    if (settlement.dispute && !settlement.dispute.resolved) fail(409, "OPEN", "A dispute is already open.");
    const amount = input.amount === "" || input.amount == null ? null : positive(input.amount, "The disputed amount", settlement.amount ?? 0);
    const reason = text(input.reason, "The reason", 5, 300);
    settlement.dispute = { amount, reason, at: now(), by: actor.name, resolved: false, resolution: null };
    settlement.version += 1;
    settlement.history.push(event(actor, "Dispute recorded", reason));
    return settlement;
  },

  /** Resolves a dispute. A credit reduces the invoice, so it goes to the Mine Manager for approval first. */
  resolveSettlement(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_settlements", actor);
    const settlement = find(state.settlements, id, "settlement");
    if (!settlement.dispute || settlement.dispute.resolved) fail(409, "NONE", "There is no open dispute.");
    const resolution = text(input.resolution, "The resolution", 5, 300);
    const credit = Number(input.credit ?? 0);
    const agreement = state.agreements.find((item) => item.id === settlement.agreementId)!;
    if (credit > 0) {
      if (state.approvals.some((item) => item.subjectId === settlement.id && item.status === "pending")) fail(409, "PENDING", "A credit for this invoice is already waiting for approval.");
      requestApproval("settlement", { id: settlement.id, number: settlement.number }, `Credit of ${formatRand(credit)} on ${settlement.invoiceNumber}: ${resolution}`, agreement.clientId, credit, actor);
      settlement.history.push(event(actor, `Credit of ${formatRand(credit)} sent for approval`, resolution));
      settlement.version += 1;
      return settlement;
    }
    settlement.dispute.resolved = true;
    settlement.dispute.resolution = resolution;
    settlement.version += 1;
    settlement.history.push(event(actor, "Dispute resolved without a credit", resolution));
    return settlement;
  },

  // ---- Approvals --------------------------------------------------------------------------------------------------------

  decideApproval(id: string, input: Record<string, unknown>, actor: Actor) {
    const approval = find(state.approvals, id, "approval");
    checkVersion(approval, input);
    const check = canDecide(approval, actor);
    if (!check.allowed) fail(403, "FORBIDDEN", check.reason ?? "You cannot decide this approval.");
    const decision = input.decision === "approved" ? "approved" : input.decision === "rejected" ? "rejected" : fail(400, "VALIDATION", "Approve or reject.");
    const note = optionalText(input.note, 300);
    if (decision === "rejected" && note.length < 5) fail(400, "VALIDATION", "Say why the request is rejected.");
    approval.status = decision as "approved" | "rejected";
    approval.decidedBy = actor.name;
    approval.decidedAt = now();
    approval.note = note || null;
    approval.version += 1;
    const approved = decision === "approved";

    // What the decision changes on the record it was about.
    if (approval.type === "agreement") {
      const agreement = find(state.agreements, approval.subjectId, "agreement");
      agreement.status = approved ? "active" : "draft";
      agreement.version += 1;
      agreement.history.push(event(actor, approved ? `Approved (${approval.number}) and made active` : `Approval rejected (${approval.number}); back to draft`, note || null));
    } else if (approval.type === "amendment") {
      const agreement = find(state.agreements, approval.subjectId, "agreement");
      const amendment = agreement.amendments.find((item) => item.approvalId === approval.id);
      if (amendment) {
        amendment.status = approved ? "approved" : "rejected";
        if (approved && amendment.detail.commitment) agreement.commitments.push(amendment.detail.commitment);
        if (approved && amendment.detail.endDate) agreement.endDate = amendment.detail.endDate;
        agreement.version += 1;
        agreement.history.push(event(actor, `Amendment ${approved ? "approved" : "rejected"}: ${amendment.summary}`, note || null));
      }
    } else if (approval.type === "quotation") {
      const enquiry = find(state.enquiries, approval.subjectId, "enquiry");
      if (approved) {
        enquiry.stage = "quotation_sent";
        enquiry.nextAction = "Follow up with the buyer";
      } else {
        enquiry.nextAction = "Revise the quotation";
      }
      enquiry.version += 1;
      enquiry.history.push(event(actor, approved ? `Quotation ${enquiry.quotationRef} approved and sent to the buyer` : `Quotation ${enquiry.quotationRef} rejected`, note || null));
    } else if (approval.type === "settlement") {
      const settlement = state.settlements.find((item) => item.id === approval.subjectId);
      if (settlement && settlement.dispute && !settlement.dispute.resolved) {
        if (approved && settlement.amount != null && approval.value) {
          settlement.amount = Math.max(settlementPaid(settlement), settlement.amount - approval.value);
          settlement.dispute.resolved = true;
          settlement.dispute.resolution = `Credit of ${formatRand(approval.value)} approved (${approval.number}).`;
        }
        settlement.version += 1;
        settlement.history.push(event(actor, approved ? `Credit approved (${approval.number})` : `Credit rejected (${approval.number})`, note || null));
      }
    } else if (approval.type === "delivery") {
      const delivery = state.deliveries.find((item) => item.id === approval.subjectId);
      if (delivery) {
        delivery.version += 1;
        delivery.history.push(event(actor, `${approval.description}: ${approved ? "approved" : "rejected"} (${approval.number})`, note || null));
      }
    }
    demoDomain.notifyRole("Commercial / Finance Officer", `${approval.number} ${approval.status}`, approval.description, "/trade/approvals");
    return approval;
  },

  // ---- Documents --------------------------------------------------------------------------------------------------------

  /** Records an uploaded document's details. Uploading proof of delivery never changes a delivery, an agreement or an invoice. */
  uploadDocument(input: Record<string, unknown>, actor: Actor) {
    assertCan("upload_documents", actor);
    const name = text(input.name, "The file name", 3, 160);
    if (!/\.(pdf|docx?|xlsx?|csv|png|jpe?g)$/i.test(name)) fail(400, "VALIDATION", "Upload a PDF, Word, Excel, CSV or image file.");
    const sizeBytes = Number(input.sizeBytes);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) fail(400, "VALIDATION", "The file is empty.");
    if (sizeBytes > 25 * 1_048_576) fail(400, "VALIDATION", "Files can be at most 25 MB.");
    const folder = String(input.folder) as Folder;
    if (!(folder in folderLabels)) fail(400, "VALIDATION", "Choose a folder.");
    const kind = String(input.kind) as TradeDocument["kind"];
    if (!(documentKinds as readonly string[]).includes(kind)) fail(400, "VALIDATION", "Choose the document type.");
    const reference = text(input.reference, "The record reference", 2, 40);
    const confidential = Boolean(input.confidential);
    if (confidential && !canTrade("pricing", actor).allowed) fail(403, "FORBIDDEN", "Only roles with pricing access can upload confidential documents.");
    if (state.documents.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.reference === reference && item.status !== "superseded")) fail(409, "DUPLICATE", "This file is already filed against this record. Replace it instead.");
    guardRepeat(input);
    const doc: TradeDocument = {
      id: `doc-${String(++state.counters.document).padStart(3, "0")}`, name, folder, kind, reference, clientId: typeof input.clientId === "string" && input.clientId ? input.clientId : null,
      sizeBytes, uploadedBy: actor.name, uploadedAt: now(), status: kind === "Proof of delivery" || kind === "Weighbridge ticket" ? "final" : "pending_review", expiresOn: input.expiresOn ? date(input.expiresOn, "The expiry date") : null, confidential, version: 1,
    };
    state.documents.unshift(doc);
    const delivery = state.deliveries.find((item) => item.number === reference);
    if (delivery) delivery.history.push(event(actor, `${kind} uploaded: ${name}`, "Recorded as evidence only; acceptance is recorded separately."));
    return doc;
  },

  setDocumentStatus(id: string, input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_agreements", actor);
    const doc = find(state.documents, id, "document");
    const status = String(input.status) as TradeDocument["status"];
    if (!["approved", "final", "superseded"].includes(status)) fail(400, "VALIDATION", "Choose a status.");
    if (doc.status === status) fail(409, "NO_CHANGE", "The document already has this status.");
    doc.status = status;
    doc.version += 1;
    return doc;
  },

  deleteDocument(id: string, actor: Actor) {
    assertCan("manage_agreements", actor);
    const doc = find(state.documents, id, "document");
    if (doc.status === "final" || doc.status === "approved") fail(409, "LOCKED", "Approved and final documents are kept for the record. Mark it superseded instead.");
    state.documents = state.documents.filter((item) => item.id !== id);
    return { id };
  },

  // ---- Linked operations ------------------------------------------------------------------------------------------------

  createLink(input: Record<string, unknown>, actor: Actor) {
    assertCan("link_operations", actor);
    const agreement = find(state.agreements, String(input.agreementId ?? ""), "agreement");
    if (agreement.status !== "active") fail(409, "STAGE", "Link operations to an active agreement.");
    const commitment = find(agreement.commitments, String(input.commitmentId ?? ""), "commitment");
    const mining = demoDomain.get();
    const areaId = String(input.areaId ?? "");
    if (!mining.areas.some((item) => item.id === areaId)) fail(400, "VALIDATION", "Choose the mine area doing the work.");
    const shiftId = typeof input.shiftId === "string" && input.shiftId ? input.shiftId : null;
    if (shiftId && !mining.shifts.some((item) => item.id === shiftId)) fail(400, "VALIDATION", "That shift does not exist.");
    const shipmentIds = Array.isArray(input.shipmentIds) ? (input.shipmentIds as string[]).filter((id) => mining.shipments.some((item) => item.id === id)) : [];
    const workstream = text(input.workstream, "The workstream", 3, 100);
    if (state.links.some((item) => !item.removed && item.commitmentId === commitment.id && item.areaId === areaId && item.workstream.toLowerCase() === workstream.toLowerCase())) fail(409, "DUPLICATE", "This work is already linked to this commitment.");
    guardRepeat(input);
    const number = nextNumber("link", "LOP", 3);
    const link: OperationLink = { id: `lop-${number.slice(4)}`, number, agreementId: agreement.id, commitmentId: commitment.id, workstream, areaId, shiftId, shipmentIds, createdBy: actor.name, createdAt: now(), note: optionalText(input.note, 300), removed: false };
    state.links.unshift(link);
    agreement.history.push(event(actor, `Linked to operations (${number}: ${workstream})`));
    return link;
  },

  removeLink(id: string, actor: Actor) {
    assertCan("link_operations", actor);
    const link = find(state.links, id, "link");
    link.removed = true;
    return { id };
  },

  // ---- Reports ----------------------------------------------------------------------------------------------------------

  createReport(input: Record<string, unknown>, actor: Actor) {
    assertCan("manage_reports", actor);
    const kind = String(input.kind) as ReportKind;
    if (!(kind in reportKindLabels)) fail(400, "VALIDATION", "Choose a report type.");
    const frequency = String(input.frequency ?? "on_demand") as SavedReport["frequency"];
    if (!(frequency in frequencyLabels)) fail(400, "VALIDATION", "Choose how often it runs.");
    const name = text(input.name, "The report name", 3, 80);
    if (state.reports.some((item) => item.name.toLowerCase() === name.toLowerCase())) fail(409, "DUPLICATE", "A report with this name already exists.");
    guardRepeat(input);
    state.counters.report += 1;
    const report: SavedReport = { id: `rep-${state.counters.report}`, name, kind, frequency, owner: actor.name, createdAt: now(), lastRunAt: null, standard: false };
    state.reports.push(report);
    return report;
  },

  runReport(id: string, actor: Actor) {
    assertCan("view", actor);
    const report = find(state.reports, id, "report");
    report.lastRunAt = now();
    return report;
  },

  deleteReport(id: string, actor: Actor) {
    assertCan("manage_reports", actor);
    const report = find(state.reports, id, "report");
    if (report.standard) fail(409, "STANDARD", "Standard reports cannot be deleted.");
    state.reports = state.reports.filter((item) => item.id !== id);
    return { id };
  },
};

/** For the demo API: refuses anyone outside Trade before any read or change. */
export function assertTradeAccess(actor: Actor) {
  assertCan("view", actor);
}
