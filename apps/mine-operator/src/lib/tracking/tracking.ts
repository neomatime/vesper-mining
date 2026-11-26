/**
 * Turns provider readings into what the delivery map shows: each vehicle journey's position, progress, remaining distance, ETA and
 * status, and each delivery's overall status. Provider-agnostic: it only reads VehiclePosition (telematics.ts), so a real provider
 * plugs in without changes here.
 *
 * Status compares VESPER's ETA with the planned arrival (departure plus the route at the planned average speed):
 * on track under 15 minutes late, at risk under 60, delayed beyond that. A vehicle with no tracking is "unavailable" and shown at an
 * estimated position, clearly marked. Tracking never changes a delivery: receipt and acceptance are recorded as before.
 */
import { loadsFor, type VehicleLoad } from "./fleet";
import { distanceKm, places, placeForDestination, routeLengthKm, routes, type Place } from "./network";
import { simulate } from "./simulated-provider";
import { freshnessOf, type Freshness, type LatLng, type VehiclePosition } from "./telematics";

import { PLANNED_KPH } from "../trade-rules";
export { PLANNED_KPH };
/** Remaining distance is estimated at the planned speed, so a vehicle keeping pace is on time. */
const ESTIMATE_KPH = PLANNED_KPH;
/** A stopped vehicle is assumed to need this long before it moves again, until the provider says otherwise. */
const STOP_ALLOWANCE_MIN = 45;

export const trackingStatusLabels = { on_track: "On track", at_risk: "At risk", delayed: "Delayed", unavailable: "Tracking unavailable", arrived: "Arrived" } as const;
export type TrackingStatus = keyof typeof trackingStatusLabels;

export type TrackedDelivery = {
  id: string;
  number: string;
  agreementNumber: string;
  clientName: string;
  commodity: string;
  tonnes: number;
  destination: string;
  /** The exact points and route from the delivery's plan. Without one, the destination text is matched to a known site. */
  plan?: { origin: { name: string; position: LatLng }; destination: { name: string; position: LatLng }; route: LatLng[] } | null;
};

/** The route, ends and length a delivery's vehicles follow: the stored plan first, otherwise the known road network. */
export function journeyPath(delivery: TrackedDelivery): { origin: Place; destination: Place; route: LatLng[] } | null {
  if (delivery.plan && delivery.plan.route.length >= 2) {
    return {
      origin: { id: `${delivery.id}-a`, name: delivery.plan.origin.name, position: delivery.plan.origin.position, kind: "mine" },
      destination: { id: `${delivery.id}-b`, name: delivery.plan.destination.name, position: delivery.plan.destination.position, kind: "destination" },
      route: delivery.plan.route,
    };
  }
  const destination = placeForDestination(delivery.destination);
  return destination ? { origin: places.riverside, destination, route: routes[destination.id].points } : null;
}

export type Journey = {
  vehicleId: string;
  registration: string;
  providerName: string;
  loadNumber: number;
  loadCount: number;
  loadTonnes: number;
  delivery: TrackedDelivery;
  origin: Place;
  destination: Place;
  route: LatLng[];
  routeKm: number;
  position: LatLng;
  /** True when the position is worked out from the departure time, because the vehicle sends no readings. */
  estimated: boolean;
  travelled: LatLng[];
  ahead: LatLng[];
  progress: number;
  remainingKm: number;
  etaAt: string;
  plannedArrivalAt: string;
  delayMinutes: number;
  status: TrackingStatus;
  freshness: Freshness;
  lastUpdateAt: string | null;
  speedKph: number | null;
  headingDeg: number | null;
  moving: "en_route" | "stopped" | "arrived" | "not_departed";
};

/** How far along the route a position is (the nearest point on the route), in km. Works for any provider's coordinates. */
export function kmAlong(route: LatLng[], position: LatLng) {
  let best = { distance: Infinity, km: 0 };
  let travelled = 0;
  for (let index = 1; index < route.length; index += 1) {
    const [a, b] = [route[index - 1], route[index]];
    const dx = b[1] - a[1];
    const dy = b[0] - a[0];
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((position[1] - a[1]) * dx + (position[0] - a[0]) * dy) / lengthSq));
    const point: LatLng = [a[0] + dy * t, a[1] + dx * t];
    const off = distanceKm(position, point);
    const segment = distanceKm(a, b);
    if (off < best.distance) best = { distance: off, km: travelled + segment * t };
    travelled += segment;
  }
  return best.km;
}

const addMinutes = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

