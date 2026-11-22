/**
 * Rules for production, mineral inventory and shipments: who may do what, how stock balances are worked out from the movement
 * ledger, what a shipment's figures are, and the plain words shown for each state. Pure functions, shared by the demo store (which
 * enforces them) and the screens (which explain them), so the two cannot disagree.
 */
import type { CollectionRequest, Delivery, Dispatch, FinanceRecord, MeasurementBasis, PriceRecord, ProductionRecord, Shipment, ShipmentChecks, ShipmentState, StockCondition, StockMovement, Stockpile, Transporter, ValueStatus } from "@vesper/api-contracts";
import type { Actor, Check } from "./issue-rules";

// ---- Who may do what ---------------------------------------------------------------------------------------------------

export type ShipmentCapability = "record_production" | "check_production" | "manage_shipments" | "view_value" | "view_finance" | "manage_prices";

export const FINANCE_ROLE = "Commercial / Finance Officer";

const roles: Record<ShipmentCapability, { roles: string[]; message: string }> = {
  record_production: { roles: ["Shift Supervisor", "Mine Manager"], message: "Recording production is done by a Shift Supervisor or the Mine Manager." },
  check_production: { roles: ["Stores / Inventory Controller", "Mine Manager"], message: "Checking a quantity is done by the Inventory Controller or the Mine Manager." },
  manage_shipments: { roles: ["Stores / Inventory Controller", "Mine Manager"], message: "Shipments are managed by the Inventory Controller or the Mine Manager." },
  // Money is restricted. Operations see tonnes and status; only management and commercial or finance see values.
  view_value: { roles: ["Mine Manager", FINANCE_ROLE], message: "Sales values are shown to the Mine Manager and the Commercial / Finance Officer." },
  view_finance: { roles: ["Mine Manager", FINANCE_ROLE], message: "Transport cost, revenue and payments are shown to the Mine Manager and the Commercial / Finance Officer." },
  manage_prices: { roles: [FINANCE_ROLE], message: "Prices are supplied by the Commercial / Finance Officer." },
};

/** The role check. `reportedBy` is needed for check_production: nobody checks the amount they reported themselves. */
export function canActOnShipments(capability: ShipmentCapability, actor: Actor, reportedBy?: string): Check {
  const rule = roles[capability];
  if (!rule.roles.includes(actor.role)) return { allowed: false, reason: rule.message };
  if (capability === "check_production" && reportedBy && reportedBy === actor.name) {
    return { allowed: false, reason: "Someone other than the person who reported the amount must check it." };
  }
  return { allowed: true };
}

// ---- Words -------------------------------------------------------------------------------------------------------------

export const basisLabels: Record<MeasurementBasis, string> = { estimate: "Estimate", weighbridge: "Weighbridge", survey: "Survey", other: "Other" };
export const conditionLabels: Record<StockCondition, string> = { ready_for_shipment: "Ready for shipment", needs_processing: "Needs processing" };
export const destinations = ["Richards Bay Terminal", "Saldanha Bay Port", "Customer yard", "Customer Stockyard A, Germiston", "Customer Coal Yard", "Export Terminal B", "Rail Siding B", "Rail Siding C"];

export const productionStateLabels = { draft: "Draft", needs_checking: "Needs checking", sent_back: "Sent back", checked: "Checked" } as const;
/** Status-system values for the badge, so the shape and colour follow the product-wide rules. */
export const productionTone = { draft: "draft", needs_checking: "needs_confirmation", sent_back: "at_risk", checked: "confirmed" } as const;

