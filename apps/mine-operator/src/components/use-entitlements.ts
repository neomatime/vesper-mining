"use client";

import type { FeatureCode } from "@vesper/api-contracts";
import { can } from "@/lib/entitlements";
import { useDemoContext } from "@/stores/demo-context";

/** Whether the selected subscription includes a feature. For navigation and presentation only: it is not access control. */
export function useFeature(feature: FeatureCode) {
  return can(useDemoContext((state) => state.context.tier), feature);
}
