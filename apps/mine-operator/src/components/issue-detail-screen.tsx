"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OperationalIssue } from "@vesper/api-contracts";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { formatStatus, recoverySummary } from "@/lib/calculations";
import { ErrorState, LoadingState } from "./query-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

export function IssueDetailScreen({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["issue", id],
    queryFn: () => demoFetch<OperationalIssue>(`/issues/${id}`),
  });
  const mutation = useMutation({
    mutationFn: () =>
      demoFetch<OperationalIssue>(`/issues/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ workflowState: "resolution_reported", quality: "reported" }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issue", id] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["workspace", "exceptions"] });
    },
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const issue = query.data;

  return (
    <div className="workspace-page">
      <Link className="back-link" href="/exceptions"><ArrowLeft /> Work & Exceptions</Link>
      <PageHeader
        eyebrow={`${issue.issueNumber} · ${formatStatus(issue.workflowState)}`}
        title={issue.title}
        description={issue.description}
        action={<StatusBadge value={issue.operationalStatus} />}
      />
      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Current coordination state</span><h2>Issue summary</h2></div><StatusBadge value={issue.quality} /></header>
            <dl className="definition-grid">
              <div><dt>Accountable owner</dt><dd><UserRound /> {issue.owner ?? "Owner pending"}</dd></div>
              <div><dt>Workflow state</dt><dd>{formatStatus(issue.workflowState)}</dd></div>
              <div><dt>Reported</dt><dd><Clock3 /> 24 Apr 2025 · 08:05 demo time</dd></div>
              <div><dt>Source</dt><dd>{issue.source.label}</dd></div>
              <div><dt>Equipment</dt><dd><Link href={`/equipment/${issue.equipmentId}`}>{issue.equipmentId === "eq-crusher-c02" ? "Crusher C-02" : issue.equipmentId}</Link></dd></div>
              <div><dt>Operating area</dt><dd><Link href="/map">Crusher Line · open map evidence</Link></dd></div>
            </dl>
            <div className="evidence-callout"><ShieldCheck /><div><strong>Reported information is not operational clearance</strong><p>Repair completion, independent verification, authorised release and operation resumption remain distinct events.</p></div></div>
          </article>
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Action and dependency flow</span><h2>Recovery actions</h2></div><span>{recoverySummary(issue.actions)}</span></header>
            <div className="action-list action-list--detailed">
              {issue.actions.map((action, index) => (
                <div className="action-row" key={action.id}>
                  <span className={`action-row__marker action-row__marker--${action.state}`}>{action.state === "complete" ? <CheckCircle2 /> : index + 1}</span>
                  <div><strong>{action.title}</strong><small>{action.team} · {action.owner}{action.dueAt ? " · deadline recorded" : ""}</small></div>
                  <StatusBadge value={action.state} />
                </div>
              ))}
            </div>
          </article>
        </div>
        <aside className="detail-layout__aside">
          <article className="card next-action-card">
            <span className="eyebrow">Next appropriate action</span>
            <h2>Confirm the spare-part dependency</h2>
            <p>Review stock, reservations, inbound supply and information quality before mobilisation.</p>
            <Link className="button button--primary button--wide" href="/resources/readiness-ex204-1000h">Open readiness evidence</Link>
          </article>
          <article className="card timeline-card">
            <span className="eyebrow">Evidence history</span>
            <h2>Issue timeline</h2>
            <ol>
              <li><span /><div><strong>Issue reported</strong><small>08:05 · simulated field report</small></div></li>
              <li><span /><div><strong>Fault assessment recorded</strong><small>08:22 · Maintenance</small></div></li>
              <li><span /><div><strong>Dependency identified</strong><small>08:31 · spare part confirmation</small></div></li>
              {issue.workflowState === "resolution_reported" ? <li><span /><div><strong>Resolution reported</strong><small>08:47 · requires independent verification</small></div></li> : null}
            </ol>
          </article>
          {issue.workflowState !== "resolution_reported" ? (
            <button className="button button--quiet button--wide" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Recording…" : "Record resolution reported"}
            </button>
          ) : <div className="inline-success"><CheckCircle2 /> Resolution reported. Independent verification is still required.</div>}
          <p className="confirmation-note">Demo action only. No real equipment status or safety authorisation changed.</p>
        </aside>
      </section>
    </div>
  );
}
