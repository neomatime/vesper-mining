"use client";

import { useQuery } from "@tanstack/react-query";
import type { MapArea, OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { demoFetch } from "@/lib/api";
import { useDemoContext } from "@/stores/demo-context";

export type ShellOverview = {
  issues: OperationalIssue[];
  areas: MapArea[];
  equipment: { id: string; code: string; name: string; area: string; state: string }[];
  readiness: ReadinessActivity[];
  shifts: { id: string; name: string; time: string; supervisor: string; status: string; unresolved: number }[];
};

const finishedStates = new Set(["verified", "closed", "cancelled", "duplicate"]);

/** Shares the Overview query so navigation counts and search stay in step with every mutation that refreshes it. */
export function useShellData() {
  const { context } = useDemoContext();
  const query = useQuery({
    queryKey: ["overview", context.siteId],
    queryFn: () => demoFetch<ShellOverview>("/overview"),
  });

  const data = query.data;
  const counts = {
    openIssues: data ? data.issues.filter((issue) => !finishedStates.has(issue.workflowState)).length : 0,
    readinessAttention: data ? data.readiness.filter((activity) => activity.status !== "ready").length : 0,
    awaitingDependency: data ? data.issues.filter((issue) => issue.workflowState === "awaiting_dependency").length : 0,
  };

  return { data, counts, isLoading: query.isPending };
}
