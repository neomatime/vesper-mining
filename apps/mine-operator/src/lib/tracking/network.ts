/**
 * The road network the delivery map draws: Riverside Mine (fictional, in the eastern chrome belt near Steelpoort), the customers'
 * delivery points and the towns the haul routes pass through. Coordinates are approximate real positions; routes follow the main
 * roads through those towns. Used for drawing and for the simulated vehicles; real providers send their own coordinates.
 */
import type { LatLng } from "./telematics";

export type Place = { id: string; name: string; position: LatLng; kind: "mine" | "destination" | "town" };

export const places: Record<string, Place> = {
  riverside: { id: "riverside", name: "Riverside Mine", position: [-24.66, 30.06], kind: "mine" },
  middelburg_works: { id: "middelburg_works", name: "Horizon Metals, Middelburg", position: [-25.76, 29.48], kind: "destination" },
  secunda_yard: { id: "secunda_yard", name: "Highveld Power coal yard, Secunda", position: [-26.53, 29.2], kind: "destination" },
  durban_terminal: { id: "durban_terminal", name: "Durban Bulk Terminal", position: [-29.87, 31.03], kind: "destination" },
  richards_bay: { id: "richards_bay", name: "Richards Bay Terminal", position: [-28.8, 32.04], kind: "destination" },
  germiston_yard: { id: "germiston_yard", name: "Customer Stockyard A, Germiston", position: [-26.22, 28.17], kind: "destination" },
  steelpoort: { id: "steelpoort", name: "Steelpoort", position: [-24.73, 30.2], kind: "town" },
  lydenburg: { id: "lydenburg", name: "Mashishing", position: [-25.1, 30.45], kind: "town" },
  dullstroom: { id: "dullstroom", name: "Dullstroom", position: [-25.42, 30.1], kind: "town" },
  belfast: { id: "belfast", name: "eMakhazeni", position: [-25.69, 30.03], kind: "town" },
  machadodorp: { id: "machadodorp", name: "eNtokozweni", position: [-25.66, 30.25], kind: "town" },
  carolina: { id: "carolina", name: "Carolina", position: [-26.07, 30.12], kind: "town" },
  ermelo: { id: "ermelo", name: "Ermelo", position: [-26.53, 29.98], kind: "town" },
  piet_retief: { id: "piet_retief", name: "eMkhondo", position: [-27.01, 30.81], kind: "town" },
  pongola: { id: "pongola", name: "Pongola", position: [-27.38, 31.62], kind: "town" },
  empangeni: { id: "empangeni", name: "Empangeni", position: [-28.75, 31.89], kind: "town" },
  roossenekal: { id: "roossenekal", name: "Roossenekal", position: [-25.2, 29.93], kind: "town" },
  stoffberg: { id: "stoffberg", name: "Stoffberg", position: [-25.42, 29.81], kind: "town" },
  middelburg: { id: "middelburg", name: "Middelburg", position: [-25.77, 29.46], kind: "town" },
  emalahleni: { id: "emalahleni", name: "eMalahleni", position: [-25.87, 29.23], kind: "town" },
  bethal: { id: "bethal", name: "Bethal", position: [-26.46, 29.47], kind: "town" },
  volksrust: { id: "volksrust", name: "Volksrust", position: [-27.37, 29.88], kind: "town" },
  newcastle: { id: "newcastle", name: "Newcastle", position: [-27.76, 29.93], kind: "town" },
  ladysmith: { id: "ladysmith", name: "Ladysmith", position: [-28.56, 29.78], kind: "town" },
  estcourt: { id: "estcourt", name: "Estcourt", position: [-29.0, 29.87], kind: "town" },
  pietermaritzburg: { id: "pietermaritzburg", name: "Pietermaritzburg", position: [-29.6, 30.38], kind: "town" },
  pretoria: { id: "pretoria", name: "Pretoria", position: [-25.75, 28.19], kind: "town" },
};

/** Province names for the map, placed near their centres. */
export const regions: { name: string; position: LatLng }[] = [
  { name: "LIMPOPO", position: [-24.1, 29.3] },
  { name: "MPUMALANGA", position: [-25.95, 30.55] },
  { name: "GAUTENG", position: [-26.05, 28.25] },
  { name: "KWAZULU-NATAL", position: [-28.6, 30.9] },
  { name: "FREE STATE", position: [-28.4, 27.6] },
];

const path = (...ids: string[]): LatLng[] => ids.map((id) => places[id].position);

/** Haul routes from the mine, by destination. */
export const routes: Record<string, { id: string; name: string; points: LatLng[] }> = {
  middelburg_works: { id: "r-middelburg", name: "R555 / N11 via Roossenekal", points: path("riverside", "roossenekal", "stoffberg", "middelburg", "middelburg_works") },
  secunda_yard: { id: "r-secunda", name: "N11 / R35 via Middelburg and Bethal", points: path("riverside", "roossenekal", "stoffberg", "middelburg", "bethal", "secunda_yard") },
  durban_terminal: { id: "r-durban", name: "R36 / N11 / N3 via Ermelo and Ladysmith", points: path("riverside", "steelpoort", "lydenburg", "dullstroom", "belfast", "carolina", "ermelo", "volksrust", "newcastle", "ladysmith", "estcourt", "pietermaritzburg", "durban_terminal") },
  richards_bay: { id: "r-richards", name: "R36 / N2 via Ermelo and Pongola", points: path("riverside", "steelpoort", "lydenburg", "machadodorp", "carolina", "ermelo", "piet_retief", "pongola", "empangeni", "richards_bay") },
  germiston_yard: { id: "r-germiston", name: "N11 / N12 via eMalahleni", points: path("riverside", "roossenekal", "stoffberg", "middelburg", "emalahleni", "germiston_yard") },
};

/** Which delivery point a Trade delivery's destination text refers to. */
export function placeForDestination(destination: string): Place | null {
  const text = destination.toLowerCase();
  if (text.includes("middelburg")) return places.middelburg_works;
  if (text.includes("secunda")) return places.secunda_yard;
  if (text.includes("durban")) return places.durban_terminal;
  if (text.includes("richards bay")) return places.richards_bay;
  if (text.includes("germiston")) return places.germiston_yard;
  return null;
}

// ---- Geometry ---------------------------------------------------------------------------------------------------------------

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng) {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  // Roads wind: a factor turns straight-line distance into a fair road distance.
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1.18;
}

export function routeLengthKm(points: LatLng[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += distanceKm(points[index - 1], points[index]);
  return total;
}

export function bearing(a: LatLng, b: LatLng) {
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** The point a given distance along a route, the heading there, and the route split into the part travelled and the part ahead. */
export function along(points: LatLng[], km: number): { position: LatLng; headingDeg: number; travelled: LatLng[]; ahead: LatLng[] } {
  let remaining = Math.max(0, km);
  for (let index = 1; index < points.length; index += 1) {
    const segment = distanceKm(points[index - 1], points[index]);
    if (remaining <= segment || index === points.length - 1) {
      const share = segment === 0 ? 1 : Math.min(1, remaining / segment);
      const [a, b] = [points[index - 1], points[index]];
      const position: LatLng = [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
      return { position, headingDeg: bearing(a, b), travelled: [...points.slice(0, index), position], ahead: [position, ...points.slice(index)] };
    }
    remaining -= segment;
  }
  const last = points[points.length - 1];
  return { position: last, headingDeg: 0, travelled: points, ahead: [last] };
}
