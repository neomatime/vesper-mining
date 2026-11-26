// @vitest-environment node

/**
 * Unit tests (Vitest). Trade: the commercial records are consistent, prices stay with the roles allowed to see them, quantities stay
 * distinct (dispatched and received come from Mining Operations; Trade records acceptance), proof of delivery never fulfils anything,
 * invoices are raised on accepted tonnes once, approvals cannot be self-approved and change their record only when approved.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { tradeDomain } from "./trade-store";
import { workspaceOf, workspacesFor } from "./workspaces";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const finance: Actor = { name: "Zinhle Mahlangu", role: "Commercial / Finance Officer" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
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

const view = (actor: Actor = manager) => tradeDomain.view(actor);
const deliveryFor = (shipmentId: string) => view().deliveries.find((item) => item.shipmentId === shipmentId)!;

beforeEach(() => {
  demoDomain.reset();
  tradeDomain.reset();
});

describe("workspaces", () => {
  it("reads the workspace from the address and offers Trade only to commercial roles", () => {
    expect(workspaceOf("/trade/overview")).toBe("trade");
    expect(workspaceOf("/trade")).toBe("trade");
    expect(workspaceOf("/overview")).toBe("operations");
    expect(workspaceOf("/trades")).toBe("operations");
    expect(workspacesFor("Mine Manager").map((item) => item.key)).toEqual(["operations", "trade"]);
    expect(workspacesFor("Stores / Inventory Controller").map((item) => item.key)).toEqual(["operations", "trade"]);
    expect(workspacesFor("Shift Supervisor").map((item) => item.key)).toEqual(["operations"]);
  });
});

describe("the starting records", () => {
  it("are internally consistent", () => {
    const data = view();
    const numbers = (items: { number: string }[]) => new Set(items.map((item) => item.number)).size === items.length;
    expect(numbers(data.deliveries) && numbers(data.settlements) && numbers(data.agreements) && numbers(data.enquiries) && numbers(data.approvals)).toBe(true);
    for (const delivery of data.deliveries) {
      const agreement = data.agreements.find((item) => item.id === delivery.agreementId)!;
      expect(agreement.commitments.some((item) => item.id === delivery.commitmentId)).toBe(true);
      expect(delivery.quantities.accepted).toBeLessThanOrEqual(delivery.quantities.received);
      expect(delivery.quantities.received).toBeLessThanOrEqual(delivery.quantities.dispatched);
    }
    // Every invoice is for exactly the accepted tonnes of its deliveries, at the agreement's price.
    for (const settlement of data.settlements) {
      const accepted = settlement.deliveryIds.reduce((total, id) => total + (data.deliveries.find((item) => item.id === id)!.acceptance?.tonnes ?? 0), 0);
      expect(settlement.tonnes).toBe(accepted);
      expect(settlement.amount).toBe(accepted * data.agreements.find((item) => item.id === settlement.agreementId)!.pricePerTonne!);
    }
    expect(new Set(data.settlements.map((item) => item.status))).toEqual(new Set(["settled", "pending", "overdue", "partial", "disputed"]));
  });

  it("reads dispatched and received tonnes from the Mining Operations shipments, and keeps acceptance separate", () => {
    const shipped = deliveryFor("ship-45");
    expect(shipped.quantities).toMatchObject({ planned: 600, dispatched: 600, received: 600, accepted: 0 });
    expect(shipped.stage).toBe("received");
    expect(deliveryFor("ship-44").stage).toBe("accepted");
    expect(deliveryFor("ship-47").stage).toBe("planned");
    expect(deliveryFor("ship-43").stage).toBe("cancelled");
  });
});

describe("access and pricing", () => {
  it("refuses roles outside Trade", () => {
    rejects(() => tradeDomain.createClient({ name: "Test Buyer", email: "a@b.example", segment: "Industrial user", city: "Pretoria", accountOwner: "Amina Patel" }, supervisor), 403);
  });

  it("shows prices, values, balances and confidential documents only to pricing roles", () => {
    const priced = view(finance);
    const hidden = view(stores);
    expect(priced.agreements[0].pricePerTonne).not.toBeNull();
    expect(hidden.agreements.every((item) => item.pricePerTonne === null && item.contractValue === null && item.outstanding === null)).toBe(true);
    expect(hidden.settlements.every((item) => item.amount === null && item.balance === null && item.payments.length === 0)).toBe(true);
    expect(hidden.enquiries.every((item) => item.pricePerTonne === null)).toBe(true);
    expect(hidden.approvals.every((item) => item.value === null)).toBe(true);
    expect(hidden.documents.some((item) => item.confidential)).toBe(false);
    expect(hidden.hiddenDocuments).toBeGreaterThan(0);
    expect(hidden.can.pricing).toBe(false);
  });
});

describe("deliveries", () => {
  it("cannot accept what has not been received, nor more than was received", () => {
    rejects(() => tradeDomain.recordAcceptance(deliveryFor("ship-47").id, { tonnes: 400 }, finance), 409, /Nothing has been received/);
    const received = deliveryFor("ship-45");
    rejects(() => tradeDomain.recordAcceptance(received.id, { tonnes: 650 }, finance), 400, /cannot be more than/);
    rejects(() => tradeDomain.recordAcceptance(received.id, { tonnes: 580 }, finance), 400, /Say why/);
    rejects(() => tradeDomain.recordAcceptance(received.id, { tonnes: 600 }, stores), 403);
    tradeDomain.recordAcceptance(received.id, { tonnes: 580, note: "20 t above moisture limit." }, finance);
    const after = deliveryFor("ship-45");
    expect(after.quantities).toMatchObject({ dispatched: 600, received: 600, accepted: 580 });
    expect(after.stage).toBe("disputed");
  });

  it("does not mark anything fulfilled when proof of delivery is uploaded", () => {
    const delivery = deliveryFor("ship-45");
    const before = view().agreements.find((item) => item.id === delivery.agreementId)!;
    tradeDomain.uploadDocument({ name: "POD-SHP-0045-signed.pdf", sizeBytes: 300_000, folder: "deliveries", kind: "Proof of delivery", reference: delivery.number }, stores);
    const after = view();
    expect(after.deliveries.find((item) => item.id === delivery.id)!.stage).toBe("received");
    expect(after.deliveries.find((item) => item.id === delivery.id)!.documents.map((item) => item.name)).toContain("POD-SHP-0045-signed.pdf");
    expect(after.agreements.find((item) => item.id === delivery.agreementId)!.accepted).toBe(before.accepted);
    // And completion needs every commitment accepted in full.
    rejects(() => tradeDomain.setAgreementStatus(delivery.agreementId, { status: "completed" }, finance), 409, /not been accepted in full/);
  });

  it("refuses planning beyond the commitment, in the past, or twice on one shipment", () => {
    const agreement = view().agreements.find((item) => item.number === "AGR-0047")!;
    const may = agreement.commitments.find((item) => item.dueDate === "2025-05-31")!;
    rejects(() => tradeDomain.createDelivery({ agreementId: agreement.id, commitmentId: may.id, tonnes: 2500, scheduledDate: "2025-05-10" }, stores), 409, /Amend the agreement/);
    rejects(() => tradeDomain.createDelivery({ agreementId: agreement.id, commitmentId: may.id, tonnes: 500, scheduledDate: "2025-04-01" }, stores), 400, /past/);
    rejects(() => tradeDomain.createDelivery({ agreementId: agreement.id, commitmentId: may.id, tonnes: 500, scheduledDate: "2025-05-10", shipmentId: "ship-46" }, stores), 409, /already carries/);
    const made = tradeDomain.createDelivery({ agreementId: agreement.id, commitmentId: may.id, tonnes: 500, scheduledDate: "2025-05-10" }, stores);
    expect(made.number).toMatch(/^DEL-/);
  });
});

describe("settlements", () => {
  it("invoices accepted tonnes once, and records payments up to the balance", () => {
    const accepted = deliveryFor("ship-44");
    rejects(() => tradeDomain.createInvoice({ agreementId: accepted.agreementId, deliveryIds: [deliveryFor("ship-45").id] }, finance), 409, /accepted tonnes only/);
    const invoice = tradeDomain.createInvoice({ agreementId: accepted.agreementId, deliveryIds: [accepted.id] }, finance);
    expect(invoice).toMatchObject({ tonnes: 450, amount: 450 * 3150 });
    rejects(() => tradeDomain.createInvoice({ agreementId: accepted.agreementId, deliveryIds: [accepted.id] }, finance), 409, /already on an invoice/);
    rejects(() => tradeDomain.recordPayment(invoice.id, { amount: invoice.amount! + 1, reference: "EFT-1" }, finance), 400, /more than/);
    tradeDomain.recordPayment(invoice.id, { amount: 500_000, reference: "EFT-1" }, finance);
    expect(view().settlements.find((item) => item.id === invoice.id)!.status).toBe("partial");
    rejects(() => tradeDomain.recordPayment(invoice.id, { amount: 10, reference: "eft-1" }, finance), 409, /already recorded/);
    tradeDomain.recordPayment(invoice.id, { amount: invoice.amount! - 500_000, reference: "EFT-2" }, finance);
    expect(view().settlements.find((item) => item.id === invoice.id)!.status).toBe("settled");
  });
});

describe("approvals", () => {
  it("cannot be decided by the person who asked, and need a reason to reject", () => {
    const pending = view().approvals.find((item) => item.number === "APP-0101")!;
    rejects(() => tradeDomain.decideApproval(pending.id, { decision: "approved" }, finance), 403);
    rejects(() => tradeDomain.decideApproval(pending.id, { decision: "rejected" }, manager), 400, /Say why/);
    tradeDomain.decideApproval(pending.id, { decision: "approved" }, manager);
    expect(view().agreements.find((item) => item.number === "AGR-0049")!.status).toBe("active");
    rejects(() => tradeDomain.decideApproval(pending.id, { decision: "approved" }, manager), 403, /already been decided/);
  });

  it("applies an amendment only when it is approved", () => {
    const before = view().agreements.find((item) => item.number === "AGR-0046")!.commitments.length;
    const amendment = view().approvals.find((item) => item.number === "APP-0103")!;
    tradeDomain.decideApproval(amendment.id, { decision: "approved" }, manager);
    expect(view().agreements.find((item) => item.number === "AGR-0046")!.commitments.length).toBe(before + 1);
  });

  it("sends a quotation for approval before it reaches the buyer", () => {
    const enquiry = view().enquiries.find((item) => item.number === "ENQ-0101")!;
    tradeDomain.advanceEnquiry(enquiry.id, { stage: "qualified" }, finance);
    const quoted = tradeDomain.advanceEnquiry(enquiry.id, { stage: "quotation_sent", pricePerTonne: 3150 }, finance);
    expect(quoted.stage).toBe("qualified");
    const approval = view().approvals.find((item) => item.subjectId === enquiry.id && item.status === "pending")!;
    expect(approval.approverRole).toBe("Commercial / Finance Officer");
    tradeDomain.decideApproval(approval.id, { decision: "approved" }, manager);
    expect(view().enquiries.find((item) => item.id === enquiry.id)!.stage).toBe("quotation_sent");
  });
});

describe("no duplicates", () => {
  it("refuses a duplicate client, an open duplicate enquiry and a second agreement from one enquiry", () => {
    rejects(() => tradeDomain.createClient({ name: "bayside metals", email: "x@y.example", segment: "Industrial user", city: "Germiston", accountOwner: "Zinhle Mahlangu" }, finance), 409);
    rejects(() => tradeDomain.createEnquiry({ clientId: "cl-02", commodity: "Chrome concentrate", tonnes: 3000, deliveryWindow: "Q3 2025" }, finance), 409, /ENQ-0104/);
    rejects(() => tradeDomain.createAgreement({ clientId: "cl-10", enquiryId: "enq-100", commodity: "Coal", title: "Again", startDate: "2025-06-01", endDate: "2025-12-31", pricePerTonne: 1200, incoterm: "FCA Riverside Mine", commitments: [{ label: "Jun", tonnes: 500, dueDate: "2025-06-30", deliveryPoint: "Loading bay" }] }, finance), 409, /already has an agreement/);
  });
});

describe("linked operations", () => {
  it("reads readiness from Mining Operations without changing it", () => {
    const links = view().links;
    const crusher = links.find((item) => item.number === "LOP-016")!;
    expect(crusher.area.name).toBe("Crusher Line C-02");
    expect(crusher.shipments.map((item) => item.number)).toEqual(["SHP-0044", "SHP-0045", "SHP-0046", "SHP-0047"]);
    expect(crusher.dispatched).toBe(1050);
    expect(crusher.readiness).toBe("at_risk");
    const shipmentsBefore = JSON.stringify(demoDomain.get().shipments);
    tradeDomain.createLink({ agreementId: "ag-44", commitmentId: crusher.commitmentId.replace("ag-47", "ag-44"), areaId: "area-central-pit", workstream: "Test" }, stores);
    expect(JSON.stringify(demoDomain.get().shipments)).toBe(shipmentsBefore);
  });
});
