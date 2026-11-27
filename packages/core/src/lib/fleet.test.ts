// @vitest-environment node

/**
 * Unit tests (Vitest). Transport handled by our own fleet: vehicles from the equipment register, drivers, a coordinator, several
 * loads, availability and maintenance checks, the same readiness, dispatch and delivery steps as a provider shipment, vehicle
 * breakdowns linked to loads, and the optional internal cost estimate. Fictional data.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";
import { assignedTonnes, fleetProblems } from "./fleet-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const supervisor: Actor = { name: "Amina Patel", role: "Shift Supervisor" };
const stores: Actor = { name: "Naledi Khoza", role: "Stores / Inventory Controller" };
const planner: Actor = { name: "Lebo Maseko", role: "Maintenance Planner" };
const allChecks = { quality: true, instructions: true, documents: true, loading: true };

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

const logistics = (actor: Actor = manager) => demoDomain.logistics(actor);
const find = (number: string, actor: Actor = manager) => logistics(actor).shipments.find((item) => item.number === number)!;
const load = (vehicleId: string, driverName: string, tonnes: number, from = "08:00", to = "14:00", day = "2026-04-28") => ({ vehicleId, driverName, tonnes, plannedCollectionAt: `${day}T${from}`, plannedDeliveryAt: `${day}T${to}` });

function fleetShipment(tonnes = 300, orderRef = "PO-F-1") {
  return demoDomain.createShipment({ stockpileId: "sp-01", tonnes, orderRef, destination: "Richards Bay Terminal", preferredDate: "2026-04-28", transportMode: "own_fleet" }, manager);
}

beforeEach(() => demoDomain.reset());

describe("choosing who handles the transport", () => {
  it("creates an own-fleet shipment that needs no provider, quote or agreement", () => {
    const made = fleetShipment();
    expect(made).toMatchObject({ transportMode: "own_fleet", transporterId: "own-fleet", pricingSource: null, state: "preparing" });
    expect(made.fleet).toEqual({ coordinator: null, loads: [], internalCost: null });
  });

  it("keeps a provider shipment on the provider workflow", () => {
    const made = demoDomain.createShipment({ stockpileId: "sp-01", tonnes: 100, orderRef: "PO-P-1", destination: "Richards Bay Terminal", preferredDate: "2026-04-28", transporterId: "tr-001" }, manager);
    expect(made).toMatchObject({ transportMode: "provider", transporterId: "tr-001" });
    rejects(() => demoDomain.addFleetLoad(made.id, load("eq-ht101", "Thabo Molefe", 100), manager), 409, /logistics provider/);
  });

  it("switches before the transport is arranged; a pricing source needs a reason and stays in the history", () => {
    const made = demoDomain.createShipment({ stockpileId: "sp-01", tonnes: 100, orderRef: "PO-P-2", destination: "Richards Bay Terminal", preferredDate: "2026-04-28", transporterId: "tr-001" }, manager);
    demoDomain.setTransportMode(made.id, { mode: "own_fleet" }, manager);
    expect(find(made.number)).toMatchObject({ transportMode: "own_fleet", transporterId: "own-fleet" });
    const priced = find("SHP-0048");
    rejects(() => demoDomain.setTransportMode(priced.id, { mode: "own_fleet" }, manager), 400, /Say why/);
    demoDomain.setTransportMode(priced.id, { mode: "own_fleet", reason: "Using our own trucks this time." }, manager);
    const after = find("SHP-0048");
    expect(after.pricingSource).toBeNull();
    expect(after.pricingHistory.at(-1)!.summary).toMatch(/Pricing source removed/);
    rejects(() => demoDomain.setTransportMode(find("SHP-0047").id, { mode: "own_fleet" }, manager), 409, /before it is arranged/);
  });
});

describe("assigning vehicles and drivers", () => {
  it("offers vehicles from the equipment register with their availability and maintenance status", () => {
    const { vehicles, drivers, coordinators } = logistics().fleet;
    const by = (code: string) => vehicles.find((item) => item.code === code)!;
    expect(by("HT-101")).toMatchObject({ assignable: true, state: "available" });
    expect(by("HT-102")).toMatchObject({ assignable: false, maintenance: "overdue" });
    expect(by("HT-103")).toMatchObject({ assignable: false, state: "unavailable" });
    expect(vehicles.some((item) => item.code === "C-02")).toBe(false);
    expect(drivers).toContain("Thabo Molefe");
    expect(coordinators).toContain("John Dlamini");
  });

  it("refuses an unavailable vehicle and one overdue for service, with the reason", () => {
    const made = fleetShipment();
    rejects(() => demoDomain.addFleetLoad(made.id, load("eq-ht103", "Thabo Molefe", 100), manager), 409, /HT-103 cannot take a load: unavailable/);
    rejects(() => demoDomain.addFleetLoad(made.id, load("eq-ht102", "Thabo Molefe", 100), manager), 409, /overdue/);
    rejects(() => demoDomain.addFleetLoad(made.id, load("eq-crusher-c02", "Thabo Molefe", 100), manager), 400, /equipment register/);
    rejects(() => demoDomain.addFleetLoad(made.id, load("eq-ht101", "Nobody Here", 100), manager), 400, /driver/);
  });

  it("supports several loads on one shipment and never more than the shipment holds", () => {
    const made = fleetShipment(300);
    demoDomain.addFleetLoad(made.id, load("eq-ht101", "Thabo Molefe", 200), manager);
    rejects(() => demoDomain.addFleetLoad(made.id, load("eq-ht101", "Amina Patel", 150, "15:00", "18:00"), manager), 409, /Only 100 t/);
    demoDomain.addFleetLoad(made.id, load("eq-ht101", "Amina Patel", 100, "15:00", "18:00"), manager);
    const after = find(made.number);
    expect(after.fleet.loads).toHaveLength(2);
    expect(assignedTonnes(after)).toBe(300);
  });

  it("will not double-book a vehicle or a driver in the same time", () => {
    const first = fleetShipment(100, "PO-F-A");
    const second = fleetShipment(100, "PO-F-B");
    demoDomain.addFleetLoad(first.id, load("eq-ht101", "Thabo Molefe", 100), manager);
    rejects(() => demoDomain.addFleetLoad(second.id, load("eq-ht101", "Amina Patel", 100, "10:00", "12:00"), manager), 409, /HT-101 is already planned/);
    rejects(() => demoDomain.addFleetLoad(second.id, load("eq-ht101", "Thabo Molefe", 100, "09:00", "11:00"), manager), 409, /already planned/);
    // A different time on the same day is fine.
    demoDomain.addFleetLoad(second.id, load("eq-ht101", "Thabo Molefe", 100, "15:00", "18:00"), manager);
  });
});

describe("one complete example: vehicle and driver to a confirmed delivery", () => {
  it("assigning a vehicle does not make it ready or dispatched; each step is still its own", () => {
    const made = fleetShipment(300);
    demoDomain.addFleetLoad(made.id, load("eq-ht101", "Thabo Molefe", 300), manager);
    const assigned = find(made.number);
    expect(assigned).toMatchObject({ state: "preparing", requestId: null });
    expect(assigned.dispatches).toHaveLength(0);
    rejects(() => demoDomain.markShipmentReady(made.id, {}, manager), 409, /Tick/);
    demoDomain.updateShipment(made.id, { checks: allChecks }, manager);
    rejects(() => demoDomain.markShipmentReady(made.id, {}, manager), 409, /responsible/);
    demoDomain.updateFleetPlan(made.id, { coordinator: "Naledi Khoza" }, manager);
    expect(fleetProblems(find(made.number), logistics().fleet.vehicles)).toEqual([]);

    const { request } = demoDomain.markShipmentReady(made.id, {}, manager);
    expect(request).toMatchObject({ transporterId: "own-fleet", state: "sent" });
    expect(find(made.number).state).toBe("waiting");
    rejects(() => demoDomain.recordDispatch(made.id, { tonnes: 300 }, stores), 409, /schedule has been confirmed/);

    demoDomain.confirmFleetSchedule(made.id, {}, stores);
    expect(find(made.number).state).toBe("confirmed");
    expect(logistics().requests.find((item) => item.id === request.id)).toMatchObject({ state: "confirmed", collectionAt: "2026-04-28T08:00:00+02:00" });

    demoDomain.recordDispatch(made.id, { tonnes: 300 }, stores);
    expect(find(made.number).state).toBe("dispatched");
    demoDomain.recordDelivery(made.id, { tonnes: 300, evidence: "DN-F1.pdf" }, stores);
    const done = find(made.number);
    expect(done.state).toBe("delivered");
    expect(done.events.map((item) => item.type)).toEqual(expect.arrayContaining(["created", "fleet_changed", "request_sent", "confirmed", "dispatched", "delivered"]));
  });

  it("is not ready while part of the quantity has no vehicle", () => {
    const made = fleetShipment(300);
    demoDomain.addFleetLoad(made.id, load("eq-ht101", "Thabo Molefe", 100), manager);
    demoDomain.updateShipment(made.id, { checks: allChecks }, manager);
    demoDomain.updateFleetPlan(made.id, { coordinator: "John Dlamini" }, manager);
    rejects(() => demoDomain.markShipmentReady(made.id, {}, manager), 409, /remaining 200 t/);
  });
});

describe("vehicle breakdowns", () => {
  function confirmedFleetShipment() {
    const made = fleetShipment(300, "PO-F-BD");
    demoDomain.addFleetLoad(made.id, load("eq-ht101", "Thabo Molefe", 300), manager);
    demoDomain.updateShipment(made.id, { checks: allChecks }, manager);
    demoDomain.updateFleetPlan(made.id, { coordinator: "Naledi Khoza" }, manager);
    demoDomain.markShipmentReady(made.id, {}, manager);
    demoDomain.confirmFleetSchedule(made.id, {}, manager);
    return made;
  }

  it("links a vehicle that breaks down to its load, with who is responsible and the next action", () => {
    const made = confirmedFleetShipment();
    expect(logistics().fleet.alerts[made.id]).toBeUndefined();
    demoDomain.setEquipmentState("eq-ht101", { state: "unavailable", note: "Brake fault found at the gate." }, planner);
    const alerts = logistics().fleet.alerts[made.id];
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ vehicleCode: "HT-101", responsible: "Naledi Khoza" });
    expect(alerts[0].reason).toMatch(/HT-101 is unavailable/);
    expect(alerts[0].nextAction).toMatch(/Reassign/);
    rejects(() => demoDomain.recordDispatch(made.id, { tonnes: 300 }, stores), 409, /Reassign the load/);
  });

  it("lets the load be reassigned, which asks for the schedule to be confirmed again", () => {
    const made = confirmedFleetShipment();
    demoDomain.setEquipmentState("eq-ht101", { state: "unavailable", note: "Brake fault found at the gate." }, planner);
    const bad = find(made.number).fleet.loads[0];
    demoDomain.removeFleetLoad(made.id, bad.id, { reason: "Vehicle broke down." }, manager);
    expect(find(made.number)).toMatchObject({ state: "preparing", requestId: null });
    expect(logistics().requests.find((item) => item.shipmentId === made.id)!.state).toBe("cancelled");
    // The other trucks are unavailable or overdue for service: say so rather than pretending.
    rejects(() => demoDomain.addFleetLoad(made.id, load("eq-ht102", "Thabo Molefe", 300), manager), 409, /overdue/);
    demoDomain.setEquipmentState("eq-ht101", { state: "available" }, planner);
    demoDomain.addFleetLoad(made.id, load("eq-ht101", "Amina Patel", 300, "09:00", "15:00"), manager);
    expect(fleetProblems(find(made.number), logistics().fleet.vehicles)).toEqual([]);
  });
});

describe("internal transport cost", () => {
  it("shows no cost until one is entered, keeps it apart from pricing, and hides it from roles without commercial access", () => {
    const made = fleetShipment();
    expect(find(made.number).fleet.internalCost).toBeNull();
    demoDomain.updateFleetPlan(made.id, { internalCostAmount: 18500, internalCostNote: "Fuel, driver time and tyre wear for two trips." }, manager);
    expect(find(made.number).fleet.internalCost).toEqual({ amount: 18500, note: "Fuel, driver time and tyre wear for two trips." });
    expect(find(made.number).pricingSource).toBeNull();
    expect(find(made.number, supervisor).fleet.internalCost).toEqual({ amount: 0, note: "" });
    expect(logistics(supervisor).fleet.canSeeCost).toBe(false);
    expect(logistics(manager).fleet.canSeeCost).toBe(true);
    demoDomain.updateFleetPlan(made.id, { internalCostAmount: "" }, manager);
    expect(find(made.number).fleet.internalCost).toBeNull();
    rejects(() => demoDomain.updateFleetPlan(made.id, { internalCostAmount: -5 }, manager), 400);
  });
});
