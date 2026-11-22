/**
 * The mine's own fleet as a way to move a shipment ("Transport handled by: Our fleet"). Vehicles come from the existing equipment
 * register, drivers from the people already in VESPER. A shipment can have several loads, each with a vehicle, a driver and planned
 * times. Everything is checked against the same readiness, dispatch and delivery steps a provider shipment goes through:
 * assigning a vehicle never marks a shipment ready, dispatched or delivered.
 *
 * Fictional demonstration data. An internal cost, when entered, is an estimate and is kept apart from sales value and from any invoice.
 */
import type { FleetLoad, Shipment } from "@vesper/api-contracts";

/** The id stored in a shipment's transporterId (and its collection request) when the mine's own fleet moves it. */
export const OWN_FLEET_ID = "own-fleet";
export const OWN_FLEET_NAME = "Our fleet";

/** Equipment categories that can carry a load. */
export const fleetCategories = ["haul_truck", "light_vehicle"] as const;

export const transportModeLabels = { provider: "Logistics provider", own_fleet: "Our fleet" } as const;

export type MaintenanceState = "ok" | "due_soon" | "overdue" | "unknown";

/** A vehicle as the assignment screens see it: whether it can take a load now and why not. */
export type FleetVehicle = {
  id: string;
  code: string;
  name: string;
  category: string;
  state: "available" | "unavailable";
  stateNote: string | null;
  maintenance: MaintenanceState;
  maintenanceLabel: string;
  /** Can be given a new load: available and not overdue for service. */
  assignable: boolean;
  /** Why it cannot be given a load, in plain words. */
  reason: string | null;
};

export type FleetAlert = {
  loadId: string;
  vehicleCode: string;
  reason: string;
  /** Who is responsible and what happens next. Taken from the linked issue when there is one. */
  responsible: string;
  nextAction: string;
  issueId: string | null;
  issueNumber: string | null;
};

export const sameDay = (value: string) => value.slice(0, 10);

/** Two planned windows overlap when each starts before the other ends. */
export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export const assignedTonnes = (shipment: Pick<Shipment, "fleet">) => Math.round(shipment.fleet.loads.reduce((total, load) => total + load.tonnes, 0) * 100) / 100;

/** Plain-words problems that stop an own-fleet shipment being marked ready. Empty means the fleet side is ready. */
export function fleetProblems(shipment: Pick<Shipment, "tonnes" | "fleet">, vehicles: FleetVehicle[]): string[] {
  const problems: string[] = [];
  if (!shipment.fleet.coordinator) problems.push("Choose who is responsible for the transport.");
  if (shipment.fleet.loads.length === 0) problems.push("Assign at least one vehicle and driver.");
  const missing = Math.round((shipment.tonnes - assignedTonnes(shipment)) * 100) / 100;
  if (shipment.fleet.loads.length > 0 && missing > 0) problems.push(`Assign vehicles for the remaining ${new Intl.NumberFormat("en-GB").format(missing)} t.`);
  for (const load of shipment.fleet.loads) {
    const vehicle = vehicles.find((item) => item.id === load.vehicleId);
    if (!vehicle) problems.push("A vehicle on this shipment is no longer in the equipment register.");
    else if (!vehicle.assignable) problems.push(`${vehicle.code} cannot take its load: ${vehicle.reason}`);
  }
  return problems;
}

/** The earliest planned collection among the loads, used as the scheduled collection time. */
export function earliestCollection(loads: FleetLoad[]): string | null {
  return loads.length === 0 ? null : [...loads].sort((a, b) => a.plannedCollectionAt.localeCompare(b.plannedCollectionAt))[0].plannedCollectionAt;
}