export const shipmentStateLabels: Record<ShipmentState, string> = {
  preparing: "Preparing",
  waiting: "Waiting for transporter",
  confirmed: "Collection confirmed",
  declined: "Transporter declined",
  dispatched: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const shipmentTone: Record<ShipmentState, string> = {
  preparing: "in_progress",
  waiting: "needs_confirmation",
  confirmed: "confirmed",
  declined: "at_risk",
  dispatched: "in_progress",
  delivered: "confirmed",
  cancelled: "cancelled",
};

export const checkLabels: Record<keyof ShipmentChecks, string> = {
  quality: "Quality report checked",
  instructions: "Delivery instructions approved",
  documents: "Required documents added",
  loading: "Loading arrangements confirmed",
};

// ---- Stock -------------------------------------------------------------------------------------------------------------

export type StockPosition = { onHand: number; reserved: number; available: number };

/**
 * A stockpile's balances from the ledger. On hand counts what is physically there (openings and receipts, less dispatches).
 * Reserved is stock promised to shipments that have not left yet. Available is what can still be reserved, and is always zero
 * for material that needs processing: it can be stored, never promised.
 */
export function stockPosition(stockpile: Pick<Stockpile, "id" | "condition">, movements: StockMovement[]): StockPosition {
  let onHand = 0;
  let reserved = 0;
  for (const move of movements) {
    if (move.stockpileId !== stockpile.id) continue;
    if (move.type === "opening" || move.type === "receipt") onHand += move.tonnes;
    else if (move.type === "reserve") reserved += move.tonnes;
    else if (move.type === "release") reserved -= move.tonnes;
    else if (move.type === "dispatch") {
      onHand -= move.tonnes;
      reserved -= move.tonnes;
    }
  }
  const available = stockpile.condition === "ready_for_shipment" ? Math.max(0, onHand - reserved) : 0;
  return { onHand, reserved, available };
}

/** "1,200 t": a comma between thousands and a point for decimals, so a figure is never read two ways. */
export const formatTonnes = (value: number) => `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)} t`;

// ---- Production --------------------------------------------------------------------------------------------------------

/** How far the confirmed amount is from the reported one. Negative means less than reported. */
export const checkDifference = (record: Pick<ProductionRecord, "reportedTonnes">, confirmed: number) => Math.round((confirmed - record.reportedTonnes) * 100) / 100;

// ---- Shipments ---------------------------------------------------------------------------------------------------------

export type ShipmentFigures = {
  dispatched: number;
  /** Dispatched amount not yet delivered. */
  inTransit: number;
  /** Still at the mine and not yet dispatched. */
  remaining: number;
  received: number;
  /** Deliveries whose difference nobody has reviewed yet. */
  unreviewed: Delivery[];
};

const sum = (items: { tonnes: number }[]) => Math.round(items.reduce((total, item) => total + item.tonnes, 0) * 100) / 100;

export function shipmentFigures(shipment: Pick<Shipment, "tonnes" | "dispatches" | "deliveries">): ShipmentFigures {
  const dispatched = sum(shipment.dispatches as Dispatch[]);
  const settled = Math.round(shipment.deliveries.reduce((total, item) => total + item.settles, 0) * 100) / 100;
  return {
    dispatched,
    inTransit: Math.max(0, Math.round((dispatched - settled) * 100) / 100),
    remaining: Math.max(0, Math.round((shipment.tonnes - dispatched) * 100) / 100),
    received: sum(shipment.deliveries),
    unreviewed: shipment.deliveries.filter((item) => !item.reviewed),
  };
}

/** What still stops the shipment being marked ready, in plain words. Empty means it can go. */
export function readinessProblems(shipment: Pick<Shipment, "checks" | "state"> & { transportMode?: Shipment["transportMode"] }, transporter: { active: boolean } | undefined): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(checkLabels) as (keyof ShipmentChecks)[]) if (!shipment.checks[key]) problems.push(`Tick "${checkLabels[key]}".`);
  if (shipment.transportMode !== "own_fleet" && (!transporter || !transporter.active)) problems.push("Choose an approved transporter.");
  return problems;
}

/** The four stages shown on a shipment, and which one it is in (0 to 3, or 4 when it is complete). */
export const shipmentStages = ["Prepare", "Arrange collection", "Dispatch", "Delivery"] as const;
export function shipmentStage(shipment: Pick<Shipment, "state">): number {
  switch (shipment.state) {
    case "preparing":
    case "declined":
      return 0;
    case "waiting":
      return 1;
    case "confirmed":
      return 2;
    case "dispatched":
      return 3;
    case "delivered":
      return 4;
    default:
      return 0;
  }
}

