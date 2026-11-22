/**
 * Seed records for production, mineral inventory, shipments and logistics (fictional manganese operation at Riverside Mine).
 *
 * The story it tells at the scenario's "now" (24 April 2025, 08:47):
 *  - SP-01 holds 2,000 t of finished stock; 1,200 t of it is reserved for three open shipments, so 800 t is available.
 *  - Shift A reported 1,080 t (an estimate) that nobody has checked yet. Checking it will add stock to SP-02 (raw material).
 *  - SHP-0048 is being prepared, SHP-0047 is waiting for the transporter's reply, SHP-0046 has a confirmed collection.
 * Stock opens at the balances above. Shipments delivered before that date are kept as history only, so their dispatches are not
 * in the ledger: the opening balance already reflects them.
 */
import type { CollectionRequest, ProductionRecord, Shipment, ShipmentEvent, StockMovement, Stockpile, Transporter } from "@vesper/api-contracts";

const SITE = "+02:00";
const at = (day: string, time: string) => `2025-04-${day}T${time}:00${SITE}`;

export const seedStockpiles: Stockpile[] = [
  { id: "sp-01", code: "SP-01", name: "Finished stock", mineral: "Manganese", condition: "ready_for_shipment" },
  { id: "sp-02", code: "SP-02", name: "Raw material", mineral: "Manganese", condition: "needs_processing" },
];

export const seedMovements: StockMovement[] = [
  { id: "mv-001", at: at("23", "06:00"), type: "opening", stockpileId: "sp-01", tonnes: 2000, ref: "Opening balance", actor: "Naledi Khoza", note: null },
  { id: "mv-002", at: at("23", "10:00"), type: "reserve", stockpileId: "sp-01", tonnes: 500, ref: "SHP-0046", actor: "John Dlamini", note: null },
  { id: "mv-003", at: at("24", "07:00"), type: "reserve", stockpileId: "sp-01", tonnes: 400, ref: "SHP-0047", actor: "John Dlamini", note: null },
  { id: "mv-004", at: at("24", "08:00"), type: "reserve", stockpileId: "sp-01", tonnes: 300, ref: "SHP-0048", actor: "John Dlamini", note: null },
];

export const seedTransporters: Transporter[] = [
  { id: "tr-001", name: "ABC Logistics", mode: "Road transport", contact: "dispatch@abclogistics.example", approvedUntil: "2026-03-31", active: true },
];

const event = (n: number, type: ShipmentEvent["type"], summary: string, actor: string, when: string, note: string | null = null): ShipmentEvent => ({
  id: `sev-${String(n).padStart(3, "0")}`,
  type,
  summary,
  actor,
  occurredAt: when,
  note,
});

const noChecks = { quality: true, instructions: true, documents: true, loading: true };

