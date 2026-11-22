// @vitest-environment node

/**
 * Unit tests (Vitest). The domain store: production, mineral inventory, shipments, collection requests, dispatch and delivery.
 * They walk the agreed workflow and the blocked, repeated and failing cases around it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { shipmentFigures } from "./shipment-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const amina: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };

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

const position = (code: string) => demoDomain.logistics().stockpiles.find((item) => item.code === code)!;
const shipmentNumber = (number: string) => demoDomain.logistics().shipments.find((item) => item.number === number)!;

const production = { shiftId: "shift-a-20250424", mineral: "Manganese", area: "Pit3", reportedTonnes: 700, basis: "estimate", stockpileId: "sp-02", note: "", submit: true };
const newShipment = { stockpileId: "sp-01", tonnes: 300, orderRef: "PO-2049", destination: "Richards Bay Terminal", preferredDate: "2025-04-27", transporterId: "tr-001" };
const allChecks = { quality: true, instructions: true, documents: true, loading: true };

/** A new shipment taken as far as a confirmed collection. */
function confirmedShipment(tonnes = 300, orderRef = "PO-2049") {
  const shipment = demoDomain.createShipment({ ...newShipment, tonnes, orderRef }, manager);
  demoDomain.updateShipment(shipment.id, { checks: allChecks }, manager);
  const { request } = demoDomain.markShipmentReady(shipment.id, {}, manager);
  demoDomain.transporterRespond(request.token, { answer: "confirm", date: "2025-04-27", time: "08:00" });
  return shipment.id;
}

beforeEach(() => demoDomain.reset());

describe("the opening position", () => {
  it("starts with 2,000 t at the mine, 1,200 t reserved and 800 t available, as the screens show", () => {
    const sp1 = position("SP-01");
    expect({ onHand: sp1.onHand, reserved: sp1.reserved, available: sp1.available }).toEqual({ onHand: 2000, reserved: 1200, available: 800 });
    expect(position("SP-02")).toMatchObject({ onHand: 0, available: 0, condition: "needs_processing" });
  });
});

