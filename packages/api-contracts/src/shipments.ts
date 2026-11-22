/**
 * Production, mineral inventory, shipments and collection requests: the records behind the Shift Control "Production" tab and the
 * Shipments module (demo and UAT scope; no external system is connected).
 *
 * Three ideas run through these records:
 *  - A reported production amount is not a stock balance. Stock changes only when a person checks the amount (a "receipt").
 *  - Stock is a ledger of movements (opening, receipt, reserve, release, dispatch), so every balance can be traced.
 *  - A collection request is not a booking. Only the transporter's reply confirms one.
 */
import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

// ---- Inventory ----------------------------------------------------------------------------------------------------

/** Whether material in a stockpile can be shipped yet. Material that needs processing can be stored but not reserved. */
export const stockConditionSchema = z.enum(["ready_for_shipment", "needs_processing"]);

export const stockpileSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  mineral: z.string().min(1),
  condition: stockConditionSchema,
});

export const movementTypeSchema = z.enum(["opening", "receipt", "reserve", "release", "dispatch"]);

export const stockMovementSchema = z.object({
  id: z.string().min(1),
  at: timestamp,
  type: movementTypeSchema,
  stockpileId: z.string().min(1),
  tonnes: z.number().positive(),
  /** The record that caused it, for example PR-0148 or SHP-0048. */
  ref: z.string().min(1),
  actor: z.string().min(1),
  note: z.string().nullable(),
});

// ---- Production ---------------------------------------------------------------------------------------------------

export const measurementBasisSchema = z.enum(["estimate", "weighbridge", "survey", "other"]);
export const productionStateSchema = z.enum(["draft", "needs_checking", "sent_back", "checked"]);

/** What the checker confirmed. The reported amount on the record is never overwritten. */
export const productionCheckSchema = z.object({
  confirmedTonnes: z.number().min(0),
  basis: measurementBasisSchema,
  /** The measurement record, by file name. The file itself is not stored in this build. */
  record: z.string().min(1),
  /** Required when the confirmed amount differs from the reported amount. */
  reason: z.string().nullable(),
  stockpileId: z.string().min(1),
  checkedBy: z.string().min(1),
  checkedAt: timestamp,
});

export const productionEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["recorded", "submitted", "edited", "sent_back", "checked"]),
  summary: z.string().min(1),
  actor: z.string().min(1),
  occurredAt: timestamp,
  note: z.string().nullable(),
});

export const productionRecordSchema = z.object({
  id: z.string().min(1),
  /** The readable number, for example PR-0148. */
  number: z.string().min(1),
  shiftId: z.string().nullable(),
  shiftName: z.string().min(1),
  mineral: z.string().min(1),
  area: z.string().min(1),
  targetTonnes: z.number().min(0),
  reportedTonnes: z.number().min(0),
  basis: measurementBasisSchema,
  /** Where the producing team says it was moved to. The checker confirms or changes it. */
  stockpileId: z.string().min(1),
  note: z.string(),
  evidence: z.array(z.object({ name: z.string().min(1), kind: z.enum(["photo", "document", "other"]), sizeLabel: z.string() })),
  reportedBy: z.string().min(1),
  state: productionStateSchema,
  sentBackReason: z.string().nullable(),
  check: productionCheckSchema.nullable(),
  events: z.array(productionEventSchema),
  version: z.number().int().positive(),
  createdAt: timestamp,
});

// ---- Shipments and logistics --------------------------------------------------------------------------------------

export const transporterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mode: z.string().min(1),
  contact: z.string(),
  approvedUntil: z.string().nullable(),
  active: z.boolean(),
});

/**
 * Where a shipment is in its life. `waiting` means a collection request has been sent and the transporter has not replied;
 * `confirmed` means the transporter replied. Neither is a dispatch.
 */
export const shipmentStateSchema = z.enum(["preparing", "waiting", "confirmed", "declined", "dispatched", "delivered", "cancelled"]);

