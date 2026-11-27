// @vitest-environment node

/**
 * Unit tests (Vitest). Delivery tracking: routes and distances, positions from any provider projected onto the route, one delivery
 * with several vehicles, statuses from ETA against the planned arrival, and live, stale and unavailable readings kept apart.
 */
import { describe, expect, it } from "vitest";
import { loadsFor, vehicleLoads } from "./fleet";
import { routeLengthKm, routes } from "./network";
import { readPositions, telematicsRegistry } from "./providers";
import { GAP_MINUTES } from "./simulated-provider";
import { freshnessOf } from "./telematics";
import { deliveryTrackingStatus, journeyPath, kmAlong, trackJourneys, type TrackedDelivery } from "./tracking";

const NOW = "2025-04-24T08:47:00+02:00";
const deliveries: TrackedDelivery[] = [
  { id: "ag-41-q2-1", number: "DEL-0285", agreementNumber: "AGR-0041", clientName: "Global Alloy Traders", commodity: "Chrome lumpy ore", tonnes: 1800, destination: "Durban Bulk Terminal" },
  { id: "ag-46-apr-1", number: "DEL-0279", agreementNumber: "AGR-0046", clientName: "Horizon Metals", commodity: "Chrome lumpy ore", tonnes: 800, destination: "Horizon Metals, Middelburg" },
  { id: "ag-45-apr-2", number: "DEL-0281", agreementNumber: "AGR-0045", clientName: "Highveld Power Co-op", commodity: "Coal", tonnes: 1500, destination: "Highveld Power coal yard, Secunda" },
];
const routeOf = (id: string) => { const delivery = deliveries.find((item) => item.id === id); return delivery ? journeyPath(delivery)?.route ?? null : null; };

async function journeysAt(now: string) {
  const readings = await readPositions(vehicleLoads.map((item) => item.vehicleId), now, telematicsRegistry(routeOf));
  return trackJourneys(deliveries, readings, now);
}

describe("routes", () => {
  it("are plausible road distances", () => {
    expect(routeLengthKm(routes.middelburg_works.points)).toBeGreaterThan(110);
    expect(routeLengthKm(routes.middelburg_works.points)).toBeLessThan(200);
    expect(routeLengthKm(routes.durban_terminal.points)).toBeGreaterThan(650);
    expect(routeLengthKm(routes.durban_terminal.points)).toBeLessThan(1000);
  });

  it("place any provider's coordinates on the route", () => {
    const route = routes.secunda_yard.points;
    expect(kmAlong(route, route[0])).toBeCloseTo(0, 5);
    expect(kmAlong(route, route[route.length - 1])).toBeCloseTo(routeLengthKm(route), 1);
  });
});

describe("vehicles on the morning of 24 April", () => {
  it("carry each delivery in several loads", async () => {
    const journeys = await journeysAt(NOW);
    expect(loadsFor("ag-41-q2-1")).toHaveLength(3);
    const durban = journeys.filter((item) => item.delivery.id === "ag-41-q2-1");
    expect(durban.map((item) => item.loadNumber)).toEqual([1, 2, 3]);
    expect(durban.every((item) => item.loadCount === 3 && item.loadTonnes === 34)).toBe(true);
  });

  it("report on track, at risk, delayed and unavailable from the ETA, never from guesswork", async () => {
    const journeys = await journeysAt(NOW);
    const of = (registration: string) => journeys.find((item) => item.registration === registration)!;
    expect(of("ND 418-206").status).toBe("on_track");
    expect(of("HXT 482 MP").status).toBe("at_risk");
    expect(of("MTS 102 GP")).toMatchObject({ status: "delayed", moving: "stopped", speedKph: 0 });
    expect(of("BRV 556 GP")).toMatchObject({ status: "unavailable", estimated: true, freshness: "unavailable", lastUpdateAt: null });
    expect(deliveryTrackingStatus(journeys.filter((item) => item.delivery.id === "ag-45-apr-2"))).toBe("delayed");
  });

  it("keeps a stale reading apart from a live one", async () => {
    const journeys = await journeysAt(NOW);
    const stale = journeys.find((item) => item.registration === "ND 418-211")!;
    expect(stale.freshness).toBe("stale");
    expect((Date.parse(NOW) - Date.parse(stale.lastUpdateAt!)) / 60_000).toBe(GAP_MINUTES);
    expect(freshnessOf(NOW, NOW)).toBe("live");
  });

  it("move vehicles forward as time passes, and stop them at the destination", async () => {
    const early = (await journeysAt(NOW)).find((item) => item.registration === "ND 418-219")!;
    const later = (await journeysAt("2025-04-24T10:47:00+02:00")).find((item) => item.registration === "ND 418-219")!;
    expect(later.progress).toBeGreaterThan(early.progress);
    expect(later.remainingKm).toBeLessThan(early.remainingKm);
    const arrived = (await journeysAt("2025-04-25T08:00:00+02:00")).find((item) => item.registration === "HXT 482 MP")!;
    expect(arrived).toMatchObject({ status: "arrived", moving: "arrived" });
    expect(arrived.remainingKm).toBeCloseTo(0, 1);
  });
});

describe("stored plans", () => {
  it("follow the delivery's own exact points and route instead of the known road network", async () => {
    const own: [number, number][] = [[-24.66, 30.06], [-25.2, 29.9], [-25.77, 29.47]];
    const planned: TrackedDelivery = { ...deliveries[1], plan: { origin: { name: "Riverside Mine loading bay", position: own[0] }, destination: { name: "Horizon Metals gate 3", position: own[2] }, route: own } };
    const path = journeyPath(planned)!;
    expect(path.route).toEqual(own);
    expect(path.destination.name).toBe("Horizon Metals gate 3");
    const readings = await readPositions(loadsFor(planned.id).map((item) => item.vehicleId), NOW, telematicsRegistry(() => own));
    const journeys = trackJourneys([planned], readings, NOW);
    expect(journeys).toHaveLength(3);
    expect(journeys.every((item) => item.route === own && item.destination.name === "Horizon Metals gate 3")).toBe(true);
  });
});