describe("recording and checking production", () => {
  it("keeps a reported amount out of stock until it has been checked", () => {
    const record = demoDomain.recordProduction(production, amina);
    expect(record).toMatchObject({ state: "needs_checking", number: "PR-0149", reportedTonnes: 700 });
    expect(position("SP-02").onHand).toBe(0);
  });

  it("lets a supervisor save a draft, then send it", () => {
    const draft = demoDomain.recordProduction({ ...production, submit: false }, amina);
    expect(draft.state).toBe("draft");
    const sent = demoDomain.updateProduction(draft.id, { ...production, submit: true, version: draft.version }, amina);
    expect(sent.state).toBe("needs_checking");
  });

  it("refuses a repeated submission instead of recording the same amount twice", () => {
    demoDomain.recordProduction({ ...production, submissionId: "form-1" }, amina);
    rejects(() => demoDomain.recordProduction({ ...production, submissionId: "form-1" }, amina), 409, /already saved/);
    rejects(() => demoDomain.recordProduction({ ...production, submissionId: "form-2" }, amina), 409, /already has these figures/);
  });

  it("only lets a supervisor or manager record production", () => {
    rejects(() => demoDomain.recordProduction(production, stores), 403);
  });

  it("confirms the amount into the chosen stockpile, keeping the reported amount and the reason for a difference", () => {
    const record = demoDomain.logistics().production.find((item) => item.number === "PR-0148")!;
    const checked = demoDomain.checkProduction(record.id, { confirmedTonnes: 1060, basis: "weighbridge", record: "WB-0148.pdf", reason: "Scale measurement replaced the shift estimate.", stockpileId: "sp-02" }, stores);
    expect(checked).toMatchObject({ state: "checked", reportedTonnes: 1080 });
    expect(checked.check).toMatchObject({ confirmedTonnes: 1060, checkedBy: stores.name });
    expect(position("SP-02")).toMatchObject({ onHand: 1060, available: 0 });
    // Material that needs processing is stored but never becomes available to ship.
    expect(position("SP-01").available).toBe(800);
  });

  it("asks for a reason when the confirmed amount differs, and for the record", () => {
    const record = demoDomain.logistics().production.find((item) => item.number === "PR-0148")!;
    rejects(() => demoDomain.checkProduction(record.id, { confirmedTonnes: 1060, basis: "weighbridge", record: "WB-0148.pdf", stockpileId: "sp-02" }, stores), 400, /Record the reason/);
    rejects(() => demoDomain.checkProduction(record.id, { confirmedTonnes: 1080, basis: "weighbridge", record: "", stockpileId: "sp-02" }, stores), 400);
  });

  it("is checked by someone other than the person who reported it, and only once", () => {
    const record = demoDomain.logistics().production.find((item) => item.number === "PR-0148")!;
    rejects(() => demoDomain.checkProduction(record.id, { confirmedTonnes: 1080, basis: "estimate", record: "x.pdf", stockpileId: "sp-02" }, amina), 403);
    rejects(() => demoDomain.checkProduction(record.id, { confirmedTonnes: 1080, basis: "estimate", record: "x.pdf", stockpileId: "sp-02" }, planner), 403);
    demoDomain.checkProduction(record.id, { confirmedTonnes: 1080, basis: "weighbridge", record: "WB.pdf", stockpileId: "sp-02" }, stores);
    rejects(() => demoDomain.checkProduction(record.id, { confirmedTonnes: 1080, basis: "weighbridge", record: "WB.pdf", stockpileId: "sp-02" }, stores), 409, /already been checked/);
    expect(position("SP-02").onHand).toBe(1080);
  });

  it("can be sent back with a reason, corrected and sent again", () => {
    const record = demoDomain.logistics().production.find((item) => item.number === "PR-0148")!;
    const back = demoDomain.sendBackProduction(record.id, { reason: "The amount looks too high for the loads." }, stores);
    expect(back).toMatchObject({ state: "sent_back", sentBackReason: "The amount looks too high for the loads." });
    const again = demoDomain.updateProduction(record.id, { ...production, reportedTonnes: 1000, submit: true, version: back.version }, amina);
    expect(again).toMatchObject({ state: "needs_checking", reportedTonnes: 1000, sentBackReason: null });
  });
});

describe("creating a shipment", () => {
  it("reserves the stock and shows what is left", () => {
    const shipment = demoDomain.createShipment(newShipment, manager);
    expect(shipment).toMatchObject({ number: "SHP-0049", state: "preparing" });
    expect(position("SP-01")).toMatchObject({ onHand: 2000, reserved: 1500, available: 500 });
  });

  it("refuses more than is available, and the same stock twice", () => {
    rejects(() => demoDomain.createShipment({ ...newShipment, tonnes: 801 }, manager), 409, /Only 800 t is available/);
    demoDomain.createShipment({ ...newShipment, tonnes: 800 }, manager);
    rejects(() => demoDomain.createShipment({ ...newShipment, tonnes: 1, orderRef: "PO-3000" }, manager), 409, /Nothing is available/);
  });

  it("never reserves material that needs processing", () => {
    rejects(() => demoDomain.createShipment({ ...newShipment, stockpileId: "sp-02" }, manager), 409, /needs processing/);
  });

  it("refuses a repeated submission and a reused order reference", () => {
    demoDomain.createShipment({ ...newShipment, submissionId: "s-1" }, manager);
    rejects(() => demoDomain.createShipment({ ...newShipment, submissionId: "s-1", orderRef: "PO-3001" }, manager), 409, /already saved/);
    rejects(() => demoDomain.createShipment({ ...newShipment, orderRef: "po-2049", tonnes: 50 }, manager), 409, /already used/);
  });

  it("lets a form that failed validation be corrected and sent again with the same submission id", () => {
    rejects(() => demoDomain.createShipment({ ...newShipment, orderRef: "", submissionId: "retry-1" }, manager), 400);
    const shipment = demoDomain.createShipment({ ...newShipment, submissionId: "retry-1" }, manager);
    expect(shipment.number).toBe("SHP-0049");
    rejects(() => demoDomain.createShipment({ ...newShipment, orderRef: "PO-4000", tonnes: 10, submissionId: "retry-1" }, manager), 409, /already saved/);
  });

  it("is for the Inventory Controller and the Mine Manager", () => {
    rejects(() => demoDomain.createShipment(newShipment, amina), 403);
  });
});

