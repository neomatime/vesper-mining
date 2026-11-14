/**
 * The presenter console's personas, scenarios and subscription tiers. Tiers come from the central plans in
 * packages/api-contracts, so this file never defines what a subscription includes.
 */
import { reportingLevelLabels, siteAllowanceLabel, subscriptionPlans, type DemoContext } from "@vesper/api-contracts";

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

/** The subscriptions as the launcher and menus list them, built from the central plans. */
export const tiers: {
  value: Tier;
  label: string;
  sites: string;
  mobile: boolean;
  reporting: string;
  advancedAnalytics: boolean;
}[] = subscriptionPlans.map((plan) => ({
  value: plan.id,
  label: plan.label,
  sites: siteAllowanceLabel(plan),
  mobile: plan.features.includes("mobile_field_essential"),
  reporting: reportingLevelLabels[plan.reporting],
  advancedAnalytics: plan.features.includes("advanced_analytics"),
}));

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
