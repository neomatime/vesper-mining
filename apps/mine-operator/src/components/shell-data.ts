"use client";

import { useQuery } from "@tanstack/react-query";
import type { MapArea, Member, OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { demoFetch } from "@/lib/api";
import type { EquipmentView } from "@/lib/equipment-rules";
import type { ShiftView } from "@/lib/shift-rules";
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

  const data = query.data;
  const counts = {
    openIssues: data ? data.issues.filter((issue) => !finishedStates.has(issue.workflowState)).length : 0,
    readinessAttention: data ? data.readiness.filter((activity) => activity.status !== "ready").length : 0,
    awaitingDependency: data ? data.issues.filter((issue) => issue.workflowState === "awaiting_dependency").length : 0,
  };

  return { data, counts, isLoading: query.isPending };
}
