"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReadinessActivity, ReadinessDecision } from "@vesper/api-contracts";
import { ArrowLeft, CalendarClock, CheckCircle2, PackageCheck, Pencil, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiError, demoFetch, demoSend } from "@/lib/api";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { formatStatus, potentiallyAllocable } from "@/lib/calculations";
import { indicativeOrderBy, partPosition } from "@/lib/readiness-rules";
import { useDemoContext } from "@/stores/demo-context";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { useToast } from "./toast-provider";

type Part = ReadinessActivity["parts"][number];

const decisions: { value: ReadinessDecision; label: string; hint: string }[] = [
  { value: "confirm_stock", label: "Stock is confirmed", hint: "The figures have been checked with stores." },
  { value: "purchase_review", label: "Start a purchasing review", hint: "Ask procurement to review. Nothing is ordered from here." },
  { value: "escalate", label: "Escalate to the Mine Manager", hint: "The risk to the service date is material." },
  { value: "defer", label: "Defer for now", hint: "Revisit once more information arrives." },
];

const reviewerRoles = ["Maintenance Planner", "Stores / Inventory Controller", "Mine Manager"];

const readinessLabels: Record<ReadinessActivity["status"], string> = {
  ready: "Ready",
  review_inbound: "Inbound supply to review",
  potential_shortage: "Potential shortage",
  needs_confirmation: "Needs confirmation",
  overdue: "Overdue",
};

export function ReadinessDetailScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["readiness", id],
    queryFn: () => demoFetch<ReadinessActivity>(`/readiness/${id}`),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <ReadinessDetail activity={query.data} />;
}

