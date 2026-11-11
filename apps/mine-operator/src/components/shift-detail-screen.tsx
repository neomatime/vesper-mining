"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OperationalIssue } from "@vesper/api-contracts";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Clock3, UsersRound } from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "./query-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

type ShiftResponse = {
  id: string;
  name: string;
  time: string;
  supervisor: string;
  status: string;
  unresolved: number;
  issues: OperationalIssue[];
  handoverAcknowledged: boolean;
};

export function ShiftDetailScreen({ id, handover = false }: { id: string; handover?: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["shift", id],
    queryFn: () => demoFetch<ShiftResponse>(`/shifts/${id}`),
  });
  const mutation = useMutation({
    mutationFn: () => demoFetch<{ acknowledged: boolean; acknowledgedAt: string }>(`/shifts/${id}/acknowledgement`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift", id] }),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const shift = query.data;

  return (
    <div className="workspace-page">
      <Link href="/shifts" className="back-link"><ArrowLeft /> Shift Control</Link>
      <PageHeader eyebrow={`${shift.name} · ${shift.time}`} title={handover ? "Shift handover" : `${shift.name} control`} description={handover ? "Review unresolved work and acknowledge receipt without closing or duplicating the underlying issues." : "Review crew context, assigned work and unresolved constraints for the current demonstration shift."} icon={UsersRound} action={<StatusBadge value={shift.status === "In progress" ? "in_progress" : "pending"} label={shift.status} />} />
      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Outstanding coordination</span><h2>{shift.unresolved} items to carry forward</h2></div><Clock3 /></header>
            <div className="record-list">
              {shift.issues.map((issue) => (
                <Link className="record-row" href={`/exceptions/${issue.id}`} key={issue.id}>
                  <span className="record-row__icon"><ClipboardCheck /></span>
                  <span className="record-row__copy"><strong>{issue.title}</strong><small>{issue.issueNumber} · owner: {issue.owner ?? "pending"}</small></span>
                  <StatusBadge value={issue.workflowState} />
                </Link>
              ))}
            </div>
          </article>
          {handover ? <article className="card handover-notes"><label><span>Outgoing supervisor notes</span><textarea rows={6} defaultValue="Crusher C-02 remains awaiting spare-part confirmation. Continue the original issue and verify evidence before any restoration claim." /></label><p>These are fictional demo notes. Publishing is represented locally only.</p></article> : null}
        </div>
        <aside className="detail-layout__aside">
          <article className="card next-action-card">
            <span className="eyebrow">Handover state</span>
            <h2>{shift.handoverAcknowledged ? "Receipt acknowledged" : handover ? "Ready for incoming review" : "Handover preparation open"}</h2>
            <p>Acknowledgement confirms receipt of information only. It does not resolve issues, grant safety clearance or change accountable ownership.</p>
            {shift.handoverAcknowledged ? <div className="inline-success"><CheckCircle2 /> Acknowledged at 08:47 demo time</div> : handover ? <button className="button button--primary button--wide" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Recording…" : "Acknowledge simulated handover"}</button> : <Link className="button button--primary button--wide" href={`/shifts/${id}/handover`}>Prepare handover</Link>}
          </article>
        </aside>
      </section>
    </div>
  );
}
