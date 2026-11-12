import type { Member } from "@vesper/api-contracts";
import type { Actor, Check } from "./issue-rules";

export type RoleInfo = { role: string; scope: string; home: string; fieldOnly: boolean };

/** The roles a person can hold. Each starts on its own page after signing in (App Flow §2.4). */
export const roleCatalogue: RoleInfo[] = [
  { role: "Mine Manager", scope: "Management visibility and administration", home: "/overview", fieldOnly: false },
  { role: "Shift Supervisor", scope: "Shift control and handover", home: "/shifts", fieldOnly: false },
  { role: "Maintenance Planner", scope: "Equipment and readiness", home: "/equipment", fieldOnly: false },
  { role: "Stores / Inventory Controller", scope: "Parts and stock", home: "/resources", fieldOnly: false },
  { role: "Field Employee", scope: "Field execution on VESPER Mobile", home: "/mobile/my-shift", fieldOnly: true },
];

export const roleNames = roleCatalogue.map((item) => item.role);

export function roleInfo(role: string) {
  return roleCatalogue.find((item) => item.role === role);
}

export function homeFor(role: string) {
  return roleInfo(role)?.home ?? "/overview";
}

export function canManageOrganisation(actor: Actor): Check {
  return actor.role === "Mine Manager"
    ? { allowed: true }
    : { allowed: false, reason: "Only the Mine Manager can change people, site and company details." };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string) {
  return EMAIL.test(value.trim());
}

export const normaliseEmail = (value: string) => value.trim().toLowerCase();

export function activeMembers(members: Member[]) {
  return members.filter((member) => member.status !== "deactivated");
}

/** An active Mine Manager must always remain, or nobody could administer the organisation. */
export function isLastManager(members: Member[], target: Member) {
  if (target.role !== "Mine Manager" || target.status === "deactivated") return false;
  return !members.some((member) => member.id !== target.id && member.role === "Mine Manager" && member.status !== "deactivated");
}

export const memberStatusLabels = { active: "Active", invited: "Invited", deactivated: "Deactivated" } as const;

export const timezones = ["Africa/Johannesburg", "Africa/Harare", "Africa/Windhoek", "Africa/Gaborone", "Africa/Maputo", "Africa/Lusaka", "Africa/Accra", "Australia/Perth", "UTC"];
