/**
 * Unit tests (Vitest). Production, inventory and shipment rules: who may act, how balances come from the ledger, a shipment's
 * figures, and what stops it being marked ready.
 */
import type { StockMovement } from "@vesper/api-contracts";
import { describe, expect, it } from "vitest";
import { canActOnShipments, canCancel, formatTonnes, nextStepLabel, readinessProblems, shipmentFigures, shipmentStage, shortDate, stockPosition } from "./shipment-rules";

const move = (type: StockMovement["type"], tonnes: number, stockpileId = "sp-01"): StockMovement => ({ id: `${type}-${tonnes}`, at: "2025-04-24T08:00:00+02:00", type, stockpileId, tonnes, ref: "X", actor: "A", note: null });

describe("who may act", () => {
  it("lets supervisors record, controllers check and manage, and keeps the reporter from checking their own amount", () => {
    expect(canActOnShipments("record_production", { name: "A", role: "Shift Supervisor" }).allowed).toBe(true);
    expect(canActOnShipments("record_production", { name: "A", role: "Stores / Inventory Controller" }).allowed).toBe(false);
    expect(canActOnShipments("check_production", { name: "N", role: "Stores / Inventory Controller" }, "A").allowed).toBe(true);
    expect(canActOnShipments("check_production", { name: "J", role: "Mine Manager" }, "J").allowed).toBe(false);
    expect(canActOnShipments("manage_shipments", { name: "L", role: "Maintenance Planner" }).allowed).toBe(false);
  });
});

describe("stock position from the ledger", () => {
  const ready = { id: "sp-01", condition: "ready_for_shipment" as const };
  it("counts what is on hand, what is promised and what is left to promise", () => {
    const ledger = [move("opening", 2000), move("reserve", 1200), move("reserve", 300), move("release", 300), move("receipt", 100)];
    expect(stockPosition(ready, ledger)).toEqual({ onHand: 2100, reserved: 1200, available: 900 });
  });
  it("takes a dispatch off both the stock and the promise", () => {
    expect(stockPosition(ready, [move("opening", 1000), move("reserve", 400), move("dispatch", 150)])).toEqual({ onHand: 850, reserved: 250, available: 600 });
  });
  it("never makes material that needs processing available, however much is there", () => {
    expect(stockPosition({ id: "sp-02", condition: "needs_processing" }, [move("receipt", 1060, "sp-02")])).toEqual({ onHand: 1060, reserved: 0, available: 0 });
  });
  it("ignores other stockpiles", () => {
    expect(stockPosition(ready, [move("opening", 500, "sp-02")]).onHand).toBe(0);
  });
});

describe("a shipment's figures", () => {
  const base = { tonnes: 300, dispatches: [], deliveries: [] };
  it("tracks what is still at the mine, on its way and received", () => {
    const shipment = {
      tonnes: 300,
      dispatches: [{ id: "d1", at: "x", tonnes: 120, by: "N", reference: null }],
      deliveries: [{ id: "v1", at: "x", tonnes: 50, settles: 60, by: "N", evidence: "DN", reason: "Spillage", reviewed: false, reviewedBy: null }],
    };
    expect(shipmentFigures(shipment)).toMatchObject({ dispatched: 120, remaining: 180, inTransit: 60, received: 50 });
    expect(shipmentFigures(shipment).unreviewed).toHaveLength(1);
    expect(shipmentFigures(base)).toMatchObject({ dispatched: 0, remaining: 300, inTransit: 0 });
  });
});

describe("readiness, stages and words", () => {
  const checks = { quality: true, instructions: true, documents: true, loading: false };
  it("says in plain words what still stops a shipment going", () => {
    expect(readinessProblems({ checks, state: "preparing" }, { active: true })).toEqual(['Tick "Loading arrangements confirmed".']);
    expect(readinessProblems({ checks: { ...checks, loading: true }, state: "preparing" }, { active: false })).toEqual(["Choose an approved transporter."]);
    expect(readinessProblems({ checks: { ...checks, loading: true }, state: "preparing" }, { active: true })).toEqual([]);
  });
  it("places a shipment in one of four stages", () => {
    expect(["preparing", "declined", "waiting", "confirmed", "dispatched", "delivered"].map((state) => shipmentStage({ state: state as never }))).toEqual([0, 0, 1, 2, 3, 4]);
  });
  it("offers one next step for each state", () => {
    expect(nextStepLabel({ state: "preparing" })).toBe("Review checks");
    expect(nextStepLabel({ state: "waiting" })).toBe("View request");
    expect(nextStepLabel({ state: "dispatched" })).toBe("Record delivery");
  });
  it("lets a shipment be cancelled only before anything has left the mine", () => {
    expect(canCancel({ state: "confirmed", dispatches: [] })).toBe(true);
    expect(canCancel({ state: "dispatched", dispatches: [{ id: "d", at: "x", tonnes: 1, by: "N", reference: null }] })).toBe(false);
    expect(canCancel({ state: "delivered", dispatches: [] })).toBe(false);
  });
  it("formats tonnes and dates the way the screens show them", () => {
    expect(formatTonnes(1200)).toBe("1,200 t");
    expect(formatTonnes(1060.5)).toBe("1,060.5 t");
    expect(shortDate("2025-04-26")).toBe("26 Apr");
  });
});