export const seedShipments: Shipment[] = [
  {
    id: "ship-48", number: "SHP-0048", mineral: "Manganese", stockpileId: "sp-01", tonnes: 300, orderRef: "PO-2048", destination: "Richards Bay Terminal",
    preferredDate: "2025-04-26", transporterId: "tr-001", note: "", state: "preparing", checks: noChecks, requestId: null, dispatches: [], deliveries: [],
    events: [event(1, "created", "Shipment created and 300 t reserved", "John Dlamini", at("24", "08:00"))], preparedBy: "John Dlamini", cancelledReason: null, version: 1, createdAt: at("24", "08:00"),
  },
  {
    id: "ship-47", number: "SHP-0047", mineral: "Manganese", stockpileId: "sp-01", tonnes: 400, orderRef: "PO-2047", destination: "Richards Bay Terminal",
    preferredDate: "2025-04-26", transporterId: "tr-001", note: "", state: "waiting", checks: noChecks, requestId: "req-97", dispatches: [], deliveries: [],
    events: [
      event(2, "created", "Shipment created and 400 t reserved", "John Dlamini", at("24", "07:00")),
      event(3, "request_sent", "Collection request LR-0097 recorded for ABC Logistics (demo: nothing was sent)", "John Dlamini", at("24", "07:30")),
    ],
    preparedBy: "John Dlamini", cancelledReason: null, version: 2, createdAt: at("24", "07:00"),
  },
  {
    id: "ship-46", number: "SHP-0046", mineral: "Manganese", stockpileId: "sp-01", tonnes: 500, orderRef: "PO-2046", destination: "Richards Bay Terminal",
    preferredDate: "2025-04-25", transporterId: "tr-001", note: "", state: "confirmed", checks: noChecks, requestId: "req-96", dispatches: [], deliveries: [],
    events: [
      event(4, "created", "Shipment created and 500 t reserved", "John Dlamini", at("23", "10:00")),
      event(5, "request_sent", "Collection request LR-0096 recorded for ABC Logistics (demo: nothing was sent)", "John Dlamini", at("23", "10:30")),
      event(6, "confirmed", "ABC Logistics confirmed collection on 25 Apr at 08:00", "ABC Logistics", at("23", "15:10")),
    ],
    preparedBy: "John Dlamini", cancelledReason: null, version: 3, createdAt: at("23", "10:00"),
  },
  {
    id: "ship-45", number: "SHP-0045", mineral: "Manganese", stockpileId: "sp-01", tonnes: 600, orderRef: "PO-2045", destination: "Richards Bay Terminal",
    preferredDate: "2025-04-22", transporterId: "tr-001", note: "", state: "delivered", checks: noChecks, requestId: "req-95",
    dispatches: [{ id: "dsp-045", at: at("22", "11:20"), tonnes: 600, by: "Naledi Khoza", reference: "Collection confirmed" }],
    deliveries: [{ id: "dlv-045", at: at("23", "08:30"), tonnes: 600, settles: 600, by: "Naledi Khoza", evidence: "DN-0045.pdf", reason: null, reviewed: true, reviewedBy: null }],
    events: [
      event(7, "created", "Shipment created and 600 t reserved", "John Dlamini", at("20", "09:00")),
      event(8, "confirmed", "ABC Logistics confirmed collection on 22 Apr at 09:00", "ABC Logistics", at("21", "09:00")),
      event(9, "dispatched", "600 t dispatched", "Naledi Khoza", at("22", "11:20")),
      event(10, "delivered", "600 t received and checked", "Naledi Khoza", at("23", "08:30")),
    ],
    preparedBy: "John Dlamini", cancelledReason: null, version: 5, createdAt: at("20", "09:00"),
  },
  {
    id: "ship-44", number: "SHP-0044", mineral: "Manganese", stockpileId: "sp-01", tonnes: 450, orderRef: "PO-2044", destination: "Richards Bay Terminal",
    preferredDate: "2025-04-21", transporterId: "tr-001", note: "", state: "delivered", checks: noChecks, requestId: "req-94",
    dispatches: [{ id: "dsp-044", at: at("21", "10:00"), tonnes: 450, by: "Naledi Khoza", reference: null }],
    deliveries: [{ id: "dlv-044", at: at("22", "08:00"), tonnes: 450, settles: 450, by: "Naledi Khoza", evidence: "DN-0044.pdf", reason: null, reviewed: true, reviewedBy: null }],
    events: [
      event(11, "created", "Shipment created and 450 t reserved", "John Dlamini", at("19", "09:00")),
      event(12, "dispatched", "450 t dispatched", "Naledi Khoza", at("21", "10:00")),
      event(13, "delivered", "450 t received and checked", "Naledi Khoza", at("22", "08:00")),
    ],
    preparedBy: "John Dlamini", cancelledReason: null, version: 4, createdAt: at("19", "09:00"),
  },
  {
    id: "ship-43", number: "SHP-0043", mineral: "Manganese", stockpileId: "sp-01", tonnes: 350, orderRef: "PO-2043", destination: "Richards Bay Terminal",
    preferredDate: "2025-04-21", transporterId: "tr-001", note: "", state: "cancelled", checks: noChecks, requestId: null, dispatches: [], deliveries: [],
    events: [
      event(14, "created", "Shipment created and 350 t reserved", "John Dlamini", at("18", "09:00")),
      event(15, "cancelled", "Shipment cancelled before dispatch; 350 t released", "John Dlamini", at("21", "07:00"), "The customer postponed the order."),
    ],
    preparedBy: "John Dlamini", cancelledReason: "The customer postponed the order.", version: 2, createdAt: at("18", "09:00"),
  },
];

