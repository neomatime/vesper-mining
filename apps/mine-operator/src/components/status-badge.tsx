import { formatStatus } from "@/lib/calculations";

const aliases: Record<string, string> = {
  on_plan: "On Plan",
  at_risk: "At Risk",
  blocked: "Blocked",
  unknown: "Unknown",
  pending_sync: "Pending Synchronisation",
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const tone = ["on_plan", "verified", "complete", "ready", "reviewed"].includes(value)
    ? "positive"
    : ["blocked", "critical", "overdue"].includes(value)
      ? "danger"
      : ["at_risk", "reported", "pending", "in_progress", "potential_shortage", "review_inbound"].includes(value)
        ? "warning"
        : "neutral";

  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {label ?? aliases[value] ?? formatStatus(value)}
    </span>
  );
}
