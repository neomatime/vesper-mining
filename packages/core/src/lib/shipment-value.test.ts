// @vitest-environment node

/**
 * Unit tests (Vitest). Sales value on shipments: how a value and its status are worked out, that totals never double count, that
 * a changed price keeps the original estimate, and that money is only ever sent to the roles allowed to see it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { QUANTITY_BASIS, currentPrice, delayReason, formatMoney, shipmentValue, valueSummary } from "./shipment-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const finance: Actor = { name: "Zinhle Mahlangu", role: "Commercial / Finance Officer" };

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

const data = (actor?: Actor) => demoDomain.logistics(actor);
const ship = (number: string, actor: Actor = finance) => data(actor).shipments.find((item) => item.number === number)!;
const historyOf = (number: string) => data(finance).commercial!.history.filter((item) => item.shipmentId === ship(number).id);
const valueOf = (number: string, actor: Actor = finance) => {
  const view = data(actor);
  const shipment = view.shipments.find((item) => item.number === number)!;
  const commercial = view.commercial!;
  return shipmentValue(shipment, currentPrice(commercial.prices, shipment.orderRef), commercial.finance?.find((item) => item.shipmentId === shipment.id) ?? null);
};

beforeEach(() => demoDomain.reset());

describe("working out a shipment's value", () => {
  it("estimates a planned shipment from its price and planned tonnes", () => {
    expect(valueOf("SHP-0046")).toMatchObject({ status: "estimated", amount: 925000, quantity: 500 });
    expect(valueOf("SHP-0047")).toMatchObject({ status: "estimated", amount: 740000 });
  });

  it("shows Not priced when there is no price, and never guesses one", () => {
    expect(valueOf("SHP-0048")).toMatchObject({ status: "not_priced", amount: null });
  });

  it("is provisional once everything has left, and final once finance has settled it", () => {
    expect(valueOf("SHP-0045")).toMatchObject({ status: "provisional", amount: 1110000 });
    expect(valueOf("SHP-0044")).toMatchObject({ status: "final", amount: 832500 });
  });

  it("refuses a price on a different quantity basis, so price and quantity always agree", () => {
    const shipment = { kind: "sale" as const, tonnes: 100, dispatches: [], deliveries: [], state: "preparing" as const };
    const price = { ...currentPrice(data(finance).commercial!.prices, "PO-2046")!, quantityBasis: "Dry tonnes at the plant" };
    expect(price.quantityBasis).not.toBe(QUANTITY_BASIS);
    expect(shipmentValue(shipment, price, null)).toMatchObject({ status: "not_priced", amount: null });
  });

  it("gives an internal transfer no sales value", () => {
    const transfer = demoDomain.createShipment({ kind: "internal_transfer", stockpileId: "sp-01", tonnes: 100, orderRef: "TR-0001", destination: "Plant stockpile", preferredDate: "2025-04-28", transporterId: "tr-001" }, manager);
    expect(valueOf(transfer.number)).toMatchObject({ status: "not_applicable", amount: null });
    expect(historyOf(transfer.number)).toHaveLength(0);
  });

  it("formats money the same way everywhere", () => {
    expect(formatMoney(925000)).toBe("R 925,000");
  });
});

describe("delay and the two totals", () => {
  const now = demoDomain.now();
  const summary = () => {
    const view = data(finance);
    const commercial = view.commercial!;
    return valueSummary(
      view.shipments,
      (shipment) => shipmentValue(shipment, currentPrice(commercial.prices, shipment.orderRef), commercial.finance?.find((item) => item.shipmentId === shipment.id) ?? null),
      (shipment) => view.requests.find((item) => item.id === shipment.requestId) ?? null,
      view.now,
    );
  };

  it("calls a shipment late when its date is reached without a confirmed collection, or the transporter declined", () => {
    expect(delayReason({ state: "waiting", preferredDate: "2025-04-24" }, null, "2025-04-24T08:47:00+02:00")).toMatch(/collection date/);
    expect(delayReason({ state: "waiting", preferredDate: "2025-04-26" }, null, "2025-04-24T08:47:00+02:00")).toBeNull();
    expect(delayReason({ state: "declined", preferredDate: "2025-04-30" }, null, now)).toMatch(/declined/);
    expect(delayReason({ state: "confirmed", preferredDate: "2025-04-24" }, { collectionAt: "2025-04-24T06:00:00+02:00" }, "2025-04-24T08:47:00+02:00")).toMatch(/has passed/);
  });

  it("counts each shipment once: awaiting collection (on time) and delayed never overlap", () => {
    expect(summary()).toEqual({ awaiting: { amount: 925000, count: 1 }, delayed: { amount: 740000, count: 1 }, notPriced: 0 });
  });

  it("leaves a not-priced shipment out of both totals and counts it separately", () => {
    // Make SHP-0048 late and unpriced: it is asked for, then its date is reached.
    const shipment = ship("SHP-0048");
    demoDomain.updateShipment(shipment.id, { preferredDate: "2025-04-24", version: shipment.version }, manager);
    expect(summary()).toMatchObject({ awaiting: { amount: 925000 }, delayed: { amount: 740000, count: 1 }, notPriced: 1 });
  });
});

describe("prices and the traceable history", () => {
  it("keeps the original estimate when a price changes", () => {
    expect(historyOf("SHP-0046").map((item) => item.amount)).toEqual([900000, 925000]);
    demoDomain.setPrice({ reference: "PO-2046", pricePerTonne: 1900, source: "Contract CT-2025-014, price list 3" }, finance);
    const history = historyOf("SHP-0046");
    expect(history.map((item) => item.amount)).toEqual([900000, 925000, 950000]);
    expect(history[0]).toMatchObject({ reason: "created", status: "estimated" });
    expect(history[2]).toMatchObject({ reason: "price_changed", actor: finance.name });
    expect(data(finance).commercial!.prices.filter((item) => item.reference === "PO-2046")).toHaveLength(3);
    expect(currentPrice(data(finance).commercial!.prices, "PO-2046")).toMatchObject({ pricePerTonne: 1900, version: 3, supersedesId: "price-46-2" });
  });

  it("prices an unpriced order without losing the fact that it was not priced", () => {
    demoDomain.setPrice({ reference: "PO-2048", pricePerTonne: 1850, source: "Contract CT-2025-014, price list 2" }, finance);
    const history = historyOf("SHP-0048");
    expect(history.map((item) => item.status)).toEqual(["not_priced", "estimated"]);
    expect(history[1]).toMatchObject({ reason: "priced", amount: 555000 });
  });

  it("does not reopen a value finance has already settled", () => {
    const before = historyOf("SHP-0044").length;
    demoDomain.setPrice({ reference: "PO-2044", pricePerTonne: 2000, source: "A later price list" }, finance);
    expect(historyOf("SHP-0044")).toHaveLength(before);
    expect(valueOf("SHP-0044")).toMatchObject({ status: "final", amount: 832500 });
  });

  it("records the value when a shipment has fully left the mine", () => {
    const shipment = ship("SHP-0046");
    demoDomain.recordDispatch(shipment.id, { tonnes: 200 }, stores);
    expect(historyOf("SHP-0046")).toHaveLength(2);
    demoDomain.recordDispatch(shipment.id, { tonnes: 300 }, stores);
    expect(historyOf("SHP-0046").at(-1)).toMatchObject({ reason: "dispatched", status: "provisional", amount: 925000, quantityTonnes: 500 });
  });

  it("only lets the Commercial / Finance Officer supply prices", () => {
    rejects(() => demoDomain.setPrice({ reference: "PO-2048", pricePerTonne: 1850, source: "Contract" }, manager), 403, /Commercial \/ Finance Officer/);
    rejects(() => demoDomain.setPrice({ reference: "PO-2048", pricePerTonne: 0, source: "Contract" }, finance), 400);
    rejects(() => demoDomain.setPrice({ reference: "PO-2046", pricePerTonne: 1850, source: "Contract" }, finance), 409, /already priced/);
  });
});

describe("money is restricted by role", () => {
  it("sends no price, value or finance record to people who may not see money", () => {
    for (const actor of [undefined, stores, supervisor]) {
      const view = data(actor);
      expect(view.commercial).toBeNull();
      expect(JSON.stringify(view)).not.toMatch(/pricePerTonne|finalValue|cashReceived|revenueRecognised|transportCost/);
    }
  });

  it("shows the Mine Manager and finance the values, and only finance may change prices", () => {
    expect(data(manager).commercial).toMatchObject({ canSetPrices: false });
    expect(data(manager).commercial!.finance).not.toBeNull();
    expect(data(finance).commercial).toMatchObject({ canSetPrices: true });
  });

  it("keeps money out of what a transporter sees", () => {
    const shipment = ship("SHP-0047");
    const request = data(finance).requests.find((item) => item.shipmentId === shipment.id)!;
    const view = demoDomain.transportView(request.token);
    expect(JSON.stringify(view)).not.toMatch(/price|value|cost|revenue|cash|R \d/i);
  });
});
