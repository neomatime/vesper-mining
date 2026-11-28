"use client";

/**
 * An issue as the field sees it on the phone: what was reported, where, its state, the actions on it and the latest updates.
 * Read-only: reviewing, assigning and verifying happen in Mining Operations.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Clock3, MapPin, UserRound, Wrench } from "lucide-react";
import Link from "next/link";
import type { OperationalIssue } from "@vesper/api-contracts";
import { ErrorState, LoadingState } from "@core/components/query-state";
import { ReportEvidence } from "@core/components/report-evidence";
import { useShellData } from "@core/components/shell-data";
import { StatusBadge } from "@core/components/status-badge";
import { demoFetch } from "@core/lib/api";
import { formatDemoDateTime } from "@core/lib/demo-clock";
import { activeActions, stateLabels } from "@core/lib/issue-rules";

const priorityLabels = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;
const actionLabels = { pending: "Not started", in_progress: "In progress", complete: "Complete", overdue: "Overdue" } as const;

export function MobileIssueScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["issue", id], queryFn: () => demoFetch<OperationalIssue>(`/issues/${id}`) });
  const { data: shell } = useShellData();
  if (query.isPending) return <LoadingState variant="panel" />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;

  const issue = query.data;
  const area = shell?.areas.find((item) => item.id === issue.areaId)?.name;
  const equipment = shell?.equipment.find((item) => item.id === issue.equipmentId)?.name;
  const actions = activeActions(issue);
  const updates = [...issue.events].reverse().slice(0, 5);

  return (
    <div className="mobile-task-page">
      <Link href="/my-reports" className="back-link"><ArrowLeft /> My reports</Link>
      <div className="mobile-page-header">
        <span className="eyebrow">{issue.issueNumber} · {stateLabels[issue.workflowState]}</span>
        <h1>{issue.title}</h1>
        <p>{issue.description}</p>
        <StatusBadge value={issue.operationalStatus} />
      </div>
      <ReportEvidence photos={issue.attachments} location={issue.reportedLocation} />

      <section className="mobile-stack" aria-label="Issue details">
        <article className="mobile-card"><MapPin /><div><small>Where</small><strong>{[area, equipment].filter(Boolean).join(" · ") || "Not recorded"}</strong></div></article>
        <article className="mobile-card"><Clock3 /><div><small>Reported</small><strong>{formatDemoDateTime(issue.reportedAt)}</strong><p>Priority: {priorityLabels[issue.priority]}</p></div></article>
        <article className="mobile-card"><UserRound /><div><small>Owner</small><strong>{issue.owner ?? "Not assigned yet"}</strong></div></article>
      </section>

      <section className="mobile-stack" aria-labelledby="issue-actions">
        <h2 id="issue-actions">Actions</h2>
        {actions.length ? actions.map((action) => (
          <article className="mobile-card" key={action.id}>
            {action.state === "complete" ? <CheckCircle2 /> : action.state === "in_progress" ? <Wrench /> : <Circle />}
            <div><small>{actionLabels[action.state]}</small><strong>{action.title}</strong><p>{action.owner} · {action.team}{action.dueAt ? ` · due ${formatDemoDateTime(action.dueAt)}` : ""}</p></div>
          </article>
        )) : <p className="muted">No actions yet. The supervisor adds them when the issue is reviewed.</p>}
      </section>

      <section className="mobile-stack" aria-labelledby="issue-updates">
        <h2 id="issue-updates">Latest updates</h2>
        {updates.map((event) => (
          <article className="mobile-card" key={event.id}>
            <Clock3 />
            <div><small>{formatDemoDateTime(event.occurredAt)} · {event.actor}</small><strong>{event.summary}</strong>{event.note ? <p>{event.note}</p> : null}</div>
          </article>
        ))}
      </section>

    </div>
  );
}
