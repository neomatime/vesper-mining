import type { DemoContext } from "@vesper/api-contracts";
import { tiers } from "./personas";

type Tier = DemoContext["tier"];

/**
 * Demonstration entitlements (PRD §11, BR-014 to BR-016). They shape the interface for
 * user-experience validation only. Hiding a control is not access control; real enforcement
 * belongs in future backend services (BR-019).
 */
export function entitlementsFor(tier: Tier) {
  const found = tiers.find((item) => item.value === tier) ?? tiers[0];
  return {
    label: found.label,
    sites: found.sites,
    mobile: found.mobile,
    reporting: found.reporting,
    advancedAnalytics: found.advancedAnalytics,
  };
}

/** The lowest subscription that includes a capability, for "upgrade" messaging. */
export function tierThatIncludes(capability: "mobile" | "advancedAnalytics") {
  return tiers.find((item) => item[capability])?.label ?? "a higher subscription";
}

export const entitlementRows: { label: string; read: (tier: Tier) => string }[] = [
  { label: "Sites", read: (tier) => entitlementsFor(tier).sites },
  { label: "VESPER Mobile", read: (tier) => (entitlementsFor(tier).mobile ? "Included" : "Not included") },
  { label: "Reporting", read: (tier) => entitlementsFor(tier).reporting },
  { label: "Advanced analytics", read: (tier) => (entitlementsFor(tier).advancedAnalytics ? "Included" : "Not included") },
];
