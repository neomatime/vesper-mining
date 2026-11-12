import type { ServiceProvider, ServiceRequest } from "@vesper/api-contracts";

const created = "2025-01-13T08:00:00+02:00";

/** Fictional providers already approved to work at the mine. */
export const seedProviders: ServiceProvider[] = [
  { id: "prov-001", name: "OreTech Services", registration: "2012/118344/07", contactName: "Palesa Ndlovu", email: "service@oretech.example", phone: "+27 14 555 0171", categories: ["crusher", "excavator", "pump"], approvedUntil: "2026-03-31", active: true, notes: "Primary crusher and excavator contractor.", createdAt: created, version: 1 },
  { id: "prov-002", name: "Karoo Crusher & Screen", registration: "2009/046210/07", contactName: "Johan Pretorius", email: "workshop@karoocrusher.example", phone: "+27 53 555 0182", categories: ["crusher"], approvedUntil: "2026-06-30", active: true, notes: "", createdAt: created, version: 1 },
  { id: "prov-003", name: "Northgate Fleet Services", registration: "2015/302981/07", contactName: "Thandi Mokoena", email: "fleet@northgate.example", phone: "+27 11 555 0193", categories: ["haul_truck", "dozer", "loader", "light_vehicle", "water_cart"], approvedUntil: "2025-12-31", active: true, notes: "Mobile workshop on site Monday to Friday.", createdAt: created, version: 1 },
  { id: "prov-004", name: "Ridge Hydraulics", registration: "2005/220871/07", contactName: "Sizwe Dube", email: "jobs@ridgehydraulics.example", phone: "+27 14 555 0164", categories: ["excavator", "dozer", "loader"], approvedUntil: "2025-03-31", active: true, notes: "Approval needs renewing.", createdAt: created, version: 1 },
  { id: "prov-005", name: "Highveld Drilling Support", registration: "2018/411203/07", contactName: "Annelie Botha", email: "support@highveld.example", phone: "+27 17 555 0155", categories: ["drill_rig"], approvedUntil: "", active: false, notes: "Paused pending a safety audit.", createdAt: created, version: 1 },
];

export const seedRequests: ServiceRequest[] = [];