function ReadinessDetail({ activity }: { activity: ReadinessActivity }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { context } = useDemoContext();
  const [dialog, setDialog] = useState<{ kind: "review" } | { kind: "part"; part: Part } | null>(null);
  const canRecord = reviewerRoles.includes(context.role);
  const isStores = context.role === "Stores / Inventory Controller";
  const orderBy = indicativeOrderBy(activity.scheduledFor, activity.parts);
  const needsAttention = activity.parts.some((part) => partPosition(part) !== "covered");
  const latest = activity.reviews.at(-1);

  const refresh = async (data: ReadinessActivity) => {
    queryClient.setQueryData(["readiness", activity.id], data);
    await Promise.all(["workspace", "overview", "notifications"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };
  const onError = (error: unknown) =>
    toast.push({
      tone: "error",
      title: error instanceof ApiError && error.status === 403 ? "That step is not available to you" : "Check the details",
      detail: error instanceof Error ? error.message : undefined,
    });

  const review = useMutation({
    mutationFn: (input: { decision: ReadinessDecision; note: string }) =>
      demoSend<ReadinessActivity>(`/readiness/${activity.id}/reviews`, "POST", input),
    onSuccess: async (data) => {
      await refresh(data);
      toast.push({ title: "Review recorded", detail: "No purchase was approved or submitted." });
    },
    onError,
  });

  const savePart = useMutation({
    mutationFn: ({ partId, ...input }: { partId: string } & Record<string, unknown>) =>
      demoSend<ReadinessActivity>(`/readiness/${activity.id}/parts/${partId}`, "PATCH", input),
    onSuccess: async (data) => {
      await refresh(data);
      toast.push({ title: "Stock figures saved", detail: `Readiness is now ${readinessLabels[data.status].toLowerCase()}.` });
    },
    onError,
  });

  const close = () => setDialog(null);

  return (
    <div className="workspace-page">
      <Link href="/resources" className="back-link"><ArrowLeft /> Resource Readiness</Link>
      <PageHeader eyebrow="Maintenance-delay prevention" title={activity.title} description="Review required parts, information certainty, inbound supply and the next authorised human action." icon={PackageCheck} action={<StatusBadge value={activity.status} label={readinessLabels[activity.status]} />} />
      <section className="readiness-layout">
        <article className="card readiness-summary">
          <div><span><CalendarClock /></span><small>Scheduled need</small><strong>{formatDemoDateTime(activity.scheduledFor).split(" · ")[0]} 2025</strong><p>Fixture date from the maintenance plan</p></div>
          <div><span><Warehouse /></span><small>Readiness state</small><strong>{readinessLabels[activity.status]}</strong><p>Recalculated whenever stock figures change</p></div>
          <div><span><Truck /></span><small>Indicative order-by</small><strong>{orderBy ? formatDemoDateTime(orderBy).split(" · ")[0] + " 2025" : "Not needed"}</strong><p>{orderBy ? "Longest lead time plus a three-day buffer" : needsAttention ? "A lead time is missing, so no date can be given" : "Every part is covered"}</p></div>
        </article>

        <article className="card detail-card">
          <header className="card__header"><div><span className="eyebrow">Prerequisite evidence</span><h2>Required parts</h2></div><span>No automatic purchase action</span></header>
          <div className="parts-table" role="table" aria-label="Required parts and stock evidence">
            <div className="parts-table__head" role="row"><span>Part</span><span>Required</span><span>Potentially allocable</span><span>Inbound</span><span>Quality</span><span><span className="sr-only">Actions</span></span></div>
            {activity.parts.map((part) => {
              const allocable = potentiallyAllocable(part.onHand, part.reserved);
              return (
                <div className="parts-table__row" role="row" key={part.id}>
                  <span><strong>{part.name}</strong><small>{part.leadTimeDays === null ? "Lead time unknown" : `${part.leadTimeDays}-day lead time`}{part.confirmedBy ? ` · updated by ${part.confirmedBy}` : ""}</small></span>
                  <span>{part.required}</span>
                  <span>{allocable === null ? "Unknown" : allocable}</span>
                  <span>{part.inbound ?? "Unknown"}</span>
                  <StatusBadge value={part.quality} />
                  <span>{canRecord ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "part", part })} aria-label={`Update stock for ${part.name}`}><Pencil /> Update</button> : null}</span>
                </div>
              );
            })}
          </div>
          <div className="evidence-callout"><PackageCheck /><div><strong>Unknown stock is not zero</strong><p>Reported figures stay “Reported” until Stores verifies them. A part is only ready when its figures are verified and cover the requirement.</p></div></div>
        </article>

        <article className="card review-panel">
          <span className="eyebrow">Authorised human review</span>
          <h2>{latest ? "Latest review" : "Review recommended"}</h2>
          {latest ? (
            <div className="review-latest">
              <strong>{decisions.find((item) => item.value === latest.decision)?.label}</strong>
              <p>{latest.note}</p>
              <small>{latest.reviewer} · {latest.role} · {formatDemoDateTime(latest.reviewedAt)}</small>
              <div className="inline-success"><CheckCircle2 /> Demo review only · no order placed</div>
            </div>
          ) : (
            <p>Confirm the maintenance scope, stores evidence and supplier lead time before any external procurement process.</p>
          )}
          {canRecord ? (
            <button className={`button ${latest ? "button--quiet" : "button--primary"}`} onClick={() => setDialog({ kind: "review" })}>{latest ? "Record another review" : "Record review"}</button>
          ) : (
            <p className="confirmation-note">Viewing as {context.role}. Reviews are recorded by the Maintenance Planner, Stores or the Mine Manager.</p>
          )}
        </article>

        {activity.reviews.length > 1 ? (
          <article className="card timeline-card readiness-history">
            <span className="eyebrow">Review history</span>
            <h2>Earlier reviews</h2>
            <ol>
              {[...activity.reviews].reverse().slice(1).map((item) => (
                <li key={item.id}><span /><div><strong>{decisions.find((entry) => entry.value === item.decision)?.label}</strong><q>{item.note}</q><small>{item.reviewer} · {formatDemoDateTime(item.reviewedAt)}</small></div></li>
              ))}
            </ol>
          </article>
        ) : null}
      </section>

      {dialog?.kind === "review" ? <ReviewDialog pending={review.isPending} onClose={close} onSave={(input) => review.mutate(input, { onSuccess: close })} /> : null}
      {dialog?.kind === "part" ? <PartDialog part={dialog.part} canVerify={isStores} pending={savePart.isPending} onClose={close} onSave={(input) => savePart.mutate({ partId: dialog.part.id, ...input }, { onSuccess: close })} /> : null}
    </div>
  );
}

