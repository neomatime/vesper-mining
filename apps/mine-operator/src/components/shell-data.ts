"use client";

/**
 * The data every page shell needs (navigation counts, search records, who is on shift), shared as one cached query so the
 * counts stay correct after any change that refreshes it. Features the subscription does not include are stripped here once, so the
 * rest of the interface cannot show them by accident.
 */
import { useQuery } from "@tanstack/react-query";
import type { MapArea, Member, OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { demoFetch } from "@/lib/api";
import type { EquipmentView } from "@/lib/equipment-rules";
import type { ShiftView } from "@/lib/shift-rules";
import { can } from "@/lib/entitlements";
import { useDemoContext } from "@/stores/demo-context";

export type ShellOverview = {
  issues: OperationalIssue[];
  areas: MapArea[];
  equipment: EquipmentView[];
  readiness: ReadinessActivity[];
  shifts: ShiftView[];
  members: Member[];
  now: string;
};

const finishedStates = new Set(["verified", "closed", "cancelled", "duplicate"]);

/** Shares the Overview query so navigation counts and search stay in step with every mutation that refreshes it. */
export function useShellData() {
  const { context } = useDemoContext();
  const query = useQuery({
    queryKey: ["overview", context.siteId],
    queryFn: () => demoFetch<ShellOverview>("/overview"),
  });

  // Resource Readiness is an Operations capability. Without it the readiness records are not shown anywhere that reads this.
  const readinessIncluded = can(context.tier, "resource_readiness");
  const data = query.data && !readinessIncluded ? { ...query.data, readiness: [] } : query.data;
  const counts = {
    openIssues: data ? data.issues.filter((issue) => !finishedStates.has(issue.workflowState)).length : 0,
    readinessAttention: data ? data.readiness.filter((activity) => activity.status !== "ready").length : 0,
    awaitingDependency: data ? data.issues.filter((issue) => issue.workflowState === "awaiting_dependency").length : 0,
  };

  return { data, counts, isLoading: query.isPending };
}
