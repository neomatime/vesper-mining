/**
 * Seed records for service providers, transport quotes and agreements. All fictional, all excluding VAT.
 *
 * Two timelines meet here and are labelled as such. The shipment quote (QR-0048) sits on the prototype's own day, 24 April 2025.
 * The agreements run through 2026 and are shown in a labelled simulated period, April 2026 (see TRANSPORT_DEMO_DATE).
 *
 * The coal agreements do not cover the chrome concentrate shipment SHP-0048, which is priced by its own quote.
 */
import type { Shipment, StockMovement, Stockpile, Transporter } from "@vesper/api-contracts";
import type { Agreement, AgreementCharge, EarlierDelivery, HistoryLine, Quote, QuoteRequest } from "./transport-rules";

const at = (day: string, time: string) => `2025-04-${day}T${time}:00+02:00`;

// ---- Providers ---------------------------------------------------------------------------------------------------------

const line = (id: string, when: string, actor: string, summary: string, note: string | null = null): HistoryLine => ({ id, at: when, actor, summary, note });

export const seedProviders: Transporter[] = [
  {
    id: "tr-001", name: "ABC Logistics", mode: "Road transport", serviceNote: "Bulk minerals", areasServed: ["North West", "Gauteng"], contactPerson: "Zanele Dube",
    contact: "quotes@abc.example", email: "quotes@abc.example", phone: "+27 11 555 0141", notes: "Regular carrier for finished stock.", attachments: [{ name: "ABC-registration.pdf", sizeLabel: "180 KB" }],
    approval: "approved", approvedUntil: "2026-03-31", active: true,
    history: [{ id: "tph-001", at: "2025-01-13T08:00:00+02:00", actor: "John Dlamini", summary: "Added and approved", note: null }],
  },
  {
    id: "tr-002", name: "Highveld Transport", mode: "Road transport", serviceNote: "Bulk minerals", areasServed: ["North West", "Gauteng"], contactPerson: "Thabo Mokoena",
    contact: "quotes@highveld.example", email: "quotes@highveld.example", phone: "+27 11 555 0172", notes: "", attachments: [],
    approval: "approved", approvedUntil: null, active: true,
    history: [{ id: "tph-002", at: "2025-02-03T09:00:00+02:00", actor: "John Dlamini", summary: "Added and approved", note: null }],
  },
  {
    id: "tr-003", name: "Metsi Logistics", mode: "Road transport", serviceNote: "Bulk minerals", areasServed: ["Limpopo", "Gauteng"], contactPerson: "Lerato Molefe",
    contact: "quotes@metsi.example", email: "quotes@metsi.example", phone: "+27 15 555 0113", notes: "Added after a recommendation. Documents still to be checked.", attachments: [],
    approval: "needs_review", approvedUntil: null, active: false,
    history: [{ id: "tph-003", at: "2025-04-22T10:00:00+02:00", actor: "Naledi Khoza", summary: "Added; needs mine approval", note: null }],
  },
];

// ---- Coal stock and the planned coal shipment ----------------------------------------------------------------------------------

export const seedCoalStockpile: Stockpile = { id: "sp-03", code: "SP-03", name: "Coal stock", mineral: "Coal", condition: "ready_for_shipment" };

export const seedCoalMovements: StockMovement[] = [
  { id: "mv-005", at: at("23", "06:00"), type: "opening", stockpileId: "sp-03", tonnes: 4000, ref: "Opening balance", actor: "Naledi Khoza", note: null },
  { id: "mv-006", at: at("24", "07:30"), type: "reserve", stockpileId: "sp-03", tonnes: 300, ref: "SHP-0051", actor: "John Dlamini", note: null },
];

/** Planned, linked to AG-0001. The collection is not confirmed: a valid agreement and an available allowance do not book a truck. */
export const seedCoalShipment: Shipment = {
  id: "ship-51", number: "SHP-0051", kind: "sale", mineral: "Coal", stockpileId: "sp-03", tonnes: 300, orderRef: "PO-2051", destination: "Customer Coal Yard",
  preferredDate: "2026-04-27", transporterId: "tr-001", note: "", state: "preparing", checks: { quality: true, instructions: false, documents: false, loading: false },
  requestId: null, dispatches: [], deliveries: [],
  events: [{ id: "sev-016", type: "created", summary: "Shipment created and 300 t reserved", actor: "John Dlamini", occurredAt: at("24", "07:30"), note: null }],
  pricingSource: { type: "agreement", quoteId: null, requestId: null, agreementId: "ag-0001", providerId: "tr-001", costExVat: null, label: "Agreement AG-0001", setBy: "John Dlamini", setAt: at("24", "07:35") },
  pricingHistory: [{ id: "spr-001", at: at("24", "07:35"), actor: "John Dlamini", summary: "Transport priced under agreement AG-0001", note: null }], transportMode: "provider", fleet: { coordinator: null, loads: [], internalCost: null },
  preparedBy: "John Dlamini", cancelledReason: null, version: 2, createdAt: at("24", "07:30"),
};