/** The single next step to show beside a shipment, as a label and what it needs. */
export function nextStepLabel(shipment: Pick<Shipment, "state">): string {
  switch (shipment.state) {
    case "preparing":
      return "Review checks";
    case "waiting":
      return "View request";
    case "confirmed":
      return "Record dispatch";
    case "declined":
      return "Choose again";
    case "dispatched":
      return "Record delivery";
    default:
      return "View shipment";
  }
}

/** A shipment can be cancelled only before anything has left the mine. */
export const canCancel = (shipment: Pick<Shipment, "state" | "dispatches">) =>
  ["preparing", "waiting", "confirmed", "declined"].includes(shipment.state) && shipment.dispatches.length === 0;

/** Each shift's target for the mineral being mined. A fixed demo figure; a real build would read the shift plan. */
export const shiftTargetTonnes = 1200;

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "26 Apr" from a yyyy-mm-dd date. Dates here are site dates, so no time zone is involved. */
export function shortDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return month && day ? `${day} ${monthNames[month - 1]}` : date;
}

// ---- Value -------------------------------------------------------------------------------------------------------------

/** One currency for the demonstration. */
export const CURRENCY = "ZAR";
/** What a tonne means for pricing. A price is only used when it names exactly this, so price and quantity always agree. */
export const QUANTITY_BASIS = "Tonnes dispatched from the mine";
export const PRICE_BASIS = "Fixed price per tonne";

export const valueStatusLabels: Record<ValueStatus, string> = { estimated: "Estimated", provisional: "Provisional", final: "Final", not_priced: "Not priced", not_applicable: "Not applicable" };
/** Status-system values for the badge. */
export const valueTone: Record<ValueStatus, string> = { estimated: "reported", provisional: "needs_confirmation", final: "confirmed", not_priced: "unknown", not_applicable: "unknown" };

/** "R 555,000": the currency symbol, a comma between thousands, no decimals. */
export const formatMoney = (value: number) => `R ${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value))}`;

export const paymentLabels = { not_invoiced: "Not invoiced", unpaid: "Unpaid", part_paid: "Part paid", paid: "Paid" } as const;

const sameReference = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The price in force for an order or contract: its newest version. Older versions stay on the record. */
export function currentPrice(prices: PriceRecord[], reference: string): PriceRecord | null {
  return prices.filter((item) => sameReference(item.reference, reference)).sort((a, b) => b.version - a.version)[0] ?? null;
}

export type ShipmentValue = {
  status: ValueStatus;
  /** The sales value, or null when there is none to show. */
  amount: number | null;
  /** The tonnes the value is worked out on. */
  quantity: number;
  price: PriceRecord | null;
  /** Plain words for why a value is missing, when it is. */
  reason: string | null;
};

/**
 * The sales value of a shipment, in one place so every screen shows the same figure.
 *  - An internal transfer has no sales value.
 *  - With no usable price the shipment is "Not priced". A price on a different quantity basis is not usable.
 *  - Estimated: price x the planned tonnes. Provisional: price x the tonnes actually dispatched, once everything has left.
 *    Final: the value finance has settled.
 * The sales value is an operational estimate. It is not revenue and not cash.
 */
export function shipmentValue(shipment: Pick<Shipment, "kind" | "tonnes" | "dispatches" | "deliveries" | "state">, price: PriceRecord | null, finance: FinanceRecord | null): ShipmentValue {
  const dispatched = shipment.dispatches.reduce((total, item) => total + item.tonnes, 0);
  const fullyDispatched = dispatched > 0 && dispatched >= shipment.tonnes;
  const quantity = fullyDispatched ? dispatched : shipment.tonnes;
  if (shipment.kind === "internal_transfer") return { status: "not_applicable", amount: null, quantity, price: null, reason: "An internal transfer has no sales value." };
  if (!price) return { status: "not_priced", amount: null, quantity, price: null, reason: "No price has been supplied for this order yet." };
  if (price.quantityBasis !== QUANTITY_BASIS || price.currency !== CURRENCY) {
    return { status: "not_priced", amount: null, quantity, price, reason: "The price is not on the same quantity basis as the shipment, so it cannot be used." };
  }
  if (finance?.finalValue != null) return { status: "final", amount: finance.finalValue, quantity, price, reason: null };
  return { status: fullyDispatched ? "provisional" : "estimated", amount: Math.round(quantity * price.pricePerTonne), quantity, price, reason: null };
}

