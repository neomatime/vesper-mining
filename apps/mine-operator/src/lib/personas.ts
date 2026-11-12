import type { DemoContext } from "@vesper/api-contracts";

export type Persona = {
  name: string;
  role: string;
  scope: string;
  fieldOnly: boolean;
};

export const personas: Persona[] = [
  { name: "John Dlamini", role: "Mine Manager", scope: "Management visibility", fieldOnly: false },
  { name: "Amina Patel", role: "Shift Supervisor", scope: "Shift control and handover", fieldOnly: false },
  { name: "Sipho Nkosi", role: "Shift Supervisor", scope: "Shift control and handover", fieldOnly: false },
  { name: "Lebo Maseko", role: "Maintenance Planner", scope: "Equipment and readiness", fieldOnly: false },
  { name: "Naledi Khoza", role: "Stores / Inventory Controller", scope: "Parts and stock", fieldOnly: false },
  { name: "Thabo Molefe", role: "Field Employee", scope: "Field execution", fieldOnly: true },
];

type Tier = DemoContext["tier"];

export const tiers: {
  value: Tier;
  label: string;
  sites: string;
  mobile: boolean;
  reporting: "Essential" | "Operational" | "Advanced" | "Group-level";
  advancedAnalytics: boolean;
}[] = [
  { value: "core", label: "Core", sites: "1 site", mobile: false, reporting: "Essential", advancedAnalytics: false },
  { value: "operations_single", label: "Operations — Single Site", sites: "1 site", mobile: true, reporting: "Operational", advancedAnalytics: false },
  { value: "operations", label: "Operations", sites: "Up to 3 sites", mobile: true, reporting: "Operational", advancedAnalytics: false },
  { value: "enterprise", label: "Enterprise", sites: "Up to 6 sites", mobile: true, reporting: "Advanced", advancedAnalytics: true },
  { value: "group", label: "Group", sites: "7+ sites", mobile: true, reporting: "Group-level", advancedAnalytics: true },
];

export const scenarios: { value: DemoContext["scenario"]; label: string }[] = [
  { value: "equipment_breakdown", label: "Equipment Breakdown" },
  { value: "spare_parts_risk", label: "Spare Parts Risk" },
  { value: "normal_operations", label: "Normal Operations" },
  { value: "unknown_inventory", label: "Unknown Inventory" },
  { value: "shift_handover", label: "Shift Handover" },
  { value: "stale_map", label: "Stale Operational Map" },
  { value: "offline_report", label: "Offline Field Report" },
];

export function tierLabel(tier: Tier) {
  return tiers.find((item) => item.value === tier)?.label ?? tier;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export function personaByName(name: string) {
  return personas.find((persona) => persona.name === name);
}

/** People and teams that can own work in the demonstration. */
export const owners = [...personas.map((persona) => persona.name), "OreTech Services"];

export const teams = ["Maintenance", "Stores / Procurement", "Production", "Operations", "Contractor"];