function ReviewDialog({ pending, onSave, onClose }: { pending: boolean; onSave: (input: { decision: ReadinessDecision; note: string }) => void; onClose: () => void }) {
  const [decision, setDecision] = useState<ReadinessDecision>("purchase_review");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = note.trim().length < 8;

  return (
    <Dialog
      title="Record a readiness review"
      description="This records a human review. It does not approve or place any order."
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="button button--primary" disabled={pending} onClick={() => (invalid ? setTouched(true) : onSave({ decision, note: note.trim() }))}>{pending ? "Saving…" : "Record review"}</button>
        </>
      }
    >
      <div className="dialog__stack">
        <fieldset className="choice-group">
          <legend>Decision</legend>
          {decisions.map((item) => (
            <label key={item.value} className={`choice ${decision === item.value ? "choice--selected" : ""}`}>
              <input type="radio" name="decision" value={item.value} checked={decision === item.value} onChange={() => setDecision(item.value)} data-autofocus={decision === item.value ? true : undefined} />
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </label>
          ))}
        </fieldset>
        <Field label="Basis for the decision" error={touched && invalid ? "Add at least eight characters." : undefined}>
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={touched && invalid} />
        </Field>
      </div>
    </Dialog>
  );
}

function PartDialog({ part, canVerify, pending, onSave, onClose }: { part: Part; canVerify: boolean; pending: boolean; onSave: (input: Record<string, unknown>) => void; onClose: () => void }) {
  const text = (value: number | null) => (value === null ? "" : String(value));
  const [onHand, setOnHand] = useState(text(part.onHand));
  const [reserved, setReserved] = useState(text(part.reserved));
  const [inbound, setInbound] = useState(text(part.inbound));
  const [leadTime, setLeadTime] = useState(text(part.leadTimeDays));
  const [source, setSource] = useState("");
  const [verified, setVerified] = useState(false);
  const [touched, setTouched] = useState(false);

  const stockMismatch = (onHand === "") !== (reserved === "");
  const negative = [onHand, reserved, inbound, leadTime].some((value) => value !== "" && (Number.isNaN(Number(value)) || Number(value) < 0));
  const sourceInvalid = source.trim().length < 8;
  const invalid = stockMismatch || negative || sourceInvalid;

  const submit = () => {
    if (invalid) return setTouched(true);
    onSave({
      onHand: onHand === "" ? null : Number(onHand),
      reserved: reserved === "" ? null : Number(reserved),
      inbound: inbound === "" ? null : Number(inbound),
      leadTimeDays: leadTime === "" ? null : Number(leadTime),
      sourceNote: source.trim(),
      confirmation: verified ? "verified" : "reported",
    });
  };

  return (
    <Dialog
      title="Update stock figures"
      description={`${part.name}. Leave a figure blank if it is unknown. Blank is not zero.`}
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="button button--primary" disabled={pending} onClick={submit}>{pending ? "Saving…" : "Save figures"}</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="On hand" error={touched && stockMismatch ? "Record on hand and reserved together, or leave both blank." : undefined}>
          <input data-autofocus inputMode="numeric" value={onHand} onChange={(event) => setOnHand(event.target.value)} />
        </Field>
        <Field label="Reserved">
          <input inputMode="numeric" value={reserved} onChange={(event) => setReserved(event.target.value)} />
        </Field>
        <Field label="Inbound (on order)">
          <input inputMode="numeric" value={inbound} onChange={(event) => setInbound(event.target.value)} />
        </Field>
        <Field label="Supplier lead time (days)">
          <input inputMode="numeric" value={leadTime} onChange={(event) => setLeadTime(event.target.value)} />
        </Field>
        {touched && negative ? <small className="field-error form-field--wide" role="alert">Figures must be zero or more.</small> : null}
        <Field label="Where do these figures come from" hint="For example, a stores count, a supplier confirmation or a system export reference." error={touched && sourceInvalid ? "Add at least eight characters." : undefined} wide>
          <input value={source} onChange={(event) => setSource(event.target.value)} />
        </Field>
        <label className={`choice form-field--wide ${verified ? "choice--selected" : ""} ${canVerify ? "" : "choice--disabled"}`}>
          <input type="checkbox" checked={verified} disabled={!canVerify} onChange={(event) => setVerified(event.target.checked)} />
          <span><strong>Mark as verified</strong><small>{canVerify ? "Confirmed by a physical count or an approved source." : "Only the Stores / Inventory Controller can verify. Your figures will be saved as reported."}</small></span>
        </label>
      </div>
      <small className="field-hint">Current quality: {formatStatus(part.quality)}.</small>
    </Dialog>
  );
}
