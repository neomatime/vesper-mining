/**
 * Trade: the commercial side of the mine. Clients (the mine's customers and counterparties), their enquiries, agreements and the
 * fulfilment commitments inside each agreement, deliveries against those commitments, invoices and payments, approvals, documents and
 * the links to the Mining Operations work that fulfils each commitment.
 *
 * The quantities stay separate on purpose. Produced and allocated stock, dispatched and received tonnes belong to Mining Operations and
 * are read from its shipment records; Trade records only what the customer accepted. A commitment counts as fulfilled by accepted
 * tonnes, never by dispatch or by a proof of delivery being uploaded. Invoices are raised on accepted tonnes only.
 *
 * Prices, values and balances are commercial information. They are shown only to the roles in PRICE_ROLES; for everyone else the
 * server leaves them out (null), so they cannot be read from the page.
 */
import type { Actor, Check } from "./issue-rules";

export const COMMODITIES = ["Chrome concentrate", "Chrome lumpy ore", "Coal"] as const;
export type Commodity = (typeof COMMODITIES)[number];

export type TradeEvent = { id: string; at: string; actor: string; summary: string; note: string | null };

// ---- Clients -------------------------------------------------------------------------------------------------------------

export const clientStatusLabels = { active: "Active", onboarding: "Onboarding", on_hold: "On hold", inactive: "Inactive" } as const;
export type ClientStatus = keyof typeof clientStatusLabels;
export const clientSegments = ["Ferrochrome smelter", "Stainless steel producer", "Commodity trader", "Power producer", "Industrial user"] as const;

export type Contact = { id: string; name: string; role: string; email: string; phone: string };

export type Client = {
  id: string;
  code: string;
  name: string;
  segment: string;
  status: ClientStatus;
  city: string;
  country: string;
  registration: string;
  email: string;
  phone: string;
  website: string;
  accountOwner: string;
  paymentTermsDays: number;
  /** Commercial: hidden from roles without pricing access. */
  creditLimit: number | null;
  contacts: Contact[];
  notes: string;
  since: string;
  version: number;
  history: TradeEvent[];
};

// ---- Enquiries -----------------------------------------------------------------------------------------------------------

export const enquiryStageLabels = { new: "New", qualified: "Qualified", quotation_sent: "Quotation sent", negotiation: "Negotiation", won: "Won", lost: "Lost" } as const;
export type EnquiryStage = keyof typeof enquiryStageLabels;

export type Enquiry = {
  id: string;
  number: string;
  clientId: string;
  commodity: Commodity;
  tonnes: number;
  deliveryWindow: string;
  stage: EnquiryStage;
  owner: string;
  /** The quoted price per tonne. Commercial. */
  pricePerTonne: number | null;
  quotationRef: string | null;
  /** An approval is needed before a quotation goes to the buyer; this is its id while it waits. */
  quotationApprovalId: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  lostReason: string | null;
  agreementId: string | null;
  receivedAt: string;
  version: number;
  history: TradeEvent[];
};

// ---- Agreements and their commitments ----------------------------------------------------------------------------------

export const agreementStatusLabels = { draft: "Draft", pending_approval: "Awaiting approval", active: "Active", suspended: "Suspended", completed: "Completed", terminated: "Terminated" } as const;
export type AgreementStatus = keyof typeof agreementStatusLabels;

/** One promise inside an agreement: so many tonnes to a place by a date. Deliveries are made against a commitment. */
export type Commitment = { id: string; label: string; tonnes: number; dueDate: string; deliveryPoint: string };

export type Amendment = { id: string; at: string; actor: string; summary: string; kind: "add_commitment" | "extend_end"; detail: { commitment?: Commitment; endDate?: string }; status: "pending" | "approved" | "rejected"; approvalId: string | null };

export type Agreement = {
  id: string;
  number: string;
  clientId: string;
  commodity: Commodity;
  title: string;
  status: AgreementStatus;
  startDate: string;
  endDate: string;
  /** Commercial. */
  pricePerTonne: number | null;
  incoterm: string;
  paymentTermsDays: number;
  owner: string;
  enquiryId: string | null;
  approvalId: string | null;
  commitments: Commitment[];
  amendments: Amendment[];
  version: number;
  history: TradeEvent[];
};

