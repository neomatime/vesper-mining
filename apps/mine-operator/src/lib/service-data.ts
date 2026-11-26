/**
 * Seed service providers and service requests. The providers are fictional and already approved to work at the mine.
 */
import type { ServiceProvider, ServiceRequest } from "@vesper/api-contracts";

const created = "2025-01-13T08:00:00+02:00";

/** Fictional providers already approved to work at the mine. */
/** A clearly fictional provider added for prototype testing. */
function fictional(p: { id: string; name: string; registration: string; contactName: string; email: string; phone: string; categories: ServiceProvider["categories"]; specialisation: string; responseHours: number; approval?: ServiceProvider["approval"] }): ServiceProvider {
  const approval = p.approval ?? "approved";
  return {
    id: p.id, name: p.name, registration: p.registration, contactName: p.contactName, email: p.email, phone: p.phone, categories: p.categories, approvedUntil: "", active: approval === "approved",
    approval, specialisation: p.specialisation, serviceAreas: ["Riverside Mine"], responseHours: p.responseHours, documents: [], notes: "",
    history: [{ id: `prh-${p.id.slice(-3)}`, at: created, actor: "Mine Manager", summary: approval === "approved" ? "Added and approved" : "Added; waiting for approval", note: null }], createdAt: created, version: 1,
  };
}

export const seedProviders: ServiceProvider[] = [
  { id: "prov-001", name: "OreTech Services", registration: "2012/118344/07", contactName: "Palesa Ndlovu", email: "service@oretech.example", phone: "+27 14 555 0171", categories: ["crusher", "excavator", "pump"], approvedUntil: "2026-03-31", active: true, approval: "approved", specialisation: "Crushers, excavators and pumps", serviceAreas: ["Riverside Mine"], responseHours: 2, documents: [], history: [{ id: "prh-001", at: created, actor: "Mine Manager", summary: "Added to the approved list", note: null }], notes: "Primary crusher and excavator contractor.", createdAt: created, version: 1 },
  { id: "prov-002", name: "Karoo Crusher & Screen", registration: "2009/046210/07", contactName: "Johan Pretorius", email: "workshop@karoocrusher.example", phone: "+27 53 555 0182", categories: ["crusher"], approvedUntil: "2026-06-30", active: true, approval: "approved", specialisation: "Crusher and screening plant repairs", serviceAreas: ["Riverside Mine", "North West"], responseHours: 8, documents: [], history: [{ id: "prh-002", at: created, actor: "Mine Manager", summary: "Added to the approved list", note: null }], notes: "", createdAt: created, version: 1 },
  { id: "prov-003", name: "Northgate Fleet Services", registration: "2015/302981/07", contactName: "Thandi Mokoena", email: "fleet@northgate.example", phone: "+27 11 555 0193", categories: ["haul_truck", "dozer", "loader", "light_vehicle", "water_cart"], approvedUntil: "2025-12-31", active: true, approval: "approved", specialisation: "Haul trucks, dozers, loaders and light vehicles", serviceAreas: ["Riverside Mine", "Gauteng"], responseHours: 4, documents: [], history: [{ id: "prh-003", at: created, actor: "Mine Manager", summary: "Added to the approved list", note: null }], notes: "Mobile workshop on site Monday to Friday.", createdAt: created, version: 1 },
  { id: "prov-004", name: "Ridge Hydraulics", registration: "2005/220871/07", contactName: "Sizwe Dube", email: "jobs@ridgehydraulics.example", phone: "+27 14 555 0164", categories: ["excavator", "dozer", "loader"], approvedUntil: "2025-03-31", active: true, approval: "approved", specialisation: "Hydraulic systems for excavators, dozers and loaders", serviceAreas: ["Riverside Mine"], responseHours: 24, documents: [], history: [{ id: "prh-004", at: created, actor: "Mine Manager", summary: "Added to the approved list", note: null }], notes: "Approval needs renewing.", createdAt: created, version: 1 },
  { id: "prov-005", name: "Highveld Drilling Support", registration: "2018/411203/07", contactName: "Annelie Botha", email: "support@highveld.example", phone: "+27 17 555 0155", categories: ["drill_rig"], approvedUntil: "", active: false, approval: "inactive", specialisation: "Drill rig support", serviceAreas: ["Riverside Mine"], responseHours: null, documents: [], history: [{ id: "prh-005", at: created, actor: "Mine Manager", summary: "Added to the approved list", note: null }], notes: "Paused pending a safety audit.", createdAt: created, version: 1 },
  // Clearly fictional providers for prototype testing. They do not replace or overwrite the records above.
  fictional({ id: "prov-006", name: "ABC Industrial Repairs", registration: "2011/090214/07", contactName: "Zanele Mkhize", email: "repairs@abcindustrial.example", phone: "+27 14 555 0201", categories: ["crusher", "conveyor", "processing_plant"], specialisation: "Crushers, conveyors, processing equipment", responseHours: 2 }),
  fictional({ id: "prov-007", name: "Mining Hydraulics SA", registration: "2007/155230/07", contactName: "Pieter van Wyk", email: "service@mininghydraulics.example", phone: "+27 14 555 0212", categories: ["excavator", "loader", "haul_truck"], specialisation: "Hydraulic systems, mobile equipment", responseHours: 4 }),
  fictional({ id: "prov-008", name: "PowerTech Services", registration: "2014/267811/07", contactName: "Naomi Sithole", email: "support@powertech.example", phone: "+27 14 555 0223", categories: ["substation", "generator", "power_distribution"], specialisation: "Electrical systems, substations, power supply", responseHours: 4 }),
  fictional({ id: "prov-009", name: "AquaFlow Solutions", registration: "2019/338412/07", contactName: "Kabelo Moloi", email: "jobs@aquaflow.example", phone: "+27 14 555 0234", categories: ["pump", "pipeline"], specialisation: "Pumps, pipelines, water systems", responseHours: 8, approval: "pending" }),
  fictional({ id: "prov-010", name: "Terrain Works", registration: "2016/402975/07", contactName: "Lindiwe Zulu", email: "office@terrainworks.example", phone: "+27 14 555 0245", categories: ["mine_road", "rail", "loading_facility"], specialisation: "Mine roads, civil works, earthworks", responseHours: 8 }),
  fictional({ id: "prov-011", name: "SiteLink Communications", registration: "2013/189027/07", contactName: "Themba Radebe", email: "noc@sitelink.example", phone: "+27 14 555 0256", categories: ["comms_network"], specialisation: "Radio, data and site communications networks", responseHours: 12 }),
  fictional({ id: "prov-012", name: "Rail & Loading Engineering", registration: "2020/512340/07", contactName: "Busisiwe Nel", email: "info@railloading.example", phone: "+27 14 555 0267", categories: ["rail", "loading_facility", "conveyor"], specialisation: "Rail sidings, loading facilities, bulk handling", responseHours: 24, approval: "pending" }),
];

export const seedRequests: ServiceRequest[] = [];
