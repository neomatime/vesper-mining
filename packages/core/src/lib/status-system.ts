/**
 * One status language for the whole product. Each state belongs to exactly one family, and each family has its own
 * colour AND its own shape, so no status depends on colour alone and "waiting" never looks like "in progress".
 *
 *   done       filled green dot        finished, verified, on plan, ready
 *   active     half-filled green ring  being worked on right now
 *   waiting    empty grey ring         not started yet: scheduled, pending, draft
 *   attention  filled amber dot        needs a look: at risk, shortage, due soon, awaiting something
 *   critical   red square              blocked, critical, overdue, unavailable
 *   reported   grey diamond            information that has been reported but not verified
 *   unknown    dashed grey ring        not known, or managed outside VESPER
 */
export type StatusFamily = "done" | "active" | "waiting" | "attention" | "critical" | "reported" | "unknown";

const families: Record<StatusFamily, string[]> = {
  done: ["on_plan", "verified", "complete", "completed", "ready", "reviewed", "closed", "acknowledged", "available", "resolved", "confirmed"],
  active: ["in_progress", "started", "action_assigned", "resolution_reported"],
  waiting: ["pending", "scheduled", "draft", "not_reviewed", "queued", "not_started", "published"],
  attention: ["at_risk", "potential_shortage", "review_inbound", "needs_confirmation", "due_soon", "awaiting_dependency", "service_due", "partial"],
  critical: ["blocked", "critical", "overdue", "unavailable", "failed"],
  reported: ["reported", "stale", "conflicting"],
  unknown: ["unknown", "external", "cancelled", "retired", "not_applicable"],
};

const lookup = new Map<string, StatusFamily>(
  (Object.keys(families) as StatusFamily[]).flatMap((family) => families[family].map((value) => [value, family] as const)),
);

/** The family a status value belongs to. Anything not listed is treated as unknown rather than guessed. */
export function statusFamily(value: string): StatusFamily {
  return lookup.get(value) ?? "unknown";
}

/** The older four-way tone, kept so existing styles and tests keep working. */
export function statusTone(family: StatusFamily): "positive" | "warning" | "danger" | "neutral" {
  if (family === "done") return "positive";
  if (family === "critical") return "danger";
  if (family === "attention" || family === "active") return "warning";
  return "neutral";
}