// ---- Deliveries --------------------------------------------------------------------------------------------------------

/** Quantities recorded before a delivery was linked to a Mining Operations shipment (older deliveries). */
export type OperationsRecord = { dispatched: number; dispatchedAt: string | null; received: number; receivedAt: string | null; source: string };

export type Delivery = {
  id: string;
  number: string;
  agreementId: string;
  commitmentId: string;
  tonnes: number;
  scheduledDate: string;
  destination: string;
  /** The Mining Operations shipment that carries this delivery. Dispatched and received tonnes are read from it. */
  shipmentId: string | null;
  operations: OperationsRecord | null;
  acceptance: { tonnes: number; at: string; by: string; note: string } | null;
  discrepancy: { tonnes: number; reason: string; at: string; by: string; resolution: string | null } | null;
  cancelled: { reason: string; at: string; by: string } | null;
  /** Exact collection and delivery points, the route between them and the operational details. Older deliveries may have none. */
  plan?: DeliveryPlan | null;
  version: number;
  history: TradeEvent[];
};

// ---- Delivery plan: exact locations, route and operational details ---------------------------------------------------------

/** Latitude, longitude in decimal degrees (WGS 84), as maps and GPS units use. */
export type LatLngPair = [number, number];

export const locationSourceLabels = { google: "Google Maps", map_pin: "Pin on the map", coordinates: "Entered coordinates", saved: "Saved location", directory: "VESPER place list" } as const;
export type LocationSource = keyof typeof locationSourceLabels;

export type DeliveryLocation = {
  name: string;
  address: string;
  position: LatLngPair;
  source: LocationSource;
  /** Google's place id, when the point came from a Google Maps search. */
  placeId: string | null;
  savedLocationId: string | null;
};

/** A collection or delivery point kept for reuse, so a regular customer site is not searched for every time. */
export type SavedLocation = DeliveryLocation & { id: string; kind: "collection" | "delivery"; clientId: string | null; notes: string; createdBy: string; createdAt: string };

export const routeSourceLabels = { google: "Google Maps driving route", network: "VESPER road network", estimated: "Straight-line estimate" } as const;
export type DeliveryRoute = { points: LatLngPair[]; km: number; minutes: number; source: keyof typeof routeSourceLabels };

export const offloadingLabels = { end_tipper: "End tipper", side_tipper: "Side tipper", walking_floor: "Walking floor", grab_crane: "Grab or crane", conveyor: "Conveyor or hopper" } as const;
export const loadFormLabels = { bulk: "Bulk (loose)", bulk_bags: "Bulk bags", containers: "Containers" } as const;
export const requiredDocumentLabels = { delivery_note: "Delivery note", weighbridge_ticket: "Weighbridge ticket", quality_certificate: "Quality certificate", sample_seal: "Sample and seal record", abnormal_load_permit: "Abnormal load permit", export_permit: "Export permit" } as const;
export type RequiredDocument = keyof typeof requiredDocumentLabels;

export type SiteDetails = { location: DeliveryLocation; contactName: string; contactPhone: string; contactEmail: string; windowFrom: string; windowTo: string; instructions: string };
export type DeliveryVehicle = { registration: string; driverName: string; driverPhone: string; trackingUnit: string };

export type DeliveryPlan = {
  collection: SiteDetails;
  receiving: SiteDetails & { offloading: keyof typeof offloadingLabels; weighbridgeOnSite: boolean; safetyRequirements: string };
  route: DeliveryRoute;
  load: { grade: string; form: keyof typeof loadFormLabels; loadCount: number; tonnesPerLoad: number; moisturePercent: number | null };
  logistics: { transporterId: string | null; transporterName: string; vehicles: DeliveryVehicle[]; trackingRequired: boolean };
  compliance: { documents: RequiredDocument[]; hazardous: boolean; specialInstructions: string };
};

/** A standard side-tipper payload on South African roads. */
export const STANDARD_LOAD_TONNES = 34;
/** The planned average speed for haul trucks, used for travel-time estimates and tracking. */
export const PLANNED_KPH = 65;