describe("readiness and the collection request", () => {
  it("creates exactly one linked request, which is a request and not a booking", () => {
    const shipment = demoDomain.createShipment(newShipment, manager);
    demoDomain.updateShipment(shipment.id, { checks: allChecks }, manager);
    const { shipment: ready, request } = demoDomain.markShipmentReady(shipment.id, {}, manager);
    expect(ready.state).toBe("waiting");
    expect(request).toMatchObject({ number: "LR-0098", state: "sent", shipmentId: shipment.id, simulated: true, collectionAt: null });
    expect(demoDomain.logistics().requests.filter((item) => item.shipmentId === shipment.id)).toHaveLength(1);
    rejects(() => demoDomain.markShipmentReady(shipment.id, {}, manager), 409, /already been recorded/);
    expect(demoDomain.logistics().requests.filter((item) => item.shipmentId === shipment.id)).toHaveLength(1);
  });

  it("will not go until every check is ticked", () => {
    const shipment = demoDomain.createShipment(newShipment, manager);
    demoDomain.updateShipment(shipment.id, { checks: { ...allChecks, loading: false } }, manager);
    rejects(() => demoDomain.markShipmentReady(shipment.id, {}, manager), 409, /Loading arrangements confirmed/);
  });

  it("is confirmed only by the transporter's reply, which updates the request and the shipment", () => {
    const shipment = demoDomain.createShipment(newShipment, manager);
    demoDomain.updateShipment(shipment.id, { checks: allChecks }, manager);
    const { request } = demoDomain.markShipmentReady(shipment.id, {}, manager);
    expect(demoDomain.transportView(request.token)).toMatchObject({ open: true, transporterName: "ABC Logistics" });
    demoDomain.transporterRespond(request.token, { answer: "confirm", date: "2025-04-27", time: "08:00", note: "Truck booked." });
    expect(shipmentNumber("SHP-0049").state).toBe("confirmed");
    expect(demoDomain.logistics().requests.find((item) => item.id === request.id)).toMatchObject({ state: "confirmed", collectionAt: "2025-04-27T08:00:00+02:00" });
    rejects(() => demoDomain.transporterRespond(request.token, { answer: "decline", note: "Changed my mind" }), 409, /already been answered/);
  });

  it("returns a declined shipment to preparation, and allows another request", () => {
    const shipment = demoDomain.createShipment(newShipment, manager);
    demoDomain.updateShipment(shipment.id, { checks: allChecks }, manager);
    const { request } = demoDomain.markShipmentReady(shipment.id, {}, manager);
    demoDomain.transporterRespond(request.token, { answer: "decline", note: "No trucks available that day." });
    expect(shipmentNumber("SHP-0049").state).toBe("declined");
    const again = demoDomain.markShipmentReady(shipment.id, {}, manager);
    expect(again.request.number).toBe("LR-0099");
  });

  it("refuses a collection time in the past, and a reminder once the transporter has replied", () => {
    const shipment = demoDomain.createShipment(newShipment, manager);
    demoDomain.updateShipment(shipment.id, { checks: allChecks }, manager);
    const { request } = demoDomain.markShipmentReady(shipment.id, {}, manager);
    rejects(() => demoDomain.transporterRespond(request.token, { answer: "confirm", date: "2025-04-23", time: "08:00" }), 400, /in the past/);
    expect(demoDomain.sendReminder(request.id, manager).reminders).toBe(1);
    demoDomain.transporterRespond(request.token, { answer: "confirm", date: "2025-04-27", time: "08:00" });
    rejects(() => demoDomain.sendReminder(request.id, manager), 409);
  });
});

