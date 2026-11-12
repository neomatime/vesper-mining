import type { ReadinessActivity } from "@vesper/api-contracts";
import { potentiallyAllocable } from "./calculations";

type Part = ReadinessActivity["parts"][number];

export type PartPosition = "unknown" | "short" | "needs_inbound" | "covered";

export function partPosition(part: Part): PartPosition {
  const allocable = potentiallyAllocable(part.onHand, part.reserved);
  if (allocable === null) return "unknown";
  if (allocable >= part.required) return "covered";
  return allocable + (part.inbound ?? 0) >= part.required ? "needs_inbound" : "short";
}

/**
 * Readiness follows BR-008 and BR-010: unknown stock is never zero, a confirmed shortage is distinct
 * from a possible one, and reported figures never become "ready" on their own.
 */
export function deriveReadinessStatus(parts: Part[]): ReadinessActivity["status"] {
  const positions = parts.map((part) => partPosition(part));
  if (positions.includes("short")) return "potential_shortage";
  if (positions.includes("unknown")) return "needs_confirmation";
  if (positions.includes("needs_inbound")) return "review_inbound";
  const allVerified = parts.every((part) => part.quality === "verified");
  return allVerified ? "ready" : "needs_confirmation";
}

const DAY = 86_400_000;

/** Indicative latest date to start a purchasing review: need date minus the longest lead time and a buffer. */
export function indicativeOrderBy(scheduledFor: string, parts: Part[], bufferDays = 3): string | null {
  const leads = parts
    .filter((part) => partPosition(part) !== "covered")
    .map((part) => part.leadTimeDays)
    .filter((lead): lead is number => lead !== null);
  if (leads.length === 0) return null;
  return new Date(Date.parse(scheduledFor) - (Math.max(...leads) + bufferDays) * DAY).toISOString();
}
