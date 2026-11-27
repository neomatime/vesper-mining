/**
 * The Google Maps adapter for delivery planning: Places search (Autocomplete), place details, reverse geocoding and driving routes,
 * through the Maps JavaScript API. Loaded only when a key is configured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) and only when a planner
 * searches. Every call can fail; location-service.ts falls back to VESPER's own directory and estimates when it does.
 *
 * The key needs the Maps JavaScript API, Places API (New), Geocoding API and Routes API enabled, and should be restricted to the
 * VESPER domains.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the Maps JavaScript API is loaded at run time and has no bundled types here. */
import type { DeliveryLocation, DeliveryRoute, LatLngPair } from "../trade-rules";
import type { PlaceSuggestion } from "./location-service";

type Maps = { importLibrary: (name: string) => Promise<any> };

let loading: Promise<Maps> | null = null;

function loadMaps(key: string): Promise<Maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps runs in the browser only."));
  const existing = (window as any).google?.maps;
  if (existing?.importLibrary) return Promise.resolve(existing as Maps);
  loading ??= new Promise<Maps>((resolve, reject) => {
    const callback = "__vesperGoogleMapsReady";
    (window as any)[callback] = () => resolve((window as any).google.maps as Maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&region=ZA&callback=${callback}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Long routes come back with thousands of points; every n-th point (and the ends) is plenty to draw and track against. */
function thin(points: LatLngPair[], max = 400): LatLngPair[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  return points.filter((_, index) => index % step === 0 || index === points.length - 1);
}

const num = (value: any) => (typeof value === "function" ? value() : Number(value));

export function googleMaps(key: string) {
  let session: any = null;
  return {
    async search(query: string): Promise<PlaceSuggestion[]> {
      const maps = await loadMaps(key);
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await maps.importLibrary("places");
      session ??= new AutocompleteSessionToken();
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: query, sessionToken: session, includedRegionCodes: ["za", "sz", "ls", "mz", "bw", "zw", "na"] });
      return (suggestions as any[]).filter((item) => item.placePrediction).slice(0, 6).map((item) => {
        const prediction = item.placePrediction;
        return { id: prediction.placeId, title: String(prediction.mainText ?? prediction.text), detail: `Google Maps · ${String(prediction.secondaryText ?? "")}`, provider: "google" as const, location: null };
      });
    },

    async resolve(placeId: string): Promise<DeliveryLocation> {
      const maps = await loadMaps(key);
      const { Place } = await maps.importLibrary("places");
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      session = null;
      return { name: String(place.displayName ?? place.formattedAddress ?? "Selected place"), address: String(place.formattedAddress ?? ""), position: [num(place.location.lat), num(place.location.lng)], source: "google", placeId, savedLocationId: null };
    },

    async reverse(position: LatLngPair): Promise<Omit<DeliveryLocation, "position" | "source"> | null> {
      const maps = await loadMaps(key);
      const { Geocoder } = await maps.importLibrary("geocoding");
      const { results } = await new Geocoder().geocode({ location: { lat: position[0], lng: position[1] } });
      const best = results?.[0];
      if (!best) return null;
      const short = best.address_components?.find((part: any) => part.types?.includes("route") || part.types?.includes("locality"))?.long_name;
      return { name: short ? `Near ${short}` : "Dropped pin", address: best.formatted_address ?? "", placeId: best.place_id ?? null, savedLocationId: null };
    },

    async route(from: LatLngPair, to: LatLngPair): Promise<DeliveryRoute | null> {
      const maps = await loadMaps(key);
      const library = await maps.importLibrary("routes");
      const origin = { lat: from[0], lng: from[1] };
      const destination = { lat: to[0], lng: to[1] };
      if (library.Route?.computeRoutes) {
        const { routes } = await library.Route.computeRoutes({ origin, destination, travelMode: "DRIVING", fields: ["path", "distanceMeters", "durationMillis"] });
        const best = routes?.[0];
        if (best?.path?.length) {
          return { points: thin(best.path.map((point: any) => [num(point.lat), num(point.lng)] as LatLngPair)), km: Math.round(best.distanceMeters / 100) / 10, minutes: Math.round(best.durationMillis / 60_000), source: "google" };
        }
      }
      const result = await new library.DirectionsService().route({ origin, destination, travelMode: "DRIVING" });
      const best = result?.routes?.[0];
      if (!best) return null;
      const meters = best.legs.reduce((total: number, leg: any) => total + (leg.distance?.value ?? 0), 0);
      const seconds = best.legs.reduce((total: number, leg: any) => total + (leg.duration?.value ?? 0), 0);
      return { points: thin(best.overview_path.map((point: any) => [num(point.lat), num(point.lng)] as LatLngPair)), km: Math.round(meters / 100) / 10, minutes: Math.round(seconds / 60), source: "google" };
    },
  };
}