const toRadians = (deg: number) => (deg * Math.PI) / 180;
/** Straight-line distance between two points in km (great circle). */
export function straightKm(a: LatLngPair, b: LatLngPair) {
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Reads "-24.6601, 30.0612" (or with a space or semicolon) into a point; null when it is not a valid coordinate pair. */
export function parseCoordinates(value: string): LatLngPair | null {
  const parts = value.trim().replace(/[()]/g, "").split(/[\s,;]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const [lat, lng] = parts.map(Number);
  return validPosition([lat, lng]) ? [lat, lng] : null;
}
export const validPosition = (value: unknown): value is LatLngPair => Array.isArray(value) && value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180 && !(value[0] === 0 && value[1] === 0);
export const formatCoordinates = (position: LatLngPair) => `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`;
export const formatKm = (km: number) => `${Math.round(km).toLocaleString("en-GB")} km`;
export const formatDuration = (minutes: number) => {
  const rounded = Math.max(1, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  return hours ? `${hours} h ${String(rounded % 60).padStart(2, "0")} min` : `${rounded} min`;
};

export const deliveryStageLabels = { planned: "Planned", in_transit: "In transit", received: "Awaiting acceptance", accepted: "Accepted", disputed: "Discrepancy", cancelled: "Cancelled" } as const;
export type DeliveryStage = keyof typeof deliveryStageLabels;

// ---- Settlements -------------------------------------------------------------------------------------------------------

export type Payment = { id: string; at: string; amount: number; reference: string; by: string };

export type Settlement = {
  id: string;
  number: string;
  invoiceNumber: string;
  agreementId: string;
  deliveryIds: string[];
  tonnes: number;
  /** Commercial. */
  amount: number | null;
  issuedAt: string;
  dueDate: string;
  payments: Payment[];
  dispute: { amount: number | null; reason: string; at: string; by: string; resolved: boolean; resolution: string | null } | null;
  version: number;
  history: TradeEvent[];
};

export const settlementStatusLabels = { pending: "Pending", overdue: "Overdue", partial: "Partially paid", settled: "Settled", disputed: "Disputed" } as const;
export type SettlementStatus = keyof typeof settlementStatusLabels;

// ---- Approvals, documents, operation links, reports -------------------------------------------------------------------

export const approvalTypeLabels = { agreement: "Agreement", amendment: "Amendment", quotation: "Quotation", settlement: "Settlement", delivery: "Delivery" } as const;
export type ApprovalType = keyof typeof approvalTypeLabels;
export const approvalStatusLabels = { pending: "Pending", approved: "Approved", rejected: "Rejected" } as const;
export type ApprovalStatus = keyof typeof approvalStatusLabels;

export type Approval = {
  id: string;
  number: string;
  type: ApprovalType;
  subjectId: string;
  subjectNumber: string;
  description: string;
  clientId: string;
  /** Commercial. */
  value: number | null;
  submittedBy: string;
  submittedAt: string;
  approverRole: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  version: number;
};

export const folderLabels = { agreements: "Agreements", deliveries: "Deliveries", settlements: "Settlements", enquiries: "Enquiries", compliance: "Compliance", operations: "Operations" } as const;
export type Folder = keyof typeof folderLabels;
export const documentKinds = ["Agreement", "Amendment", "Quotation", "Proof of delivery", "Weighbridge ticket", "Quality certificate", "Invoice", "Statement", "KYC pack", "BEE certificate", "Tax clearance", "Other"] as const;
export const documentStatusLabels = { draft: "Draft", pending_review: "Pending review", approved: "Approved", final: "Final", superseded: "Superseded" } as const;
export type DocumentStatus = keyof typeof documentStatusLabels;

export type TradeDocument = {
  id: string;
  name: string;
  folder: Folder;
  kind: (typeof documentKinds)[number];
  /** The record it belongs to, such as AGR-0047 or DEL-0257. */
  reference: string;
  clientId: string | null;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  status: DocumentStatus;
  expiresOn: string | null;
  /** Contains prices or bank details: shown only to roles with pricing access. */
  confidential: boolean;
  version: number;
};

export type OperationLink = {
  id: string;
  number: string;
  agreementId: string;
  commitmentId: string;
  workstream: string;
  areaId: string;
  shiftId: string | null;
  shipmentIds: string[];
  createdBy: string;
  createdAt: string;
  note: string;
  removed: boolean;
};

export const reportKindLabels = {
  commercial_summary: "Commercial performance summary",
  agreement_fulfilment: "Agreement fulfilment",
  delivery_variance: "Delivery variance",
  settlement_ageing: "Settlement ageing",
  logistics_performance: "Logistics performance",
  operational_exposure: "Operational exposure",
} as const;
export type ReportKind = keyof typeof reportKindLabels;
export const reportCategory: Record<ReportKind, string> = {
  commercial_summary: "Performance",
  agreement_fulfilment: "Agreements",
  delivery_variance: "Deliveries",
  settlement_ageing: "Settlements",
  logistics_performance: "Logistics",
  operational_exposure: "Risks",
};
export const frequencyLabels = { on_demand: "On demand", weekly: "Weekly", monthly: "Monthly" } as const;
export type Frequency = keyof typeof frequencyLabels;
export type SavedReport = { id: string; name: string; kind: ReportKind; frequency: Frequency; owner: string; createdAt: string; lastRunAt: string | null; standard: boolean };

// ---- Permissions -------------------------------------------------------------------------------------------------------

export const PRICE_ROLES = ["Mine Manager", "Commercial / Finance Officer"];

const capabilities = {
  view: { roles: ["Mine Manager", "Commercial / Finance Officer", "Stores / Inventory Controller"], message: "Trade is open to the Mine Manager, the Commercial / Finance Officer and the Inventory Controller." },
  pricing: { roles: PRICE_ROLES, message: "Prices, values and balances are shown to the Mine Manager and the Commercial / Finance Officer." },
  manage_clients: { roles: PRICE_ROLES, message: "Clients are managed by the Mine Manager or the Commercial / Finance Officer." },
  manage_enquiries: { roles: PRICE_ROLES, message: "Enquiries are managed by the Mine Manager or the Commercial / Finance Officer." },
  manage_agreements: { roles: PRICE_ROLES, message: "Agreements are managed by the Mine Manager or the Commercial / Finance Officer." },
  manage_deliveries: { roles: ["Mine Manager", "Commercial / Finance Officer", "Stores / Inventory Controller"], message: "Deliveries are planned by the Mine Manager, the Commercial / Finance Officer or the Inventory Controller." },
  record_acceptance: { roles: PRICE_ROLES, message: "Customer acceptance is recorded by the Mine Manager or the Commercial / Finance Officer." },
  manage_settlements: { roles: PRICE_ROLES, message: "Invoices and payments are recorded by the Mine Manager or the Commercial / Finance Officer." },
  upload_documents: { roles: ["Mine Manager", "Commercial / Finance Officer", "Stores / Inventory Controller"], message: "Documents are uploaded by Trade users." },
  link_operations: { roles: ["Mine Manager", "Commercial / Finance Officer", "Stores / Inventory Controller"], message: "Operations are linked by Trade users." },
  manage_reports: { roles: ["Mine Manager", "Commercial / Finance Officer"], message: "Reports are created by the Mine Manager or the Commercial / Finance Officer." },
} as const;
export type TradeCapability = keyof typeof capabilities;

export function canTrade(capability: TradeCapability, actor: Actor): Check {
  const rule = capabilities[capability];
  return (rule.roles as readonly string[]).includes(actor.role) ? { allowed: true } : { allowed: false, reason: rule.message };
}

/** Who decides each kind of approval. The person who asked can never approve their own request. */
export const approverFor: Record<ApprovalType, string> = {
  agreement: "Mine Manager",
  amendment: "Mine Manager",
  quotation: "Commercial / Finance Officer",
  settlement: "Mine Manager",
  delivery: "Mine Manager",
};

export function canDecide(approval: Approval, actor: Actor): Check {
  if (approval.status !== "pending") return { allowed: false, reason: "This request has already been decided." };
  if (approval.submittedBy === actor.name) return { allowed: false, reason: "You asked for this approval, so someone else must decide it." };
  // The Mine Manager may decide any commercial approval; others only the kind assigned to their role.
  if (actor.role === "Mine Manager" || actor.role === approval.approverRole) return { allowed: true };
  return { allowed: false, reason: `This approval is decided by the ${approval.approverRole}.` };
}

// ---- Calculations ------------------------------------------------------------------------------------------------------

export const DAY = 86_400_000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / DAY);
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date.slice(0, 10)}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** Mining Operations figures for one shipment, as Trade reads them. */
export type ShipmentFacts = { id: string; number: string; state: string; tonnes: number; dispatched: number; received: number; dispatchedAt: string | null; receivedAt: string | null; preferredDate: string; transporter: string | null };

export type DeliveryQuantities = { planned: number; dispatched: number; received: number; accepted: number; source: string };

export function quantitiesOf(delivery: Delivery, shipment: ShipmentFacts | undefined): DeliveryQuantities {
  const accepted = delivery.acceptance?.tonnes ?? 0;
  if (shipment) return { planned: delivery.tonnes, dispatched: shipment.dispatched, received: shipment.received, accepted, source: `Mining Operations · ${shipment.number}` };
  if (delivery.operations) return { planned: delivery.tonnes, dispatched: delivery.operations.dispatched, received: delivery.operations.received, accepted, source: delivery.operations.source };
  return { planned: delivery.tonnes, dispatched: 0, received: 0, accepted, source: "Not dispatched yet" };
}

export function deliveryStage(delivery: Delivery, quantities: DeliveryQuantities): DeliveryStage {
  if (delivery.cancelled) return "cancelled";
  if (delivery.discrepancy && !delivery.discrepancy.resolution) return "disputed";
  if (delivery.acceptance) return "accepted";
  if (quantities.received > 0) return "received";
  if (quantities.dispatched > 0) return "in_transit";
  return "planned";
}

/** A delivery is late when its date has passed and nothing has been received, or at risk when it is due within two days and not dispatched. */
export function deliveryTiming(stage: DeliveryStage, scheduledDate: string, today: string): "late" | "at_risk" | null {
  if (stage === "planned" && scheduledDate < today) return "late";
  if (stage === "in_transit" && scheduledDate < today) return "late";
  if (stage === "planned" && daysBetween(today, scheduledDate) <= 2) return "at_risk";
  return null;
}

export function settlementPaid(settlement: Settlement) {
  return settlement.payments.reduce((total, item) => total + item.amount, 0);
}

export function settlementStatus(settlement: Settlement, today: string): SettlementStatus {
  if (settlement.dispute && !settlement.dispute.resolved) return "disputed";
  const amount = settlement.amount ?? 0;
  const paid = settlementPaid(settlement);
  if (amount > 0 && paid >= amount) return "settled";
  if (paid > 0) return "partial";
  return settlement.dueDate < today ? "overdue" : "pending";
}

/** Fulfilment of a commitment is accepted tonnes over committed tonnes. Dispatched and received tonnes are reported beside it, never instead. */
export function fulfilmentShare(accepted: number, committed: number) {
  return committed > 0 ? Math.min(1, accepted / committed) : 0;
}

export function agreementHealth(agreement: Agreement, committedDue: number, acceptedDue: number, today: string): "on_track" | "at_risk" | "expiring" | null {
  if (agreement.status !== "active") return null;
  // Behind: less than 85% of the tonnes that should have been accepted by now.
  if (committedDue > 0 && acceptedDue / committedDue < 0.85) return "at_risk";
  if (daysBetween(today, agreement.endDate) <= 90) return "expiring";
  return "on_track";
}

export const formatRand = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `R ${(value / 1_000_000).toLocaleString("en-GB", { maximumFractionDigits: 2 })}m`;
  return `R ${Math.round(value).toLocaleString("en-GB")}`;
};
export const formatRandExact = (value: number) => `R ${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatTonnes = (value: number) => `${Math.round(value).toLocaleString("en-GB")} t`;
export const formatPercent = (share: number) => `${Math.round(share * 100)}%`;
export const formatSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
export const formatDay = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
