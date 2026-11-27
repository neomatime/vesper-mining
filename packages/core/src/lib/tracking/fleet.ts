/**
 * Which vehicles carry which delivery. A commercial delivery is usually several truckloads, each its own vehicle journey: this is
 * the one-to-many link the map uses. In a live integration it comes from dispatch (Mining Operations records each load leaving) and
 * the logistics provider's vehicle list; here it describes the loads on the road on the morning of 24 April.
 *
 * `feed` says what the provider's tracking supplies for that vehicle: live readings, a gap (last reading some time ago), or none
 * (for example a subcontracted truck without a tracking unit).
 */
export type VehicleLoad = {
  vehicleId: string;
  registration: string;
  deliveryId: string;
  /** The logistics provider (VESPER transport provider id) and the tracking feed it is read from. */
  providerId: string;
  providerName: string;
  loadNumber: number;
  loadTonnes: number;
  /** When the load left the mine (ISO), from the dispatch record. */
  departedAt: string;
  /** Cruising speed the simulation uses for this vehicle. Real providers send speed readings instead. */
  cruiseKph: number;
  /** Stops on the road (for example a breakdown): when it started and for how long. */
  stops: { at: string; minutes: number }[];
  feed: "live" | "gap" | "none";
};

const at = (time: string) => `2025-04-24T${time}:00+02:00`;
const LOAD = 34;

export const vehicleLoads: VehicleLoad[] = [
  // Durban Bulk Terminal, Global Alloy Traders (AGR-0041): ABC Logistics, a long haul down the N3.
  { vehicleId: "veh-abc-206", registration: "ND 418-206", deliveryId: "ag-41-q2-1", providerId: "tr-001", providerName: "ABC Logistics", loadNumber: 1, loadTonnes: LOAD, departedAt: at("04:50"), cruiseKph: 68, stops: [], feed: "live" },
  { vehicleId: "veh-abc-211", registration: "ND 418-211", deliveryId: "ag-41-q2-1", providerId: "tr-001", providerName: "ABC Logistics", loadNumber: 2, loadTonnes: LOAD, departedAt: at("05:35"), cruiseKph: 68, stops: [], feed: "gap" },
  { vehicleId: "veh-abc-219", registration: "ND 418-219", deliveryId: "ag-41-q2-1", providerId: "tr-001", providerName: "ABC Logistics", loadNumber: 3, loadTonnes: LOAD, departedAt: at("06:20"), cruiseKph: 68, stops: [], feed: "live" },
  // Horizon Metals, Middelburg (AGR-0046): Highveld Transport, slowed by roadworks on the R555.
  { vehicleId: "veh-hvt-024", registration: "HXT 482 MP", deliveryId: "ag-46-apr-1", providerId: "tr-002", providerName: "Highveld Transport", loadNumber: 1, loadTonnes: LOAD, departedAt: at("07:40"), cruiseKph: 48, stops: [], feed: "live" },
  { vehicleId: "veh-hvt-031", registration: "JKD 719 MP", deliveryId: "ag-46-apr-1", providerId: "tr-002", providerName: "Highveld Transport", loadNumber: 2, loadTonnes: LOAD, departedAt: at("08:05"), cruiseKph: 48, stops: [], feed: "live" },
  { vehicleId: "veh-hvt-037", registration: "KLM 233 MP", deliveryId: "ag-46-apr-1", providerId: "tr-002", providerName: "Highveld Transport", loadNumber: 3, loadTonnes: LOAD, departedAt: at("08:30"), cruiseKph: 48, stops: [], feed: "live" },
  // Highveld Power, Secunda (AGR-0045): Metsi Logistics. One truck broke down near Bethal; one subcontracted truck has no tracker.
  { vehicleId: "veh-mts-102", registration: "MTS 102 GP", deliveryId: "ag-45-apr-2", providerId: "tr-003", providerName: "Metsi Logistics", loadNumber: 1, loadTonnes: LOAD, departedAt: at("06:40"), cruiseKph: 64, stops: [{ at: at("08:20"), minutes: 150 }], feed: "live" },
  { vehicleId: "veh-mts-sub", registration: "BRV 556 GP", deliveryId: "ag-45-apr-2", providerId: "tr-003", providerName: "Metsi Logistics (subcontractor)", loadNumber: 2, loadTonnes: LOAD, departedAt: at("07:20"), cruiseKph: 64, stops: [], feed: "none" },
  { vehicleId: "veh-mts-117", registration: "MTS 117 GP", deliveryId: "ag-45-apr-2", providerId: "tr-003", providerName: "Metsi Logistics", loadNumber: 3, loadTonnes: LOAD, departedAt: at("08:10"), cruiseKph: 64, stops: [], feed: "live" },
];

export const loadsFor = (deliveryId: string) => vehicleLoads.filter((item) => item.deliveryId === deliveryId);
