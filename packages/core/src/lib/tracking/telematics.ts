/**
 * Vehicle tracking: the contract any fleet telematics provider is adapted to. VESPER does not track vehicles itself; it reads
 * positions that the logistics provider's own tracking system already records.
 *
 * To connect a real provider, write an adapter that implements TelematicsProvider (map its vehicle ids, coordinates, timestamps,
 * speed, heading, journey status and ETA onto VehiclePosition) and register it for that logistics provider in providers.ts. Until a
 * real integration is approved, the only registered provider is the simulated one (simulated-provider.ts), which runs in the
 * browser and talks to nothing outside VESPER.
 */

export type LatLng = [lat: number, lng: number];

/** One reading for one vehicle, as a provider supplies it. */
export type VehiclePosition = {
  vehicleId: string;
  position: LatLng;
  /** When the provider recorded this position (ISO). */
  recordedAt: string;
  speedKph: number | null;
  /** Degrees clockwise from north. */
  headingDeg: number | null;
  /** The provider's own view of the journey, if it supplies one. */
  journeyStatus: "en_route" | "stopped" | "arrived" | null;
  /** The provider's ETA at the destination, if it supplies one (ISO). VESPER works one out otherwise. */
  etaAt: string | null;
};

export interface TelematicsProvider {
  /** Stable id, for configuration. */
  id: string;
  /** Shown to people, for example "ABC Logistics fleet tracking". */
  name: string;
  /** Latest readings for these vehicles at the given moment. Vehicles the provider cannot see are simply left out. */
  positions(vehicleIds: string[], at: string): Promise<VehiclePosition[]>;
}

/** How fresh a vehicle's position is. Stale positions are still shown, marked as such; unavailable means no position at all. */
export type Freshness = "live" | "stale" | "unavailable";

export const STALE_AFTER_MINUTES = 15;

export function freshnessOf(recordedAt: string | null, now: string): Freshness {
  if (!recordedAt) return "unavailable";
  const ageMinutes = (Date.parse(now) - Date.parse(recordedAt)) / 60_000;
  return ageMinutes > STALE_AFTER_MINUTES ? "stale" : "live";
}

export const freshnessLabels: Record<Freshness, string> = { live: "Live", stale: "Stale position", unavailable: "Tracking unavailable" };
