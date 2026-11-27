"use client";

/**
 * React hook over the subscription check. See lib/entitlements.ts for the rules.
 */
import type { FeatureCode } from "@vesper/api-contracts";
import { can } from "@core/lib/entitlements";
import { useDemoContext } from "@core/stores/demo-context";

/** Whether the selected subscription includes a feature. For navigation and presentation only: it is not access control. */
export function useFeature(feature: FeatureCode) {
  return can(useDemoContext((state) => state.context.tier), feature);
}
