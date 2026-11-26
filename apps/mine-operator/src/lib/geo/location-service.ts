/**
 * Finding exact points and the route between them for delivery planning. Two providers sit behind one interface:
 *
 * - Google Maps (Places search, reverse geocoding and driving routes), used when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
 * - VESPER's own directory, used without a key or whenever Google cannot answer: saved locations, known sites and towns, a dropped
 *   pin or typed coordinates, and routes over VESPER's road network or a straight-line estimate, clearly labelled as such.
 *
 * Screens only call `locationService`; switching provider needs no screen change.
 */
import { areaLabels, townLabels } from "../tracking/basemap";
import { distanceKm, places, routeLengthKm, routes } from "../tracking/network";
import { PLANNED_KPH, straightKm, type DeliveryLocation, type DeliveryRoute, type LatLngPair, type SavedLocation } from "../trade-rules";
import { googleMaps } from "./google-maps";

export type PlaceSuggestion = {
  id: string;
  title: string;
  detail: string;
  provider: "google" | "directory";
  /** Directory and saved suggestions carry the full location; Google suggestions are resolved when picked. */
  location: DeliveryLocation | null;
};

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
/** Roads wind: a straight line times this is a fair first estimate of the road distance. */
const ROAD_FACTOR = 1.25;

// ---- VESPER's own directory ---------------------------------------------------------------------------------------------

type DirectoryEntry = { id: string; name: string; address: string; position: LatLngPair; kind: string };

const directory: DirectoryEntry[] = [
  ...Object.values(places).filter((place) => place.kind !== "town").map((place) => ({ id: `place-${place.id}`, name: place.name, address: place.kind === "mine" ? "Mine site, Steelpoort district, Limpopo" : "Customer site", position: place.position, kind: place.kind === "mine" ? "Mine" : "Customer site" })),
  ...townLabels.map((town) => ({ id: `town-${town.name}`, name: town.name, address: "Town centre", position: town.position, kind: "Town" })),
  ...Object.values(places).filter((place) => place.kind === "town" && !townLabels.some((town) => town.name === place.name)).map((place) => ({ id: `town-${place.id}`, name: place.name, address: "Town centre", position: place.position, kind: "Town" })),
];

const normalise = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function directorySearch(query: string, saved: SavedLocation[]): PlaceSuggestion[] {
  const words = normalise(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const matches = (text: string) => words.every((word) => normalise(text).includes(word));
  const fromSaved = saved.filter((item) => matches(`${item.name} ${item.address}`)).map((item) => ({ id: item.id, title: item.name, detail: `Saved · ${item.address || "No address"}`, provider: "directory" as const, location: { name: item.name, address: item.address, position: item.position, source: "saved" as const, placeId: item.placeId, savedLocationId: item.id } }));
  const fromDirectory = directory.filter((item) => matches(`${item.name} ${item.address}`) && !saved.some((own) => straightKm(own.position, item.position) < 0.05)).map((item) => ({ id: item.id, title: item.name, detail: `${item.kind} · ${item.address}`, provider: "directory" as const, location: { name: item.name, address: item.address, position: item.position, source: "directory" as const, placeId: null, savedLocationId: null } }));
  return [...fromSaved, ...fromDirectory].slice(0, 8);
}

/** The nearest known place, to describe a dropped pin or typed coordinates ("12 km north-east of Ermelo"). */
export function describePosition(position: LatLngPair): string {
  let nearest = { name: "", km: Infinity, to: position };
  for (const entry of [...directory, ...areaLabels.filter((area) => area.kind === "park").map((area) => ({ name: area.name, position: area.position }))]) {
    const km = straightKm(position, entry.position);
    if (km < nearest.km) nearest = { name: entry.name, km, to: entry.position };
  }
  if (!nearest.name || nearest.km > 150) return "Remote location";
  if (nearest.km < 1.5) return `At ${nearest.name}`;
  const dLat = position[0] - nearest.to[0];
  const dLng = position[1] - nearest.to[1];
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const compass = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(((angle + 360) % 360) / 45) % 8];
  return `${Math.round(nearest.km)} km ${compass} of ${nearest.name}`;
}

/** A route without Google: VESPER's road network when both ends are known sites on it, otherwise a straight-line estimate. */
export function estimateRoute(from: LatLngPair, to: LatLngPair): DeliveryRoute {
  const atMine = straightKm(from, places.riverside.position) < 3;
  if (atMine) {
    for (const route of Object.values(routes)) {
      const end = route.points[route.points.length - 1];
      if (straightKm(end, to) < 3) {
        // The road to the site, then on to the exact gate or offloading point, and from the exact loading point at the start.
        const points = [...(straightKm(route.points[0], from) > 0.05 ? [from] : []), ...route.points, ...(straightKm(end, to) > 0.05 ? [to] : [])];
        const km = Math.round(routeLengthKm(points) * 10) / 10;
        return { points, km, minutes: Math.round((km / PLANNED_KPH) * 60), source: "network" };
      }
    }
  }
  const km = Math.round(straightKm(from, to) * ROAD_FACTOR * 10) / 10;
  return { points: [from, to], km, minutes: Math.round((km / PLANNED_KPH) * 60), source: "estimated" };
}

// ---- The service the screens use ----------------------------------------------------------------------------------------

export type LocationService = {
  provider: "google" | "directory";
  search(query: string, saved: SavedLocation[]): Promise<PlaceSuggestion[]>;
  resolve(suggestion: PlaceSuggestion): Promise<DeliveryLocation>;
  describe(position: LatLngPair, source: DeliveryLocation["source"]): Promise<DeliveryLocation>;
  route(from: LatLngPair, to: LatLngPair): Promise<DeliveryRoute>;
};

const pinned = (position: LatLngPair, source: DeliveryLocation["source"]): DeliveryLocation => ({ name: describePosition(position), address: "", position, source, placeId: null, savedLocationId: null });

export const locationService: LocationService = {
  provider: GOOGLE_KEY ? "google" : "directory",

  async search(query, saved) {
    const own = directorySearch(query, saved);
    if (!GOOGLE_KEY || normalise(query).length < 3) return own;
    try {
      const google = await googleMaps(GOOGLE_KEY).search(query);
      // Saved locations first: a known site should not be searched for again.
      return [...own.filter((item) => item.location?.source === "saved"), ...google, ...own.filter((item) => item.location?.source !== "saved")].slice(0, 10);
    } catch {
      return own;
    }
  },

  async resolve(suggestion) {
    if (suggestion.location) return suggestion.location;
    return googleMaps(GOOGLE_KEY).resolve(suggestion.id);
  },

  async describe(position, source) {
    if (!GOOGLE_KEY) return pinned(position, source);
    try {
      const found = await googleMaps(GOOGLE_KEY).reverse(position);
      return found ? { ...found, position, source } : pinned(position, source);
    } catch {
      return pinned(position, source);
    }
  },

  async route(from, to) {
    if (!GOOGLE_KEY) return estimateRoute(from, to);
    try {
      return (await googleMaps(GOOGLE_KEY).route(from, to)) ?? estimateRoute(from, to);
    } catch {
      return estimateRoute(from, to);
    }
  },
};

export const sameSpot = (a: LatLngPair, b: LatLngPair) => distanceKm(a, b) < 0.05;