// ---- Quotes ------------------------------------------------------------------------------------------------------------

const blankQuote = (id: string, providerId: string): Quote => ({
  id, providerId, status: "waiting", reference: null, receivedOn: null, validUntil: null, currency: "ZAR", method: null, amount: null, feePeriod: null, loads: null, quantityTonnes: null,
  includedTonnes: null, allowancePeriod: null, billing: null, excessRate: null, inclusions: "", availability: "", vat: "not_stated", fuelAdjustment: "", otherCharges: "", exclusions: "", conditions: "",
  attachments: [], decision: null,
});

export const blank = blankQuote;

export const seedRequests: QuoteRequest[] = [
  {
    id: "qr-48", number: "QR-0048", kind: "shipment", status: "decision_recorded", shipmentId: "ship-48", material: "Chrome concentrate", from: "Riverside Mine", to: "Customer Stockyard A, Germiston",
    service: "Road · Bulk tipper · Multiple loads", quantityTonnes: 300, unit: "tonnes", collectionWindow: "26 Apr · 06:00–14:00", requiredBy: "2025-04-28", requirements: "Fuel and tolls included. Loading by mine; unloading by receiver.",
    startDate: null, endDate: null, expectedVolume: null, volumePeriod: null, preferredBilling: null, providerIds: ["tr-001", "tr-002"], replyBy: at("25", "16:00"),
    sentRecordedAt: at("23", "16:00"), sentBy: "Naledi Khoza", createdBy: "Naledi Khoza", createdAt: at("23", "15:30"),
    quotes: [
      { ...blankQuote("q-48-1", "tr-001"), status: "accepted", reference: "ABC-Q-2291", receivedOn: "2025-04-24", validUntil: "2025-04-25", method: "per_tonne", amount: 350, feePeriod: "shipment", quantityTonnes: 300, vat: "excluded",
        inclusions: "Fuel and tolls included.", availability: "Trucks available 26 April.", conditions: "Loading by the mine, unloading by the receiver.", attachments: [{ name: "ABC-Q-2291.pdf", sizeLabel: "96 KB" }],
        decision: { by: "John Dlamini", at: at("24", "08:30"), reason: "Lowest total price, fuel and tolls included." } },
      { ...blankQuote("q-48-2", "tr-002"), status: "not_selected", reference: "HT-0417", receivedOn: "2025-04-24", validUntil: "2025-04-25", method: "per_tonne", amount: 380, feePeriod: "shipment", quantityTonnes: 300, vat: "excluded",
        inclusions: "Fuel included, tolls extra.", availability: "Trucks available 26 April.", attachments: [{ name: "HT-0417.pdf", sizeLabel: "88 KB" }],
        decision: { by: "John Dlamini", at: at("24", "08:30"), reason: "Higher rate than ABC Logistics." } },
    ],
    history: [
      line("qh-001", at("23", "15:30"), "Naledi Khoza", "Request saved as a draft"),
      line("qh-002", at("23", "16:00"), "Naledi Khoza", "Request recorded as sent (demo: nothing was sent)"),
      line("qh-003", at("24", "08:30"), "John Dlamini", "Accepted ABC Logistics; Highveld Transport not selected"),
    ],
  },
];

// ---- Agreements --------------------------------------------------------------------------------------------------------

const base = {
  currency: "ZAR" as const, service: "Road transport", renewal: "Renewal to be agreed before the end date.", method: "fixed_fee" as const, feePeriod: "month" as const, billing: "monthly" as const,
  invoiceTiming: "Invoiced at the end of each month.", paymentTerms: "Payment within 30 days of invoice.", allowancePeriod: "calendar_month" as const, minimumCommitment: null,
  rollover: "none" as const, included: "Fuel and tolls.", excluded: "Loading and unloading.", vat: "excluded" as const, manualEstimate: null, sourceQuoteId: null, endedAt: null, endReason: null, version: 1,
};