export const seedRequests: CollectionRequest[] = [
  { id: "req-97", number: "LR-0097", shipmentId: "ship-47", transporterId: "tr-001", token: "lr-0097-4f2a9c", state: "sent", sentAt: at("24", "07:30"), collectionAt: null, reply: null, repliedAt: null, reminders: 0, simulated: true },
  { id: "req-96", number: "LR-0096", shipmentId: "ship-46", transporterId: "tr-001", token: "lr-0096-7b81de", state: "confirmed", sentAt: at("23", "10:30"), collectionAt: at("25", "08:00"), reply: "Truck booked for 08:00.", repliedAt: at("23", "15:10"), reminders: 0, simulated: true },
  { id: "req-95", number: "LR-0095", shipmentId: "ship-45", transporterId: "tr-001", token: "lr-0095-1c0d44", state: "confirmed", sentAt: at("20", "09:30"), collectionAt: at("22", "09:00"), reply: null, repliedAt: at("21", "09:00"), reminders: 0, simulated: true },
  { id: "req-94", number: "LR-0094", shipmentId: "ship-44", transporterId: "tr-001", token: "lr-0094-93aa10", state: "confirmed", sentAt: at("19", "09:30"), collectionAt: at("21", "08:30"), reply: null, repliedAt: at("20", "08:00"), reminders: 0, simulated: true },
];

const evidenceNone: ProductionRecord["evidence"] = [];

export const seedProduction: ProductionRecord[] = [
  {
    id: "prod-148", number: "PR-0148", shiftId: "shift-a-20250424", shiftName: "Shift A", mineral: "Manganese", area: "Pit3", targetTonnes: 1200, reportedTonnes: 1080,
    basis: "estimate", stockpileId: "sp-02", note: "Loader downtime reduced production.", evidence: evidenceNone, reportedBy: "Amina Patel", state: "needs_checking", sentBackReason: null, check: null,
    events: [{ id: "pev-001", type: "submitted", summary: "Sent for checking", actor: "Amina Patel", occurredAt: at("24", "08:30"), note: null }], version: 1, createdAt: at("24", "08:30"),
  },
  {
    id: "prod-147", number: "PR-0147", shiftId: "shift-n-20250423", shiftName: "Shift C", mineral: "Manganese", area: "Pit3", targetTonnes: 1000, reportedTonnes: 980,
    basis: "weighbridge", stockpileId: "sp-01", note: "", evidence: evidenceNone, reportedBy: "Sipho Nkosi", state: "checked",
    sentBackReason: null, check: { confirmedTonnes: 980, basis: "weighbridge", record: "WB-0147.pdf", reason: null, stockpileId: "sp-01", checkedBy: "Naledi Khoza", checkedAt: at("24", "06:40") },
    events: [
      { id: "pev-002", type: "submitted", summary: "Sent for checking", actor: "Sipho Nkosi", occurredAt: at("24", "06:10"), note: null },
      { id: "pev-003", type: "checked", summary: "980 t confirmed into SP-01", actor: "Naledi Khoza", occurredAt: at("24", "06:40"), note: null },
    ], version: 2, createdAt: at("24", "06:10"),
  },
  {
    id: "prod-146", number: "PR-0146", shiftId: null, shiftName: "Shift D", mineral: "Manganese", area: "Pit3", targetTonnes: 1200, reportedTonnes: 1140,
    basis: "weighbridge", stockpileId: "sp-01", note: "", evidence: evidenceNone, reportedBy: "Amina Patel", state: "checked",
    sentBackReason: null, check: { confirmedTonnes: 1140, basis: "weighbridge", record: "WB-0146.pdf", reason: null, stockpileId: "sp-01", checkedBy: "Naledi Khoza", checkedAt: at("23", "14:30") },
    events: [
      { id: "pev-004", type: "submitted", summary: "Sent for checking", actor: "Amina Patel", occurredAt: at("23", "14:10"), note: null },
      { id: "pev-005", type: "checked", summary: "1,140 t confirmed into SP-01", actor: "Naledi Khoza", occurredAt: at("23", "14:30"), note: null },
    ], version: 2, createdAt: at("23", "14:10"),
  },
];

/** The next numbers to hand out, so new records continue the sequence the seeds start. */
export const shipmentCounters = { shipment: 48, production: 148, collection: 97, movement: 4, shipmentEvent: 15, productionEvent: 5, dispatch: 100, delivery: 100, transporter: 1, token: 0 };