/** The reason a shipment is late, or null when it is on time. A shipment that has left the mine is no longer delayed here. */
export function delayReason(shipment: Pick<Shipment, "state" | "preferredDate">, request: Pick<CollectionRequest, "collectionAt"> | null, now: string): string | null {
  if (shipment.state === "declined") return "The transporter declined";
  if (shipment.state === "confirmed" && request?.collectionAt && Date.parse(request.collectionAt) < Date.parse(now)) return "The confirmed collection time has passed";
  if ((shipment.state === "preparing" || shipment.state === "waiting") && shipment.preferredDate <= now.slice(0, 10)) return "The collection date has been reached without a confirmed collection";
  return null;
}

/** What is holding a shipment up, in plain words, or null when nothing is. */
export function blockerOf(shipment: Shipment, request: CollectionRequest | null, transporter: Transporter | undefined): string | null {
  switch (shipment.state) {
    case "preparing": {
      const missing = (Object.keys(checkLabels) as (keyof ShipmentChecks)[]).find((key) => !shipment.checks[key]);
      return missing ? `${checkLabels[missing]} is still to do` : null;
    }
    case "waiting":
      return `Waiting for ${transporter?.name ?? "the transporter"} to reply`;
    case "declined":
      return `${transporter?.name ?? "The transporter"} declined${request?.reply ? `: ${request.reply}` : ""}`;
    case "dispatched":
      return shipmentFigures(shipment).unreviewed.length > 0 ? "A delivery difference needs review" : null;
    default:
      return null;
  }
}

/** Who has the next move: the transporter while a reply is awaited, otherwise the person who prepared the shipment. */
export const responsibleOf = (shipment: Pick<Shipment, "state" | "preparedBy">, transporter: Transporter | undefined) =>
  shipment.state === "waiting" ? transporter?.name ?? "The transporter" : shipment.preparedBy;

export type ValueSummary = {
  /** Requested or confirmed, not yet dispatched, and on time. */
  awaiting: { amount: number; count: number };
  /** Not yet dispatched and late (see delayReason). */
  delayed: { amount: number; count: number };
  /** Sales shipments in either group with no price, so their value is left out of the totals. */
  notPriced: number;
};

/**
 * Two totals that never overlap: each shipment is in at most one of them, and a shipment with no price adds nothing to either
 * (it is counted separately as "not priced"). Internal transfers and shipments that have left the mine are in neither.
 * A delayed shipment's value is the value at stake in a late collection. It is not a loss.
 */
export function valueSummary(shipments: Shipment[], valueOf: (shipment: Shipment) => ShipmentValue, requestOf: (shipment: Shipment) => CollectionRequest | null, now: string): ValueSummary {
  const summary: ValueSummary = { awaiting: { amount: 0, count: 0 }, delayed: { amount: 0, count: 0 }, notPriced: 0 };
  for (const shipment of shipments) {
    if (shipment.kind !== "sale") continue;
    const late = delayReason(shipment, requestOf(shipment), now) !== null;
    const awaiting = (shipment.state === "waiting" || shipment.state === "confirmed") && !late;
    const delayedNow = late && ["preparing", "waiting", "confirmed", "declined"].includes(shipment.state);
    if (!awaiting && !delayedNow) continue;
    const value = valueOf(shipment);
    if (value.amount === null) {
      summary.notPriced += 1;
      continue;
    }
    const bucket = delayedNow ? summary.delayed : summary.awaiting;
    bucket.amount += value.amount;
    bucket.count += 1;
  }
  return summary;
}
