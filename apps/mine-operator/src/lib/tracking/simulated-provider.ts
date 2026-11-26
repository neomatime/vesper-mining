/**
 * The simulated telematics provider: the only provider registered until a real integration is approved. It works out where each
 * vehicle in fleet.ts would be at a given moment from its departure time, speed, stops and route, and reports it the way a real
 * provider would (position, time of reading, speed, heading, journey status). It runs in the browser and calls nothing outside VESPER.
 */
import { vehicleLoads, type VehicleLoad } from "./fleet";
import { along, placeForDestination, routeLengthKm, routes } from "./network";
import type { LatLng, TelematicsProvider, VehiclePosition } from "./telematics";

/** How old a reading is for a vehicle whose feed has a gap. */
export const GAP_MINUTES = 35;

/** Minutes spent moving between departure and `at`, after taking out stops. */
function movingMinutes(load: VehicleLoad, at: number) {
  const departed = Date.parse(load.departedAt);
  if (at <= departed) return 0;
  let minutes = (at - departed) / 60_000;
  for (const stop of load.stops) {
    const start = Date.parse(stop.at);
    const end = start + stop.minutes * 60_000;
    const overlap = Math.max(0, Math.min(at, end) - Math.max(departed, start));
    minutes -= overlap / 60_000;
  }
  return Math.max(0, minutes);
}

export function routeFor(destination: string): LatLng[] | null {
  const place = placeForDestination(destination);
  return place ? routes[place.id]?.points ?? null : null;
}

/** Where a vehicle is at a moment, given its route. */
export function simulate(load: VehicleLoad, route: LatLng[], atIso: string) {
  const at = Date.parse(atIso);
  const length = routeLengthKm(route);
  const km = Math.min(length, (movingMinutes(load, at) * load.cruiseKph) / 60);
  const point = along(route, km);
  const stopped = load.stops.some((stop) => at >= Date.parse(stop.at) && at < Date.parse(stop.at) + stop.minutes * 60_000);
  const arrived = km >= length - 0.05;
  const departed = at > Date.parse(load.departedAt);
  return {
    position: point.position,
    headingDeg: point.headingDeg,
    km,
    lengthKm: length,
    journeyStatus: !departed ? null : arrived ? ("arrived" as const) : stopped ? ("stopped" as const) : ("en_route" as const),
    // Small, repeatable variation so the speed reading looks like a real one.
    speedKph: !departed || arrived || stopped ? 0 : Math.round(load.cruiseKph + 6 * Math.sin(at / 600_000)),
  };
}

export function createSimulatedProvider(destinationOf: (deliveryId: string) => string | null): TelematicsProvider {
  return {
    id: "simulated",
    name: "Simulated fleet tracking",
    async positions(vehicleIds, atIso) {
      const readings: VehiclePosition[] = [];
      for (const load of vehicleLoads.filter((item) => vehicleIds.includes(item.vehicleId))) {
        if (load.feed === "none") continue;
        const destination = destinationOf(load.deliveryId);
        const route = destination ? routeFor(destination) : null;
        if (!route) continue;
        const recordedAt = load.feed === "gap" ? new Date(Date.parse(atIso) - GAP_MINUTES * 60_000).toISOString() : atIso;
        const state = simulate(load, route, recordedAt);
        readings.push({ vehicleId: load.vehicleId, position: state.position, recordedAt, speedKph: state.speedKph, headingDeg: state.headingDeg, journeyStatus: state.journeyStatus, etaAt: null });
      }
      return readings;
    },
  };
}
