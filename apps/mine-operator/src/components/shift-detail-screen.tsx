"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OperationalIssue } from "@vesper/api-contracts";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Clock3, Link2, RotateCcw, Send, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiError, demoFetch, demoSend } from "@/lib/api";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { openDependencies } from "@/lib/issue-rules";
import { useDemoContext } from "@/stores/demo-context";
import { ConfirmDialog } from "./dialog";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { useToast } from "./toast-provider";

type Handover = {
  notes: string;
  state: "draft" | "published" | "acknowledged";
  notesUpdatedAt: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
};

type ShiftResponse = {
  id: string;
  name: string;
  time: string;
  supervisor: string;
  status: string;
  unresolved: number;
  issues: OperationalIssue[];
  handover: Handover;
};

const handoverRoles = ["Shift Supervisor", "Mine Manager"];

export function ShiftDetailScreen({ id, handover = false }: { id: string; handover?: boolean }) {
  const query = useQuery({
    queryKey: ["shift", id],
    queryFn: () => demoFetch<ShiftResponse>(`/shifts/${id}`),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <ShiftDetail shift={query.data} handoverView={handover} />;
}

function ShiftDetail({ shift, handoverView }: { shift: ShiftResponse; handoverView: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { context } = useDemoContext();
  const { handover } = shift;
  const [notes, setNotes] = useState(handover.notes);
  const [confirm, setConfirm] = useState<"withdraw" | null>(null);
  const canManage = handoverRoles.includes(context.role);
  const dirty = notes !== handover.notes;
  const canEditNotes = canManage && handover.state === "draft";
  const isPublisher = handover.publishedBy === context.persona;

  const refresh = async (data?: unknown) => {
    void data;
    await Promise.all(["shift", "workspace", "overview"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };
  const onError = (error: unknown) =>
    toast.push({
      tone: "error",
      title: error instanceof ApiError && error.status === 403 ? "That step is not available to you" : "That did not work",
      detail: error instanceof Error ? error.message : undefined,
    });

  const save = useMutation({
    mutationFn: () => demoSend(`/shifts/${shift.id}/handover`, "PUT", { notes }),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Handover notes saved", detail: "They are still a draft until you publish." });
    },
    onError,
  });
  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await demoSend(`/shifts/${shift.id}/handover`, "PUT", { notes });
      return demoSend(`/shifts/${shift.id}/handover/publish`, "POST");
    },
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Handover published", detail: "The incoming supervisor can now acknowledge it." });
    },
    onError,
  });
  const withdraw = useMutation({
    mutationFn: () => demoSend(`/shifts/${shift.id}/handover/withdraw`, "POST"),
    onSuccess: async () => {
      await refresh();
      setConfirm(null);
      toast.push({ title: "Handover withdrawn", detail: "It is a draft again and can be edited." });
    },
    onError: (error) => {
      setConfirm(null);
      onError(error);
    },
  });
  const acknowledge = useMutation({
    mutationFn: () => demoSend(`/shifts/${shift.id}/acknowledgement`, "POST"),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Handover acknowledged", detail: "Receipt is recorded. The issues themselves remain open." });
    },
    onError,
  });

  const steps = [
    { key: "draft", label: "Draft", detail: handover.notesUpdatedAt ? `Saved ${formatDemoDateTime(handover.notesUpdatedAt)}` : "Not saved yet" },
    { key: "published", label: "Published", detail: handover.publishedAt ? `${handover.publishedBy} · ${formatDemoDateTime(handover.publishedAt)}` : "Waiting for the outgoing supervisor" },
    { key: "acknowledged", label: "Acknowledged", detail: handover.acknowledgedAt ? `${handover.acknowledgedBy} · ${formatDemoDateTime(handover.acknowledgedAt)}` : "Waiting for the incoming supervisor" },
  ] as const;
  const stepIndex = steps.findIndex((step) => step.key === handover.state);

  return (
    <div className="workspace-page">
      <Link href="/shifts" className="back-link"><ArrowLeft /> Shift Control</Link>
      <PageHeader eyebrow={`${shift.name} · ${shift.time}`} title={handoverView ? "Shift handover" : `${shift.name} control`} description={handoverView ? "Review unresolved work and acknowledge receipt without closing or duplicating the underlying issues." : "Review crew context, assigned work and unresolved constraints for the current demonstration shift."} icon={UsersRound} action={<StatusBadge value={shift.status === "In progress" ? "in_progress" : "pending"} label={shift.status} />} />

      <ol className="lifecycle lifecycle--short" aria-label="Handover progress">
        {steps.map((step, index) => (
          <li key={step.key} className={`lifecycle__step lifecycle__step--${index < stepIndex ? "done" : index === stepIndex ? "current" : "todo"}`} aria-current={index === stepIndex ? "step" : undefined}>
            <span className="lifecycle__dot">{index < stepIndex || handover.state === "acknowledged" ? <CheckCircle2 aria-hidden="true" /> : null}</span>
            <span className="lifecycle__label">{step.label}</span>
            <small>{step.detail}</small>
          </li>
        ))}
      </ol>

      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Outstanding coordination</span><h2>{shift.unresolved} items to carry forward</h2></div><Clock3 /></header>
            {shift.issues.length === 0 ? (
              <div className="empty-inline"><strong>Nothing to carry forward</strong><span>Every issue on this shift is verified or closed.</span></div>
            ) : (
              <div className="record-list">
                {shift.issues.map((issue) => {
                  const waiting = openDependencies(issue).length;
                  return (
                    <Link className="record-row" href={`/exceptions/${issue.id}`} key={issue.id}>
                      <span className="record-row__icon"><ClipboardCheck /></span>
                      <span className="record-row__copy">
                        <strong>{issue.title}</strong>
                        <small>{issue.issueNumber} · owner: {issue.owner ?? "not assigned"}{waiting ? ` · ${waiting} open ${waiting === 1 ? "dependency" : "dependencies"}` : ""}</small>
                      </span>
                      {waiting ? <span className="chip chip--inline"><Link2 /> {waiting}</span> : null}
                      <StatusBadge value={issue.workflowState} />
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          {handoverView ? (
            <article className="card handover-notes">
              <label>
                <span>Outgoing supervisor notes</span>
                <textarea rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} readOnly={!canEditNotes} aria-describedby="handover-note-help" />
              </label>
              <p id="handover-note-help">
                {handover.state !== "draft"
                  ? "Published notes are locked. Withdraw the handover to edit them."
                  : canManage
                    ? "Write what the incoming shift must know. These are fictional demo notes."
                    : `Viewing as ${context.role}. Handover is managed by a Shift Supervisor or the Mine Manager.`}
              </p>
              {canEditNotes ? (
                <div className="button-row button-row--end">
                  <button className="button button--quiet" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : dirty ? "Save draft" : "Saved"}</button>
                  <button className="button button--primary" disabled={publish.isPending || notes.trim().length < 20} onClick={() => publish.mutate()}><Send /> {publish.isPending ? "Publishing…" : "Publish handover"}</button>
                </div>
              ) : null}
              {canEditNotes && notes.trim().length < 20 ? <small className="field-hint">Write at least twenty characters to publish.</small> : null}
            </article>
          ) : null}
        </div>

        <aside className="detail-layout__aside">
          <article className="card next-action-card">
            <span className="eyebrow">Handover state</span>
            <h2>{handover.state === "acknowledged" ? "Receipt acknowledged" : handover.state === "published" ? "Ready for incoming review" : handoverView ? "Draft in preparation" : "Handover preparation open"}</h2>
            <p>Acknowledgement confirms receipt of information only. It does not resolve issues, grant safety clearance or change accountable ownership.</p>
            {handover.state === "acknowledged" ? (
              <div className="inline-success"><CheckCircle2 /> Acknowledged by {handover.acknowledgedBy} at {handover.acknowledgedAt ? formatDemoDateTime(handover.acknowledgedAt) : ""}</div>
            ) : !handoverView ? (
              <Link className="button button--primary button--wide" href={`/shifts/${shift.id}/handover`}>{handover.state === "published" ? "Review handover" : "Prepare handover"}</Link>
            ) : handover.state === "published" ? (
              <>
                <button className="button button--primary button--wide" disabled={!canManage || isPublisher || acknowledge.isPending} onClick={() => acknowledge.mutate()}>{acknowledge.isPending ? "Recording…" : "Acknowledge handover"}</button>
                {isPublisher ? <small className="step-buttons__reason">The incoming supervisor acknowledges, not the person who published it.</small> : null}
                {!canManage ? <small className="step-buttons__reason">Only a Shift Supervisor or the Mine Manager can acknowledge.</small> : null}
                {(isPublisher || context.role === "Mine Manager") ? <button className="button button--quiet button--wide" onClick={() => setConfirm("withdraw")}><RotateCcw /> Withdraw handover</button> : null}
              </>
            ) : (
              <small className="step-buttons__reason">Publish the notes first. The incoming supervisor can then acknowledge.</small>
            )}
          </article>
        </aside>
      </section>

      {confirm === "withdraw" ? (
        <ConfirmDialog
          title="Withdraw this handover?"
          body="It returns to a draft so the notes can be edited. Nothing about the issues changes."
          confirmLabel="Withdraw handover"
          pending={withdraw.isPending}
          onConfirm={() => withdraw.mutate()}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