/** The checks a person ticks before the shipment is ready. Reserved stock is not ticked: it is true by construction. */
export const shipmentChecksSchema = z.object({
  quality: z.boolean(),
  instructions: z.boolean(),
  documents: z.boolean(),
  loading: z.boolean(),
});

export const dispatchSchema = z.object({
  id: z.string().min(1),
  at: timestamp,
  tonnes: z.number().positive(),
  by: z.string().min(1),
  reference: z.string().nullable(),
});

export const deliverySchema = z.object({
  id: z.string().min(1),
  at: timestamp,
  /** What arrived. */
  tonnes: z.number().min(0),
  /** How much of the dispatched amount this delivery settles. The difference with `tonnes` is a shortfall or surplus. */
  settles: z.number().positive(),
  by: z.string().min(1),
  evidence: z.string().min(1),
  reason: z.string().nullable(),
  /** A difference stays visible until someone has reviewed it. A delivery with no difference counts as reviewed. */
  reviewed: z.boolean(),
  reviewedBy: z.string().nullable(),
});

export const shipmentEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["created", "checks_updated", "request_sent", "reminder_sent", "confirmed", "declined", "dispatched", "delivered", "difference_reviewed", "cancelled"]),
  summary: z.string().min(1),
  actor: z.string().min(1),
  occurredAt: timestamp,
  note: z.string().nullable(),
});

export const shipmentSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  mineral: z.string().min(1),
  stockpileId: z.string().min(1),
  tonnes: z.number().positive(),
  orderRef: z.string().min(1),
  destination: z.string().min(1),
  /** Preferred collection date, yyyy-mm-dd, in site time. */
  preferredDate: z.string().min(1),
  transporterId: z.string().min(1),
  note: z.string(),
  state: shipmentStateSchema,
  checks: shipmentChecksSchema,
  requestId: z.string().nullable(),
  dispatches: z.array(dispatchSchema),
  deliveries: z.array(deliverySchema),
  events: z.array(shipmentEventSchema),
  preparedBy: z.string().min(1),
  cancelledReason: z.string().nullable(),
  version: z.number().int().positive(),
  createdAt: timestamp,
});

export const collectionRequestStateSchema = z.enum(["sent", "confirmed", "declined", "cancelled"]);

/** One request to one transporter for one shipment. A shipment has at most one open request at a time. */
export const collectionRequestSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  shipmentId: z.string().min(1),
  transporterId: z.string().min(1),
  /** Identifies the request on the transporter's reply page, which needs no sign-in. */
  token: z.string().min(1),
  state: collectionRequestStateSchema,
  sentAt: timestamp,
  /** The collection time the transporter confirmed, in site time. */
  collectionAt: z.string().nullable(),
  reply: z.string().nullable(),
  repliedAt: timestamp.nullable(),
  reminders: z.number().int().min(0),
  /** Always true in this build: nothing is actually sent to anyone. */
  simulated: z.literal(true),
});

export type StockCondition = z.infer<typeof stockConditionSchema>;
export type Stockpile = z.infer<typeof stockpileSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type MeasurementBasis = z.infer<typeof measurementBasisSchema>;
export type ProductionState = z.infer<typeof productionStateSchema>;
export type ProductionCheck = z.infer<typeof productionCheckSchema>;
export type ProductionEvent = z.infer<typeof productionEventSchema>;
export type ProductionRecord = z.infer<typeof productionRecordSchema>;
export type Transporter = z.infer<typeof transporterSchema>;
export type ShipmentState = z.infer<typeof shipmentStateSchema>;
export type ShipmentChecks = z.infer<typeof shipmentChecksSchema>;
export type Dispatch = z.infer<typeof dispatchSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type ShipmentEvent = z.infer<typeof shipmentEventSchema>;
export type Shipment = z.infer<typeof shipmentSchema>;
export type CollectionRequestState = z.infer<typeof collectionRequestStateSchema>;
export type CollectionRequest = z.infer<typeof collectionRequestSchema>;
