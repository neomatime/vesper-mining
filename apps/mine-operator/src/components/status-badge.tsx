import { formatStatus } from "@/lib/calculations";
import { statusFamily, statusTone } from "@/lib/status-system";

const aliases: Record<string, string> = {
  on_plan: "On Plan",
  at_risk: "At Risk",
  blocked: "Blocked",
  unknown: "Unknown",
  pending_sync: "Pending Synchronisation",
};

/** A status as a coloured shape and a word. The shape and the word carry the meaning, so colour is never the only cue. */
export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const family = statusFamily(value);
  return (
    <span className={`status-badge status-badge--${statusTone(family)} status-badge--f-${family}`} data-family={family}>
      <span className="status-badge__dot" aria-hidden="true" />
      {label ?? aliases[value] ?? formatStatus(value)}
    </span>
  );
}
