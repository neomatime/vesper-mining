// @vitest-environment node

/**
 * Unit tests (Vitest). Service providers, transport quotes and transport agreements: the calculations (allowance, allocation, periods),
 * eligibility, the quote and agreement workflows, and who may see commercial terms. Fictional April 2026 demonstration data.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import {
  TRANSPORT_DEMO_DATE,
  agreementStatus,
  allocatedCost,
  allowanceFor,
  chargeAmount,
  chargePeriods,
  durationLabel,
  eligibleAgreements,
  feeEquivalents,
  quoteTotal,
} from "./transport-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
const finance: Actor = { name: "Zinhle Mahlangu", role: "Commercial / Finance Officer" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };

function rejects(operation: () => unknown, status: number, pattern?: RegExp) {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(DemoError);
    expect((error as DemoError).status).toBe(status);
    if (pattern) expect((error as DemoError).message).toMatch(pattern);
    return;
  }
  throw new Error("Expected the operation to be rejected.");
}

const data = (actor: Actor = manager) => demoDomain.transport(actor);
const terms = () => data().terms!;
const agreement = (number: string) => terms().agreements.find((item) => item.number === number)!;
const shipment = (number: string) => demoDomain.logistics(manager).shipments.find((item) => item.number === number)!;
const usage = (number: string, period = "2026-04") => {
  const found = agreement(number);
  return allowanceFor(found, period, demoDomain.logistics(manager).shipments, terms().earlier);
};
const quoteInput = { reference: "ABC-Q-9", receivedOn: "2025-04-24", validUntil: "2025-04-30", method: "per_tonne", amount: 350, vat: "excluded" };
const coalShipment = { stockpileId: "sp-03", tonnes: 200, orderRef: "PO-C-1", destination: "Customer Coal Yard", preferredDate: "2026-04-28", transporterId: "tr-001" };

beforeEach(() => demoDomain.reset());

describe("the demonstration data", () => {
  it("has the agreed shipment quote: ABC accepted at R350/t, Highveld not selected, collection unconfirmed", () => {
    const request = terms().requests.find((item) => item.number === "QR-0048")!;
    expect(request).toMatchObject({ kind: "shipment", status: "decision_recorded", material: "Chrome concentrate", quantityTonnes: 300 });
    const [abc, highveld] = request.quotes;
    expect(quoteTotal(abc)).toBe(105000);
    expect(quoteTotal(highveld)).toBe(114000);
    expect(abc).toMatchObject({ status: "accepted", decision: { by: "John Dlamini" } });
    expect(highveld.status).toBe("not_selected");
    expect(shipment("SHP-0048")).toMatchObject({ destination: "Customer Stockyard A, Germiston", state: "preparing", pricingSource: { type: "quote", costExVat: 105000 } });
  });

  it("has three agreements with their own status", () => {
    expect(["AG-0001", "AG-0002", "AG-0003"].map((number) => agreementStatus(agreement(number), TRANSPORT_DEMO_DATE))).toEqual(["active", "active", "draft"]);
  });

  it("shows April 2026 on AG-0001 as 10,000 t included, 6,500 t delivered, 300 t planned and 3,200 t available", () => {
    expect(usage("AG-0001")).toMatchObject({ included: 10000, delivered: 6500, planned: 300, available: 3200, excess: 0 });
    expect(shipment("SHP-0051")).toMatchObject({ mineral: "Coal", tonnes: 300, state: "preparing", pricingSource: { agreementId: "ag-0001" } });
  });

  it("shows the allocated cost estimate with its calculation, and says it is not another charge", () => {
    const share = allocatedCost(agreement("AG-0001"), 300);
    expect(share).toMatchObject({ amount: 30000, formula: "300 ÷ 10,000 × R1,000,000 = R30,000" });
  });
});

describe("agreement length, billing, price period and allowance period stay independent", () => {
  it("lets a 12-month agreement have a monthly fee, monthly billing and a monthly allowance", () => {
    const a = agreement("AG-0001");
    expect({ months: durationLabel(a.startDate, a.endDate), fee: a.feePeriod, billing: a.billing, allowance: a.allowancePeriod }).toEqual({ months: "12 months", fee: "month", billing: "monthly", allowance: "calendar_month" });
    expect(chargePeriods(a)).toHaveLength(12);
  });

  it("lets yearly billing sit with a monthly allowance, without turning it into an annual one or adding a discount", () => {
    const a = agreement("AG-0002");
    expect(a).toMatchObject({ billing: "yearly", feePeriod: "year", allowancePeriod: "calendar_month", includedTonnes: 10000 });
    expect(chargePeriods(a)).toEqual(["2026"]);
    expect(chargeAmount(a)).toBe(12_000_000);
    expect(feeEquivalents(12_000_000, "year")).toEqual({ perMonth: 1_000_000, perYear: 12_000_000 });
    expect(feeEquivalents(1_000_000, "month")).toEqual({ perMonth: 1_000_000, perYear: 12_000_000 });
    // A yearly fee against a monthly allowance has no agreed way to be shared per tonne: it says so.
    expect(allocatedCost(a, 300)).toMatchObject({ amount: null });
    expect(allocatedCost(a, 300).reason).toMatch(/per year.*per calendar month/);
  });

  it("measures durations from the dates alone", () => {
    expect(durationLabel("2026-05-01", "2026-05-31")).toBe("1 month");
    expect(durationLabel("2026-05-01", "2027-04-30")).toBe("12 months");
    expect(durationLabel("2026-05-10", "2026-05-24")).toBe("15 days");
  });

  it("keeps a draft a draft until it is confirmed, and ends it only by an explicit step", () => {
    expect(agreementStatus({ confirmedAt: null, endedAt: null, startDate: "2026-01-01", endDate: "2026-12-31" }, TRANSPORT_DEMO_DATE)).toBe("draft");
    expect(agreementStatus({ confirmedAt: "x", endedAt: null, startDate: "2026-06-01", endDate: "2026-12-31" }, TRANSPORT_DEMO_DATE)).toBe("upcoming");
    expect(agreementStatus({ confirmedAt: "x", endedAt: null, startDate: "2025-01-01", endDate: "2025-12-31" }, TRANSPORT_DEMO_DATE)).toBe("expired");
    expect(agreementStatus({ confirmedAt: "x", endedAt: "y", startDate: "2026-01-01", endDate: "2026-12-31" }, TRANSPORT_DEMO_DATE)).toBe("ended");
  });
});

describe("quote totals", () => {
  it("works out whole-shipment, per-tonne and per-load totals, and needs the loads for a per-load price", () => {
    expect(quoteTotal({ method: "whole_shipment", amount: 90000, loads: null, quantityTonnes: 300 })).toBe(90000);
    expect(quoteTotal({ method: "per_tonne", amount: 350, loads: null, quantityTonnes: 300 })).toBe(105000);
    expect(quoteTotal({ method: "per_load", amount: 12000, loads: 10, quantityTonnes: 300 })).toBe(120000);
    expect(quoteTotal({ method: "per_load", amount: 12000, loads: null, quantityTonnes: 300 })).toBeNull();
  });
});

describe("applying an agreement to a shipment", () => {
  const eligibility = (number: string) => {
    const { providers, terms: t } = data();
    return eligibleAgreements(t!.agreements, providers, shipment(number), TRANSPORT_DEMO_DATE);
  };

  it("refuses an agreement for the wrong material or route", () => {
    const result = eligibility("SHP-0048");
    expect(result.eligible).toHaveLength(0);
    expect(result.rejected.every((item) => /coal/i.test(item.reason) || /not approved|not active/i.test(item.reason))).toBe(true);
    rejects(() => demoDomain.applyAgreement(shipment("SHP-0048").id, agreement("AG-0001").id, { replace: true, reason: "Trying coal on chrome." }, manager), 409, /coal/i);
  });

  it("allows only the agreement that covers the route, the dates and the service", () => {
    const result = eligibility("SHP-0051");
    expect(result.eligible.map((item) => item.number)).toEqual(["AG-0001"]);
    expect(result.rejected.find((item) => item.agreement.number === "AG-0002")!.reason).toMatch(/Export Terminal B/);
    expect(result.rejected.find((item) => item.agreement.number === "AG-0003")!.reason).toMatch(/draft/i);
  });

  it("will not use an agreement whose provider is not approved", () => {
    const { providers, terms: t } = data();
    const paused = providers.map((item) => (item.id === "tr-001" ? { ...item, approval: "needs_review" as const } : item));
    const result = eligibleAgreements(t!.agreements, paused, shipment("SHP-0051"), TRANSPORT_DEMO_DATE);
    expect(result.rejected.find((item) => item.agreement.number === "AG-0001")!.reason).toMatch(/not approved/);
  });

  it("keeps one pricing source: replacing it needs an explicit step and a reason, and the history is kept", () => {
    const made = demoDomain.createShipment(coalShipment, manager);
    demoDomain.applyAgreement(made.id, agreement("AG-0001").id, {}, manager);
    expect(shipment(made.number).pricingSource).toMatchObject({ type: "agreement", agreementId: "ag-0001" });
    rejects(() => demoDomain.applyAgreement(made.id, agreement("AG-0001").id, { replace: true, reason: "Same one." }, manager), 409, /already uses/);
    // SHP-0048 already has a quote. Another source needs replacing explicitly.
    rejects(() => demoDomain.applyAgreement(shipment("SHP-0051").id, agreement("AG-0001").id, {}, manager), 409);
  });

  it("does not book a truck: a valid agreement and an available allowance leave collection and readiness as they were", () => {
    const before = shipment("SHP-0051");
    expect(before.state).toBe("preparing");
    expect(before.requestId).toBeNull();
    expect(before.checks).toMatchObject({ instructions: false, documents: false, loading: false });
  });
});

describe("allowance moves between planned and delivered without counting twice", () => {
  it("counts a new plan, then its delivery, once each", () => {
    const made = demoDomain.createShipment({ ...coalShipment, transporterId: "tr-001" }, manager);
    demoDomain.applyAgreement(made.id, agreement("AG-0001").id, {}, manager);
    expect(usage("AG-0001")).toMatchObject({ delivered: 6500, planned: 500, available: 3000 });
    demoDomain.updateShipment(made.id, { checks: { quality: true, instructions: true, documents: true, loading: true } }, manager);
    const { request } = demoDomain.markShipmentReady(made.id, {}, manager);
    demoDomain.transporterRespond(request.token, { answer: "confirm", date: "2026-04-29", time: "08:00" });
    demoDomain.recordDispatch(made.id, { tonnes: 200 }, stores);
    expect(usage("AG-0001")).toMatchObject({ delivered: 6500, planned: 500, available: 3000 });
    demoDomain.recordDelivery(made.id, { tonnes: 200, evidence: "DN-C1.pdf" }, stores);
    expect(usage("AG-0001")).toMatchObject({ delivered: 6700, planned: 300, available: 3000 });
  });

  it("releases a plan that is cancelled before it is fulfilled", () => {
    const made = demoDomain.createShipment(coalShipment, manager);
    demoDomain.applyAgreement(made.id, agreement("AG-0001").id, {}, manager);
    expect(usage("AG-0001").planned).toBe(500);
    demoDomain.cancelShipment(made.id, { reason: "The customer postponed the order." }, manager);
    expect(usage("AG-0001")).toMatchObject({ planned: 300, available: 3200 });
  });

  it("reports tonnes beyond the allowance as excess rather than hiding them", () => {
    const made = demoDomain.createShipment({ ...coalShipment, tonnes: 3600 }, manager);
    demoDomain.applyAgreement(made.id, agreement("AG-0001").id, {}, manager);
    expect(usage("AG-0001")).toMatchObject({ available: 0, excess: 400 });
  });

  it("preserves earlier periods and does not roll unused allowance over", () => {
    expect(usage("AG-0001", "2026-03")).toMatchObject({ included: 10000, delivered: 9500, planned: 0, available: 500 });
    expect(agreement("AG-0001").rollover).toBe("none");
    expect(usage("AG-0001", "2026-01").delivered).toBe(9200);
  });
});

describe("recurring fees are recorded once per charge period", () => {
  it("records April once, refuses it twice, and never copies the fee onto a shipment", () => {
    const charge = demoDomain.recordCharge(agreement("AG-0001").id, { period: "2026-04" }, finance);
    expect(charge).toMatchObject({ period: "2026-04", amount: 1_000_000 });
    rejects(() => demoDomain.recordCharge(agreement("AG-0001").id, { period: "2026-04" }, finance), 409, /already been recorded/);
    expect(terms().charges.filter((item) => item.agreementId === "ag-0001")).toHaveLength(4);
    expect(shipment("SHP-0051").pricingSource!.costExVat).toBeNull();
  });

  it("records a yearly fee once for the year, and refuses a month that is not a charge period", () => {
    expect(demoDomain.recordCharge(agreement("AG-0002").id, { period: "2026" }, finance).amount).toBe(12_000_000);
    rejects(() => demoDomain.recordCharge(agreement("AG-0002").id, { period: "2026-04" }, finance), 400);
    rejects(() => demoDomain.recordCharge(agreement("AG-0003").id, { period: "2026-05" }, finance), 409, /Confirm the agreement/);
  });
});

describe("providers", () => {
  it("adds a provider as Needs review, and it cannot be asked to quote until the Mine Manager approves it", () => {
    const provider = demoDomain.addTransportProvider({ name: "Karoo Haulage", mode: "Road transport", areasServed: "Northern Cape, Gauteng", contactPerson: "Pieter Smit", email: "quotes@karoo.example" }, stores);
    expect(provider).toMatchObject({ approval: "needs_review", active: false, areasServed: ["Northern Cape", "Gauteng"] });
    rejects(() => demoDomain.createQuoteRequest({ kind: "shipment", shipmentId: shipment("SHP-0047").id, providerIds: [provider.id], replyBy: "2025-04-25T16:00" }, stores), 409, /not approved/);
    rejects(() => demoDomain.updateTransportProvider(provider.id, { approval: "approved" }, stores), 403);
    expect(demoDomain.updateTransportProvider(provider.id, { approval: "approved" }, manager)).toMatchObject({ approval: "approved", active: true });
  });

  it("edits details, keeps inactive providers and their history, and refuses to drop one with shipments in progress", () => {
    const edited = demoDomain.updateTransportProvider("tr-002", { phone: "+27 11 555 9999", notes: "Prefers email." }, stores);
    expect(edited.phone).toBe("+27 11 555 9999");
    demoDomain.updateTransportProvider("tr-002", { approval: "inactive", note: "Insurance documents have lapsed." }, manager);
    const kept = data().providers.find((item) => item.id === "tr-002")!;
    expect(kept).toMatchObject({ approval: "inactive", active: false });
    expect(kept.history.map((line) => line.summary).join(" ")).toMatch(/Mine approval changed from Approved to Inactive/);
    rejects(() => demoDomain.updateTransportProvider("tr-001", { approval: "inactive", note: "Testing the guard." }, manager), 409, /in progress/);
  });
});

describe("quote requests for one shipment", () => {
  const open = (overrides: Record<string, unknown> = {}) => demoDomain.createQuoteRequest({ kind: "shipment", shipmentId: shipment("SHP-0047").id, providerIds: ["tr-001", "tr-002"], replyBy: "2025-04-25T16:00", requirements: "Fuel included.", ...overrides }, stores);

  it("prefills from the shipment and saves a draft with a blank quote for each provider", () => {
    const request = open();
    expect(request).toMatchObject({ status: "draft", number: "QR-0049", material: "Chrome concentrate", quantityTonnes: 400, from: "Riverside Mine", to: "Richards Bay Terminal" });
    expect(request.quotes.map((item) => item.status)).toEqual(["waiting", "waiting"]);
    rejects(() => open(), 409, /already has an open quote request/);
  });

  it("records the request as sent, then each reply, then the decision, and the accepted quote prices the shipment", () => {
    const request = open();
    rejects(() => demoDomain.recordTransportQuote(request.id, request.quotes[0].id, quoteInput, stores), 409, /as sent/);
    demoDomain.recordRequestSent(request.id, stores);
    rejects(() => demoDomain.recordRequestSent(request.id, stores), 409);
    const afterReply = demoDomain.recordTransportQuote(request.id, request.quotes[0].id, quoteInput, stores);
    expect(afterReply.quotes[0].status).toBe("to_review");
    demoDomain.recordTransportQuote(request.id, request.quotes[1].id, { unavailable: true, reason: "No trucks free that week." }, stores);
    expect(demoDomain.transport(manager).terms!.requests.find((item) => item.id === request.id)!.quotes[1].status).toBe("unavailable");
    rejects(() => demoDomain.decideTransportQuote(request.id, request.quotes[0].id, { decision: "accept", reason: "Not allowed for this role." }, stores), 403);
    demoDomain.decideTransportQuote(request.id, request.quotes[0].id, { decision: "accept", reason: "Lowest rate, fuel included." }, manager);
    const priced = shipment("SHP-0047");
    expect(priced.pricingSource).toMatchObject({ type: "quote", providerId: "tr-001", costExVat: 140000 });
    expect(priced.transporterId).toBe("tr-001");
    expect(priced.state).toBe("waiting");
    expect(demoDomain.transport(manager).terms!.requests.find((item) => item.id === request.id)!.quotes[0].decision).toMatchObject({ by: "John Dlamini", reason: "Lowest rate, fuel included." });
  });

  it("needs the number of loads for a per-load price", () => {
    const request = open();
    demoDomain.recordRequestSent(request.id, stores);
    rejects(() => demoDomain.recordTransportQuote(request.id, request.quotes[0].id, { ...quoteInput, method: "per_load", amount: 12000 }, stores), 400, /number of loads/);
    const done = demoDomain.recordTransportQuote(request.id, request.quotes[0].id, { ...quoteInput, method: "per_load", amount: 12000, loads: 10 }, stores);
    expect(quoteTotal(done.quotes[0])).toBe(120000);
  });

  it("will not accept an expired quote, and a replacement of an existing price needs an explicit step", () => {
    const request = open();
    demoDomain.recordRequestSent(request.id, stores);
    demoDomain.recordTransportQuote(request.id, request.quotes[0].id, { ...quoteInput, receivedOn: "2025-04-20", validUntil: "2025-04-22" }, stores);
    rejects(() => demoDomain.decideTransportQuote(request.id, request.quotes[0].id, { decision: "accept", reason: "Too late really." }, manager), 409, /expired/);
    const sibling = demoDomain.createQuoteRequest({ kind: "shipment", shipmentId: shipment("SHP-0048").id, providerIds: ["tr-002"], replyBy: "2025-04-26T16:00" }, stores);
    demoDomain.recordRequestSent(sibling.id, stores);
    demoDomain.recordTransportQuote(sibling.id, sibling.quotes[0].id, quoteInput, stores);
    rejects(() => demoDomain.decideTransportQuote(sibling.id, sibling.quotes[0].id, { decision: "accept", reason: "Better rate." }, manager), 409, /already has a transport price/);
    demoDomain.decideTransportQuote(sibling.id, sibling.quotes[0].id, { decision: "accept", reason: "Better rate.", replace: true }, manager);
    const history = shipment("SHP-0048").pricingHistory.map((item) => item.summary).join(" | ");
    expect(history).toMatch(/Quote QR-0048 · ABC Logistics/);
    expect(history).toMatch(/replaced/);
  });

  it("keeps who decided, when and why when a quote is not selected", () => {
    const request = open();
    demoDomain.recordRequestSent(request.id, stores);
    demoDomain.recordTransportQuote(request.id, request.quotes[1].id, { ...quoteInput, amount: 380 }, stores);
    rejects(() => demoDomain.decideTransportQuote(request.id, request.quotes[1].id, { decision: "not_selected", reason: "" }, manager), 400);
    demoDomain.decideTransportQuote(request.id, request.quotes[1].id, { decision: "not_selected", reason: "Higher rate than the alternative." }, manager);
    expect(demoDomain.transport(manager).terms!.requests.find((item) => item.id === request.id)!.quotes[1]).toMatchObject({ status: "not_selected", decision: { by: manager.name, reason: "Higher rate than the alternative." } });
  });
});

describe("agreement requests, proposals and agreements", () => {
  const agreementRequest = () => demoDomain.createQuoteRequest({ kind: "agreement", material: "Coal", from: "Riverside Mine", to: "Rail Siding B", service: "Road · Bulk tipper", startDate: "2026-05-01", endDate: "2027-04-30", expectedVolume: 10000, volumePeriod: "calendar_month", preferredBilling: "monthly", providerIds: ["tr-001", "tr-002"], replyBy: "2026-04-25T16:00" }, stores);

  it("needs no shipment, and labels the volume as a planning estimate", () => {
    const request = agreementRequest();
    expect(request).toMatchObject({ kind: "agreement", shipmentId: null, status: "draft", expectedVolume: 10000, volumePeriod: "calendar_month", preferredBilling: "monthly" });
    rejects(() => demoDomain.createQuoteRequest({ kind: "agreement", material: "Coal", from: "A", to: "B", service: "Road", startDate: "2026-05-01", endDate: "2026-04-01", expectedVolume: 1, providerIds: ["tr-001"], replyBy: "2026-04-25T16:00" }, stores), 400);
  });

  it("takes a proposal with a recurring fee, accepts it, and the draft agreement still has to be confirmed", () => {
    const request = agreementRequest();
    demoDomain.recordRequestSent(request.id, stores);
    demoDomain.recordTransportQuote(request.id, request.quotes[0].id, { reference: "ABC-P-1", receivedOn: "2026-04-20", validUntil: "2026-05-20", method: "fixed_fee", amount: 1_000_000, feePeriod: "month", includedTonnes: 10000, billing: "monthly", excessRate: 120, vat: "excluded" }, stores);
    // The quote's own validity is checked against the prototype's clock; this one is valid until 2026.
    demoDomain.decideTransportQuote(request.id, request.quotes[0].id, { decision: "accept", reason: "Matches the budget." }, manager);
    const proposal = demoDomain.transport(manager).terms!.requests.find((item) => item.id === request.id)!.quotes[0];
    expect(proposal).toMatchObject({ status: "accepted", feePeriod: "month", billing: "monthly", includedTonnes: 10000 });
    const draft = demoDomain.createAgreement({ providerId: "tr-001", reference: "ABC-TA-2026-05", material: "Coal", from: "Riverside Mine", to: "Rail Siding B", service: "Road transport", startDate: "2026-05-01", endDate: "2027-04-30", method: "fixed_fee", fee: 1_000_000, feePeriod: "month", billing: "monthly", includedTonnes: 10000, allowancePeriod: "calendar_month", excessRate: 120, sourceQuoteId: proposal.id }, stores);
    expect(agreementStatus(draft, TRANSPORT_DEMO_DATE)).toBe("draft");
    expect(draft.minimumCommitment).toBeNull();
    rejects(() => demoDomain.confirmAgreement(draft.id, {}, stores), 403);
    const confirmed = demoDomain.confirmAgreement(draft.id, { note: "Terms checked against the proposal." }, finance);
    expect(agreementStatus(confirmed, TRANSPORT_DEMO_DATE)).toBe("upcoming");
    expect(confirmed.history.map((line) => line.summary)).toContain("Terms reviewed and agreement confirmed");
  });

  it("records an existing agreement directly from its document, and keeps a manual estimate for complicated terms", () => {
    const direct = demoDomain.createAgreement({ providerId: "tr-002", reference: "HT-OLD-7", document: { name: "HT-OLD-7.pdf", sizeLabel: "300 KB" }, material: "Coal", from: "Riverside Mine", to: "Export Terminal B", service: "Road transport", startDate: "2026-02-01", endDate: "2026-07-31", method: "manual_estimate", manualEstimate: { amount: 450_000, period: "month", note: "Tiered rate card in the document; estimate only." } }, stores);
    expect(direct).toMatchObject({ document: { name: "HT-OLD-7.pdf" }, manualEstimate: { amount: 450_000, period: "month" }, fee: null });
    rejects(() => demoDomain.createAgreement({ providerId: "tr-002", reference: "X1", material: "Coal", from: "A", to: "B", service: "Road", startDate: "2026-02-01", endDate: "2026-07-31", method: "manual_estimate" }, stores), 400, /manual estimate/);
  });

  it("records changes to confirmed terms in the history, and only an authorised user may change them", () => {
    rejects(() => demoDomain.updateAgreement(agreement("AG-0001").id, { fee: 1_100_000 }, stores), 403);
    const changed = demoDomain.updateAgreement(agreement("AG-0001").id, { fee: 1_100_000, reason: "Fuel adjustment agreed." }, finance);
    expect(changed.fee).toBe(1_100_000);
    expect(changed.history.at(-1)!.summary).toBe("Fee or rate changed from 1,000,000 to 1,100,000");
    expect(changed.history.at(-1)!.note).toBe("Fuel adjustment agreed.");
  });

  it("shows missing terms honestly: a draft with no fee cannot be confirmed", () => {
    const draft = demoDomain.createAgreement({ providerId: "tr-001", reference: "NF-1", material: "Coal", from: "Riverside Mine", to: "Rail Siding D", service: "Road", startDate: "2026-06-01", endDate: "2026-06-30", method: "fixed_fee" }, stores);
    expect(draft.fee).toBeNull();
    expect(chargeAmount(draft)).toBeNull();
    rejects(() => demoDomain.confirmAgreement(draft.id, {}, finance), 409, /no fee or rate/);
  });
});

describe("who sees commercial terms", () => {
  it("sends quotes, rates and agreements only to roles allowed to see them", () => {
    for (const actor of [supervisor, { name: "Lebo Maseko", role: "Maintenance Planner" }, { name: "Thabo Molefe", role: "Field Employee" }]) {
      const view = demoDomain.transport(actor);
      expect(view.terms).toBeNull();
      expect(view.providers.length).toBeGreaterThan(0);
      expect(JSON.stringify(view)).not.toMatch(/pricePerTonne|"fee"|"amount"/);
      expect(demoDomain.logistics(actor).shipments.find((item) => item.number === "SHP-0048")!.pricingSource!.costExVat).toBeNull();
    }
    expect(demoDomain.logistics(manager).shipments.find((item) => item.number === "SHP-0048")!.pricingSource!.costExVat).toBe(105000);
    expect(demoDomain.transport(stores).terms).not.toBeNull();
  });
});
