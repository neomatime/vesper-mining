/**
 * The geography VESPER draws under the delivery map when no tile provider is configured: the Indian Ocean coast, neighbouring
 * countries, Kruger National Park, national roads and ranked town names. Outlines are simplified approximations for
 * orientation only, not survey data; nothing is loaded from outside.
 */
import type { LatLng } from "./telematics";

/** The sea east and south of the coast, from Mozambique to the Eastern Cape. */
export const ocean: LatLng[] = [
  [-21, 35.3], [-24.0, 35.4], [-25.0, 33.5], [-25.97, 32.6], [-26.87, 32.89], [-27.4, 32.7], [-28.0, 32.55], [-28.38, 32.42],
  [-28.8, 32.08], [-29.3, 31.6], [-29.87, 31.05], [-30.4, 30.7], [-30.74, 30.45], [-31.05, 30.23], [-31.6, 29.6], [-32.4, 28.7],
  [-33.02, 27.91], [-35, 27.5], [-35, 40], [-21, 40],
];

export const eswatini: LatLng[] = [
  [-25.72, 31.33], [-25.85, 31.75], [-26.1, 32.0], [-26.45, 32.12], [-26.85, 32.13], [-27.3, 31.98], [-27.32, 31.45],
  [-27.1, 31.0], [-26.75, 30.8], [-26.3, 30.8], [-25.95, 31.05],
];

export const lesotho: LatLng[] = [
  [-28.57, 28.65], [-28.75, 29.1], [-29.25, 29.45], [-29.65, 29.3], [-30.1, 29.1], [-30.4, 28.8], [-30.65, 28.1], [-30.3, 27.45],
  [-29.95, 27.05], [-29.6, 27.0], [-29.25, 27.35], [-28.9, 27.7], [-28.6, 28.15],
];

/** The border with Mozambique, north of Eswatini and between Eswatini and the coast. */
export const borders: LatLng[][] = [
  [[-22.3, 31.3], [-23.0, 31.55], [-24.0, 31.9], [-25.0, 32.0], [-25.43, 31.97], [-25.85, 31.98]],
  [[-26.85, 32.13], [-26.87, 32.89]],
];

export const kruger: LatLng[] = [
  [-22.35, 31.0], [-22.4, 31.35], [-23.0, 31.55], [-24.0, 31.9], [-25.0, 31.98], [-25.42, 31.97], [-25.52, 31.5],
  [-25.3, 31.05], [-24.6, 31.1], [-24.0, 31.1], [-23.4, 30.9], [-22.8, 30.9],
];

/** National roads beyond the haul routes, for orientation. */
export const nationalRoads: { name: string; points: LatLng[] }[] = [
  { name: "N1", points: [[-25.75, 28.19], [-24.88, 28.29], [-24.2, 28.95], [-23.9, 29.45], [-23.05, 29.9], [-22.35, 30.04]] },
  { name: "N4", points: [[-25.75, 28.19], [-25.87, 29.23], [-25.77, 29.46], [-25.69, 30.03], [-25.66, 30.25], [-25.47, 30.97], [-25.43, 31.95]] },
  { name: "R37", points: [[-23.9, 29.45], [-24.32, 29.95], [-24.68, 30.33], [-25.1, 30.45]] },
  { name: "R33", points: [[-25.17, 29.4], [-24.9, 29.75], [-24.68, 30.33]] },
  { name: "N3", points: [[-26.22, 28.17], [-26.67, 28.35], [-27.03, 28.6], [-27.85, 28.96], [-28.27, 29.13], [-28.56, 29.78]] },
  { name: "N17", points: [[-26.22, 28.17], [-26.25, 28.44], [-26.46, 29.47], [-26.53, 29.98]] },
  { name: "N2", points: [[-29.87, 31.03], [-29.54, 31.21], [-29.33, 31.29], [-28.75, 31.89]] },
];

/** Towns named on the base map. Major towns are always named; minor ones once the map is zoomed in. */
export const townLabels: { name: string; position: LatLng; rank: "major" | "minor" }[] = [
  { name: "Pretoria", position: [-25.75, 28.19], rank: "major" },
  { name: "Johannesburg", position: [-26.2, 28.04], rank: "major" },
  { name: "Polokwane", position: [-23.9, 29.45], rank: "major" },
  { name: "Mbombela", position: [-25.47, 30.97], rank: "major" },
  { name: "Durban", position: [-29.86, 31.0], rank: "major" },
  { name: "Pietermaritzburg", position: [-29.6, 30.38], rank: "major" },
  { name: "Middelburg", position: [-25.77, 29.46], rank: "major" },
  { name: "eMalahleni", position: [-25.87, 29.23], rank: "major" },
  { name: "Ermelo", position: [-26.53, 29.98], rank: "major" },
  { name: "Newcastle", position: [-27.76, 29.93], rank: "major" },
  { name: "Richards Bay", position: [-28.78, 32.04], rank: "major" },
  { name: "Groblersdal", position: [-25.17, 29.4], rank: "minor" },
  { name: "Mashishing", position: [-25.1, 30.45], rank: "minor" },
  { name: "Roossenekal", position: [-25.2, 29.93], rank: "minor" },
  { name: "Stoffberg", position: [-25.42, 29.81], rank: "minor" },
  { name: "Dullstroom", position: [-25.42, 30.1], rank: "minor" },
  { name: "eMakhazeni", position: [-25.69, 30.03], rank: "minor" },
  { name: "eNtokozweni", position: [-25.66, 30.25], rank: "minor" },
  { name: "Carolina", position: [-26.07, 30.12], rank: "minor" },
  { name: "Bethal", position: [-26.46, 29.47], rank: "minor" },
  { name: "Secunda", position: [-26.52, 29.17], rank: "minor" },
  { name: "eMkhondo", position: [-27.01, 30.81], rank: "minor" },
  { name: "Pongola", position: [-27.38, 31.62], rank: "minor" },
  { name: "Volksrust", position: [-27.37, 29.88], rank: "minor" },
  { name: "Ladysmith", position: [-28.56, 29.78], rank: "minor" },
  { name: "Harrismith", position: [-28.27, 29.13], rank: "minor" },
  { name: "Estcourt", position: [-29.0, 29.87], rank: "minor" },
  { name: "Empangeni", position: [-28.75, 31.89], rank: "minor" },
  { name: "Komatipoort", position: [-25.43, 31.95], rank: "minor" },
  { name: "Makhado", position: [-23.05, 29.9], rank: "minor" },
];

/** Names for areas: provinces, neighbouring countries, the park and the sea. */
export const areaLabels: { name: string; position: LatLng; kind: "province" | "country" | "park" | "water" }[] = [
  { name: "LIMPOPO", position: [-23.6, 28.7], kind: "province" },
  { name: "MPUMALANGA", position: [-26.0, 30.55], kind: "province" },
  { name: "GAUTENG", position: [-26.45, 28.25], kind: "province" },
  { name: "KWAZULU-NATAL", position: [-28.3, 30.75], kind: "province" },
  { name: "FREE STATE", position: [-28.0, 27.3], kind: "province" },
  { name: "ESWATINI", position: [-26.52, 31.45], kind: "country" },
  { name: "LESOTHO", position: [-29.6, 28.25], kind: "country" },
  { name: "MOZAMBIQUE", position: [-24.4, 32.7], kind: "country" },
  { name: "Kruger National Park", position: [-24.0, 31.5], kind: "park" },
  { name: "INDIAN OCEAN", position: [-30.2, 33.2], kind: "water" },
];
