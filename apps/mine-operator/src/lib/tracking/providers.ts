/**
 * Which telematics provider reads each logistics provider's vehicles. Every logistics provider maps to the simulated provider
 * until a real integration is approved; adding one is a single entry here with its adapter (see telematics.ts).
 */
import { vehicleLoads } from "./fleet";
import { createSimulatedProvider } from "./simulated-provider";
import type { LatLng, TelematicsProvider, VehiclePosition } from "./telematics";

export function telematicsRegistry(routeOf: (deliveryId: string) => LatLng[] | null): Record<string, TelematicsProvider> {
  const simulated = createSimulatedProvider(routeOf);
  return { "tr-001": simulated, "tr-002": simulated, "tr-003": simulated };
}

/** Reads the latest positions for these vehicles from each vehicle's provider. A provider that fails leaves its vehicles unread. */
export async function readPositions(vehicleIds: string[], at: string, registry: Record<string, TelematicsProvider>): Promise<VehiclePosition[]> {
  const byProvider = new Map<TelematicsProvider, string[]>();
  for (const load of vehicleLoads.filter((item) => vehicleIds.includes(item.vehicleId))) {
    const provider = registry[load.providerId];
    if (!provider) continue;
    byProvider.set(provider, [...(byProvider.get(provider) ?? []), load.vehicleId]);
  }
  const results = await Promise.all([...byProvider].map(([provider, ids]) => provider.positions(ids, at).catch(() => [] as VehiclePosition[])));
  return results.flat();
}