describe("dispatch and delivery", () => {
  it("does not let a shipment be dispatched before the collection is confirmed", () => {
    const shipment = demoDomain.createShipment(newShipment, manager);
    rejects(() => demoDomain.recordDispatch(shipment.id, { tonnes: 100 }, stores), 409, /confirmed collection/);
  });

  it("supports a partial dispatch: the shipment is not fully dispatched when the first load leaves", () => {
    const id = confirmedShipment(300);
    const part = demoDomain.recordDispatch(id, { tonnes: 120, reference: "Load 1" }, stores);
    expect(part.state).toBe("dispatched");
    expect(shipmentFigures(part)).toMatchObject({ dispatched: 120, remaining: 180, inTransit: 120 });
    expect(position("SP-01")).toMatchObject({ onHand: 1880, reserved: 1380 });
    rejects(() => demoDomain.recordDispatch(id, { tonnes: 181 }, stores), 409, /Only 180 t/);
    const rest = demoDomain.recordDispatch(id, { tonnes: 180 }, stores);
    expect(shipmentFigures(rest).remaining).toBe(0);
    expect(position("SP-01")).toMatchObject({ onHand: 1700, reserved: 1200, available: 500 });
  });

  it("reconciles delivery against dispatch and keeps a difference visible until it is reviewed", () => {
    const id = confirmedShipment(300);
    demoDomain.recordDispatch(id, { tonnes: 300 }, stores);
    rejects(() => demoDomain.recordDelivery(id, { tonnes: 290, evidence: "DN-1.pdf" }, stores), 400, /Record the reason/);
    const delivered = demoDomain.recordDelivery(id, { tonnes: 290, evidence: "DN-1.pdf", reason: "Spillage on the road." }, stores);
    expect(delivered.state).toBe("delivered");
    expect(shipmentFigures(delivered)).toMatchObject({ received: 290, dispatched: 300 });
    expect(shipmentFigures(delivered).unreviewed).toHaveLength(1);
    const reviewed = demoDomain.reviewDifference(id, delivered.deliveries[0].id, manager);
    expect(shipmentFigures(reviewed).unreviewed).toHaveLength(0);
  });

  it("accepts a partial delivery without finishing the shipment", () => {
    const id = confirmedShipment(300);
    demoDomain.recordDispatch(id, { tonnes: 300 }, stores);
    const first = demoDomain.recordDelivery(id, { tonnes: 100, settles: 100, evidence: "DN-1.pdf" }, stores);
    expect(first.state).toBe("dispatched");
    const last = demoDomain.recordDelivery(id, { tonnes: 200, evidence: "DN-2.pdf" }, stores);
    expect(last.state).toBe("delivered");
  });

  it("refuses a repeated delivery submission", () => {
    const id = confirmedShipment(300);
    demoDomain.recordDispatch(id, { tonnes: 300 }, stores);
    demoDomain.recordDelivery(id, { tonnes: 300, evidence: "DN-1.pdf", submissionId: "d-1" }, stores);
    rejects(() => demoDomain.recordDelivery(id, { tonnes: 300, evidence: "DN-1.pdf", submissionId: "d-1" }, stores), 409);
  });
});

describe("cancelling a shipment", () => {
  it("releases the reservation when nothing has left the mine, and closes the open request", () => {
    const id = confirmedShipment(300);
    const before = position("SP-01").available;
    demoDomain.cancelShipment(id, { reason: "The customer postponed the order." }, manager);
    expect(position("SP-01").available).toBe(before + 300);
    expect(shipmentNumber("SHP-0049").state).toBe("cancelled");
  });

  it("is refused once part of the shipment has been dispatched", () => {
    const id = confirmedShipment(300);
    demoDomain.recordDispatch(id, { tonnes: 100 }, stores);
    rejects(() => demoDomain.cancelShipment(id, { reason: "Too late to cancel really." }, manager), 409, /already left the mine/);
  });
});

describe("shift closure and handover stay separate from receipt", () => {
  it("sends the handover on close but leaves it published until the next supervisor confirms receipt", () => {
    const shift = demoDomain.listShifts().find((item) => item.state === "in_progress")!;
    demoDomain.saveHandoverNotes(shift.id, "Loader LD-03 is parked for repair. Please follow up on the parts.", amina);
    demoDomain.publishHandover(shift.id, amina);
    const closed = demoDomain.closeShift(shift.id, amina);
    expect(closed.state).toBe("closed");
    expect(closed.handover.state).toBe("published");
    expect(closed.handover.acknowledgedAt).toBeNull();
  });
});