export const seedAgreements: Agreement[] = [
  {
    ...base, id: "ag-0001", number: "AG-0001", providerId: "tr-001", reference: "ABC-TA-2026-01", document: { name: "AG-0001-ABC-Logistics.pdf", sizeLabel: "412 KB" },
    material: "Coal", from: "Riverside Mine", to: "Customer Coal Yard", startDate: "2026-01-01", endDate: "2026-12-31", fee: 1_000_000, includedTonnes: 10_000, excessRate: 120,
    confirmedBy: "John Dlamini", confirmedAt: "2025-12-15T10:00:00+02:00", createdAt: "2025-12-10T09:00:00+02:00",
    history: [line("ah-001", "2025-12-10T09:00:00+02:00", "John Dlamini", "Recorded from the signed document"), line("ah-002", "2025-12-15T10:00:00+02:00", "John Dlamini", "Terms reviewed and agreement activated")],
  },
  {
    ...base, id: "ag-0002", number: "AG-0002", providerId: "tr-002", reference: "HT-TA-2026-04", document: { name: "AG-0002-Highveld-Transport.pdf", sizeLabel: "388 KB" },
    material: "Coal", from: "Riverside Mine", to: "Export Terminal B", startDate: "2026-01-01", endDate: "2026-12-31", fee: 12_000_000, feePeriod: "year", billing: "yearly",
    invoiceTiming: "Invoiced once a year.", includedTonnes: 10_000, excessRate: null, included: "Fuel and tolls.", excluded: "Extra charges beyond the allowance are not specified in the document.",
    confirmedBy: "John Dlamini", confirmedAt: "2025-12-18T10:00:00+02:00", createdAt: "2025-12-12T09:00:00+02:00",
    history: [line("ah-003", "2025-12-12T09:00:00+02:00", "John Dlamini", "Recorded from the signed document"), line("ah-004", "2025-12-18T10:00:00+02:00", "John Dlamini", "Terms reviewed and agreement activated")],
  },
  {
    ...base, id: "ag-0003", number: "AG-0003", providerId: "tr-001", reference: "ABC-TA-2026-05", document: null,
    material: "Coal", from: "Riverside Mine", to: "Rail Siding C", startDate: "2026-05-01", endDate: "2026-05-31", fee: 900_000, includedTonnes: 7_500, excessRate: null,
    confirmedBy: null, confirmedAt: null, createdAt: "2026-04-10T09:00:00+02:00",
    history: [line("ah-005", "2026-04-10T09:00:00+02:00", "John Dlamini", "Draft recorded; terms still to be reviewed")],
  },
];

/** Fees already recorded: one per charge period. AG-0001 has January to March. April has not been recorded yet. */
export const seedCharges: AgreementCharge[] = [
  { id: "chg-001", agreementId: "ag-0001", period: "2026-01", amount: 1_000_000, recordedBy: "Zinhle Mahlangu", recordedAt: "2026-02-01T09:00:00+02:00" },
  { id: "chg-002", agreementId: "ag-0001", period: "2026-02", amount: 1_000_000, recordedBy: "Zinhle Mahlangu", recordedAt: "2026-03-01T09:00:00+02:00" },
  { id: "chg-003", agreementId: "ag-0001", period: "2026-03", amount: 1_000_000, recordedBy: "Zinhle Mahlangu", recordedAt: "2026-04-01T09:00:00+02:00" },
];

/** Deliveries from before the prototype's records. April 2026 on AG-0001 is 6,500 t, as in the agreed designs. */
export const seedEarlierDeliveries: EarlierDelivery[] = [
  { id: "ed-001", agreementId: "ag-0001", period: "2026-01", tonnes: 9_200, note: "Earlier deliveries, recorded" },
  { id: "ed-002", agreementId: "ag-0001", period: "2026-02", tonnes: 8_800, note: "Earlier deliveries, recorded" },
  { id: "ed-003", agreementId: "ag-0001", period: "2026-03", tonnes: 9_500, note: "Earlier deliveries, recorded" },
  { id: "ed-004", agreementId: "ag-0001", period: "2026-04", tonnes: 6_500, note: "Delivered to 24 April 2026, confirmed" },
  { id: "ed-005", agreementId: "ag-0002", period: "2026-04", tonnes: 2_400, note: "Delivered to 24 April 2026, confirmed" },
];

export const transportCounters = { quoteRequest: 48, agreement: 3, quote: 0, charge: 3, transportHistory: 10, fleetLoad: 0, briefingEvent: 0 };
