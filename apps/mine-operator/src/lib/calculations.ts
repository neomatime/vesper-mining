/**
 * Small, pure calculations shared by several screens: the recovery-progress sentence, how much of a part can still be
 * allocated, and how an operating area's status follows from the issues in it. No state and no I/O, so each is easy to test.
 * Rule to keep: unknown stock is never treated as zero.
 */
import type { Action, InformationQuality, OperationalStatus } from "@vesper/api-contracts";

export function recoverySummary(actions: Action[]) {
  const complete = actions.filter((action) => action.state === "complete").length;
  const inProgress = actions.filter((action) => action.state === "in_progress").length;
  const pending = actions.filter((action) => action.state === "pending" || action.state === "overdue").length;

  return `${complete} complete · ${inProgress} in progress · ${pending} pending`;
}

export function potentiallyAllocable(
  onHand: number | null,
  reserved: number | null,
): number | null {
  if (onHand === null || reserved === null) return null;
  return Math.max(0, onHand - reserved);
}

export function deriveAreaStatus(input: {
  quality: InformationQuality;
  verifiedBlocker: boolean;
  credibleRisk: boolean;
  onPlanEvidence: boolean;
}): OperationalStatus {
  if (["unknown", "stale", "conflicting", "pending_sync"].includes(input.quality)) {
    return "unknown";
  }
  if (input.verifiedBlocker && input.quality === "verified") return "blocked";
  if (input.credibleRisk) return "at_risk";
  if (input.onPlanEvidence && input.quality === "verified") return "on_plan";
  return "unknown";
}

export function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