function splitRoute(route: LatLng[], km: number) {
  const travelled: LatLng[] = [route[0]];
  let covered = 0;
  for (let index = 1; index < route.length; index += 1) {
    const segment = distanceKm(route[index - 1], route[index]);
    if (covered + segment >= km) {
      const share = segment === 0 ? 1 : (km - covered) / segment;
      const [a, b] = [route[index - 1], route[index]];
      const point: LatLng = [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
      return { travelled: [...travelled, point], ahead: [point, ...route.slice(index)] };
    }
    covered += segment;
    travelled.push(route[index]);
  }
  return { travelled: route, ahead: [route[route.length - 1]] };
}

export function trackJourneys(deliveries: TrackedDelivery[], readings: VehiclePosition[], now: string): Journey[] {
  const journeys: Journey[] = [];
  for (const delivery of deliveries) {
    const path = journeyPath(delivery);
    if (!path) continue;
    const routeKm = routeLengthKm(path.route);
    const loads = loadsFor(delivery.id);
    for (const load of loads) journeys.push(journeyOf(delivery, load, loads.length, path.origin, path.destination, path.route, routeKm, readings.find((item) => item.vehicleId === load.vehicleId) ?? null, now));
  }
  return journeys;
}

function journeyOf(delivery: TrackedDelivery, load: VehicleLoad, loadCount: number, origin: Place, destination: Place, route: LatLng[], routeKm: number, reading: VehiclePosition | null, now: string): Journey {
  const freshness = freshnessOf(reading?.recordedAt ?? null, now);
  const plannedArrivalAt = addMinutes(load.departedAt, (routeKm / PLANNED_KPH) * 60);
  let position: LatLng;
  let km: number;
  let moving: Journey["moving"];
  if (reading) {
    position = reading.position;
    km = Math.min(routeKm, kmAlong(route, reading.position));
    moving = reading.journeyStatus ?? (km >= routeKm - 0.05 ? "arrived" : "en_route");
  } else {
    // No readings: estimate from departure time at the planned speed, and say so.
    const estimate = simulate({ ...load, cruiseKph: PLANNED_KPH, stops: [] }, route, now);
    position = estimate.position;
    km = estimate.km;
    moving = estimate.journeyStatus ?? "not_departed";
  }
  if (Date.parse(now) < Date.parse(load.departedAt)) moving = "not_departed";
  const remainingKm = Math.max(0, routeKm - km);
  const from = reading && Date.parse(reading.recordedAt) > Date.parse(now) - 60 * 60_000 ? reading.recordedAt : now;
  const etaAt = moving === "arrived" ? (reading?.recordedAt ?? now)
    : reading?.etaAt ?? addMinutes(Date.parse(from) < Date.parse(now) ? now : from, (moving === "stopped" ? STOP_ALLOWANCE_MIN : 0) + (remainingKm / ESTIMATE_KPH) * 60);
  const delayMinutes = Math.round((Date.parse(etaAt) - Date.parse(plannedArrivalAt)) / 60_000);
  const status: TrackingStatus = !reading ? "unavailable" : moving === "arrived" ? "arrived" : delayMinutes < 15 ? "on_track" : delayMinutes < 60 ? "at_risk" : "delayed";
  const split = splitRoute(route, km);
  return {
    vehicleId: load.vehicleId,
    registration: load.registration,
    providerName: load.providerName,
    loadNumber: load.loadNumber,
    loadCount,
    loadTonnes: load.loadTonnes,
    delivery,
    origin,
    destination,
    route,
    routeKm,
    position,
    estimated: !reading,
    travelled: split.travelled,
    ahead: split.ahead,
    progress: routeKm > 0 ? km / routeKm : 0,
    remainingKm,
    etaAt,
    plannedArrivalAt,
    delayMinutes,
    status,
    freshness,
    lastUpdateAt: reading?.recordedAt ?? null,
    speedKph: reading?.speedKph ?? null,
    headingDeg: reading?.headingDeg ?? null,
    moving,
  };
}

const rank: Record<TrackingStatus, number> = { delayed: 4, at_risk: 3, on_track: 2, arrived: 1, unavailable: 0 };

/** A delivery's status on the map: its worst tracked vehicle. Only when no vehicle can be tracked is the delivery "unavailable". */
export function deliveryTrackingStatus(journeys: Journey[]): TrackingStatus {
  if (journeys.length === 0) return "unavailable";
  return journeys.reduce((worst, item) => (rank[item.status] > rank[worst] ? item.status : worst), journeys[0].status);
}
