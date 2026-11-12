import type { EquipmentCategory, InviteState, RequestStatus, ServiceProvider, ServiceRequest } from "@vesper/api-contracts";
import type { Actor, Check } from "./issue-rules";

/** Only the Mine Manager keeps the list of providers approved for the mine. */
export function canManageProviders(actor: Actor): Check {
  return actor.role === "Mine Manager"
    ? { allowed: true }
    : { allowed: false, reason: "Only the Mine Manager can add, edit or remove service providers." };
}

/** Requesting and comparing quotes is for the people who plan maintenance. */
export function canRequestService(actor: Actor): Check {
  return actor.role === "Mine Manager" || actor.role === "Maintenance Planner"
    ? { allowed: true }
    : { allowed: false, reason: "Service requests are made by the Mine Manager or the Maintenance Planner." };
}

export const urgencyLabels = { routine: "Routine", urgent: "Urgent", critical: "Critical" } as const;

export const requestStatusLabels: Record<RequestStatus, string> = {
  open: "Awaiting quotes",
  awarded: "Provider chosen",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const inviteStateLabels: Record<InviteState, string> = {
  sent: "Awaiting reply",
  quoted: "Quote received",
  declined: "Declined",
  accepted: "Chosen",
  not_selected: "Not selected",
};

/** A provider is approved today when it is active and its approval has not run out. */
export function isApproved(provider: Pick<ServiceProvider, "active" | "approvedUntil">, today: string) {
  if (!provider.active) return false;
  return !provider.approvedUntil || provider.approvedUntil >= today.slice(0, 10);
}

export function approvalLabel(provider: Pick<ServiceProvider, "active" | "approvedUntil">, today: string) {
  if (!provider.active) return "Deactivated";
  if (!provider.approvedUntil) return "Approved";
  return provider.approvedUntil >= today.slice(0, 10) ? `Approved until ${provider.approvedUntil}` : `Approval expired ${provider.approvedUntil}`;
}

/** Providers that can be asked to quote for a category of equipment. */
export function eligibleProviders(providers: ServiceProvider[], category: EquipmentCategory, today: string) {
  return providers.filter((provider) => isApproved(provider, today) && provider.categories.includes(category));
}

export const isOpenRequest = (request: Pick<ServiceRequest, "status">) => request.status === "open" || request.status === "awarded" || request.status === "scheduled";

export const formatMoney = (amount: number) => `R ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
