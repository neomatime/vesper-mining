import { canActOnEquipment } from "./equipment-rules";
import { canAct } from "./issue-rules";
import { canManageOrganisation, roleNames } from "./organisation-rules";
import { canActOnShift } from "./shift-rules";

export type Level = "yes" | "own" | "no";

export type RightsRow = { area: string; action: string; levels: Record<string, Level> };

const everyone = () => Object.fromEntries(roleNames.map((role) => [role, "yes" as Level]));
const forRoles = (allowed: string[], own: string[] = []) =>
  Object.fromEntries(roleNames.map((role) => [role, (allowed.includes(role) ? "yes" : own.includes(role) ? "own" : "no") as Level]));
const derive = (test: (role: string) => boolean, own: string[] = []) =>
  Object.fromEntries(roleNames.map((role) => [role, (test(role) ? "yes" : own.includes(role) ? "own" : "no") as Level]));

const as = (role: string) => ({ name: "", role });

/**
 * What each role can do. Rows are derived from the same rules the product enforces wherever those
 * rules are shared code, so this table cannot drift from the behaviour. Readiness decisions follow
 * the store's own role lists.
 */
export const rightsMatrix: RightsRow[] = [
  { area: "Work & Exceptions", action: "View issues and history", levels: everyone() },
  { area: "Work & Exceptions", action: "Report an issue", levels: everyone() },
  { area: "Work & Exceptions", action: "Edit details", levels: derive((r) => canAct("edit", as(r)).allowed) },
  { area: "Work & Exceptions", action: "Assign owners and review", levels: derive((r) => canAct("assign", as(r)).allowed) },
  { area: "Work & Exceptions", action: "Manage actions and dependencies", levels: derive((r) => canAct("manage_actions", as(r)).allowed || canAct("manage_dependencies", as(r)).allowed) },
  { area: "Work & Exceptions", action: "Verify and close", levels: derive((r) => canAct("verify", as(r)).allowed) },
  { area: "Work & Exceptions", action: "Reopen a closed issue", levels: derive((r) => canAct("reopen", as(r)).allowed) },
  { area: "Equipment & Maintenance", action: "View equipment and history", levels: everyone() },
  { area: "Equipment & Maintenance", action: "Add, edit, retire and delete equipment", levels: derive((r) => canActOnEquipment("manage", as(r)).allowed) },
  { area: "Equipment & Maintenance", action: "Log services and inspections", levels: derive((r) => canActOnEquipment("service", as(r)).allowed) },
  { area: "Equipment & Maintenance", action: "Record meter readings", levels: derive((r) => canActOnEquipment("reading", as(r)).allowed) },
  { area: "Equipment & Maintenance", action: "Report availability", levels: derive((r) => canActOnEquipment("state", as(r)).allowed) },
  { area: "Resource Readiness", action: "View readiness", levels: everyone() },
  { area: "Resource Readiness", action: "Record stock and readiness decisions", levels: forRoles(["Mine Manager", "Maintenance Planner", "Stores / Inventory Controller"]) },
  { area: "Resource Readiness", action: "Mark stock as verified", levels: forRoles(["Stores / Inventory Controller"]) },
  { area: "Shift Control", action: "View shifts and handovers", levels: everyone() },
  { area: "Shift Control", action: "Create, edit, cancel and delete shifts", levels: derive((r) => canActOnShift("manage", as(r)).allowed) },
  { area: "Shift Control", action: "Start, close and hand over a shift", levels: forRoles(["Mine Manager"], ["Shift Supervisor"]) },
  { area: "Shift Control", action: "Acknowledge a handover", levels: forRoles(["Mine Manager"], ["Shift Supervisor"]) },
  { area: "Reports", action: "View reports included in the plan", levels: everyone() },
  { area: "Administration", action: "Add, edit, deactivate and delete employees", levels: derive((r) => canManageOrganisation(as(r)).allowed) },
  { area: "Administration", action: "Reset passwords and review rights", levels: derive((r) => canManageOrganisation(as(r)).allowed) },
  { area: "Administration", action: "Edit site and company details", levels: derive((r) => canManageOrganisation(as(r)).allowed) },
];

export const levelLabels: Record<Level, string> = { yes: "Allowed", own: "Own shifts only", no: "Not allowed" };

export const rightsAreas = Array.from(new Set(rightsMatrix.map((row) => row.area)));

/** The rights one role has, grouped by area, for an employee's profile. */
export function rightsForRole(role: string) {
  return rightsAreas.map((area) => ({
    area,
    rows: rightsMatrix.filter((row) => row.area === area).map((row) => ({ action: row.action, level: row.levels[role] ?? "no" })),
  }));
}
