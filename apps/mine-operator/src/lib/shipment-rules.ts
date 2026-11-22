/**
 * Rules for production, mineral inventory and shipments: who may do what, how stock balances are worked out from the movement
 * ledger, what a shipment's figures are, and the plain words shown for each state. Pure functions, shared by the demo store (which
 * enforces them) and the screens (which explain them), so the two cannot disagree.
 */
import type { Delivery, Dispatch, MeasurementBasis, ProductionRecord, Shipment, ShipmentChecks, ShipmentState, StockCondition, StockMovement, Stockpile } from "@vesper/api-contracts";
import type { Actor, Check } from "./issue-rules";

// ---- Who may do what ---------------------------------------------------------------------------------------------------

export type ShipmentCapability = "record_production" | "check_production" | "manage_shipments";

const roles: Record<ShipmentCapability, { roles: string[]; message: string }> = {
  record_production: { roles: ["Shift Supervisor", "Mine Manager"], message: "Recording production is done by a Shift Supervisor or the Mine Manager." },
  check_production: { roles: ["Stores / Inventory Controller", "Mine Manager"], message: "Checking a quantity is done by the Inventory Controller or the Mine Manager." },
  manage_shipments: { roles: ["Stores / Inventory Controller", "Mine Manager"], message: "Shipments are managed by the Inventory Controller or the Mine Manager." },
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
export const destinations = ["Richards Bay Terminal", "Saldanha Bay Port", "Customer yard"];

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
export function readinessProblems(shipment: Pick<Shipment, "checks" | "state">, transporter: { active: boolean } | undefined): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(checkLabels) as (keyof ShipmentChecks)[]) if (!shipment.checks[key]) problems.push(`Tick "${checkLabels[key]}".`);
  if (!transporter || !transporter.active) problems.push("Choose an approved transporter.");
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
