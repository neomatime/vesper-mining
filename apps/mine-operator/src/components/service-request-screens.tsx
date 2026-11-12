"use client";

import { useQuery } from "@tanstack/react-query";
import type { ServiceRequest } from "@vesper/api-contracts";
import { ArrowLeft, CalendarCheck, CheckCircle2, Send, Wrench, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { demoFetch } from "@/lib/api";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { categoryLabels, type EquipmentView } from "@/lib/equipment-rules";
import { approvalLabel, canManageProviders, canRequestService, eligibleProviders, formatMoney, inviteStateLabels, requestStatusLabels, urgencyLabels } from "@/lib/service-rules";
import { useDemoContext } from "@/stores/demo-context";
import { CancelRequestDialog, CompleteDialog, ScheduleDialog } from "./service-request-dialogs";
import { Field } from "./form-field";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { useCreateServiceRequest, useProviders, useRequestMutations, useServiceRequest } from "./use-service";

function useEquipment(id: string) {
  return useQuery({ queryKey: ["equipment", id], queryFn: () => demoFetch<EquipmentView>(`/equipment/${id}`) });
}

const inviteTone = { sent: "pending", quoted: "reported", declined: "unknown", accepted: "complete", not_selected: "unknown" } as const;
const statusTone = { open: "pending", awarded: "in_progress", scheduled: "in_progress", completed: "complete", cancelled: "unknown" } as const;

// ---- New request -----------------------------------------------------------------------------------

type NewValues = { title: string; description: string; urgency: string; preferredDate: string; providerIds: string[] };

export function NewServiceRequestScreen({ equipmentId, planId }: { equipmentId: string; planId: string | null }) {
  const { context } = useDemoContext();
  const equipment = useEquipment(equipmentId);
  const providers = useProviders();
  const { data: shell } = useShellData();
  const create = useCreateServiceRequest(equipmentId);
  const actor = { name: context.persona, role: context.role };
  const plan = equipment.data?.plans.find((item) => item.id === planId);
  const form = useForm<NewValues>({ values: { title: plan ? `${plan.name}` : "", description: "", urgency: "routine", preferredDate: "", providerIds: [] } });
  const [error, setError] = useState("");

  if (equipment.isPending || providers.isPending) return <LoadingState />;
  if (equipment.isError) return <ErrorState message={equipment.error.message} onRetry={() => equipment.refetch()} />;
  const item = equipment.data;

  if (!canRequestService(actor).allowed) {
    return (
      <div className="workspace-page">
        <Link href={`/equipment/${item.id}`} className="back-link"><ArrowLeft /> {item.name}</Link>
        <section className="card detail-card restricted">
          <h2>Service requests are made by the Mine Manager or the Maintenance Planner</h2>
          <p>Ask them to request service for {item.name}.</p>
        </section>
      </div>
    );
  }

  const eligible = eligibleProviders(providers.data ?? [], item.category, shell?.now ?? "");
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) => {
    if (values.title.trim().length < 4) return setError("Describe the work in at least four characters.");
    if (values.providerIds.length === 0) return setError("Choose at least one service provider to ask.");
    setError("");
    create.mutate({ equipmentId: item.id, planId: plan?.id ?? null, title: values.title, description: values.description, urgency: values.urgency, preferredDate: values.preferredDate, providerIds: values.providerIds });
  });

  return (
    <div className="workspace-page">
      <Link href={`/equipment/${item.id}`} className="back-link"><ArrowLeft /> {item.name}</Link>
      <PageHeader eyebrow={`${item.code} · ${categoryLabels[item.category]}`} title="Request service" description={`Ask approved service providers to quote for work on ${item.name}.`} icon={Wrench} />

      <form onSubmit={submit} noValidate className="detail-layout">
        <div className="detail-layout__main">
          <section className="card detail-card" aria-labelledby="work-heading">
            <header className="card__header"><div><span className="eyebrow">The job</span><h2 id="work-heading">What needs doing</h2></div></header>
            <div className="form-grid form-grid--card">
              <Field label="Work required" error={errors.title?.message} wide>
                <input data-autofocus placeholder="For example, 500 hour inspection" {...form.register("title")} />
              </Field>
              <Field label="Details for the provider" wide><textarea rows={4} {...form.register("description")} /></Field>
              <Field label="Urgency">
                <select {...form.register("urgency")}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
              <Field label="Preferred date"><input type="date" {...form.register("preferredDate")} /></Field>
            </div>
            {plan ? <p className="card-note">This request is linked to the maintenance plan “{plan.name}”. Completing it resets that plan.</p> : null}
          </section>
        </div>

        <aside className="detail-layout__aside">
          <section className="card detail-card" aria-labelledby="providers-heading">
            <header className="card__header"><div><span className="eyebrow">Who to ask</span><h2 id="providers-heading">Approved providers</h2></div></header>
            {eligible.length === 0 ? (
              <div className="empty-inline">
                <strong>No approved provider for {categoryLabels[item.category].toLowerCase()} equipment</strong>
                <span>{canManageProviders(actor).allowed ? <>Add one under <Link href="/admin">Administration</Link>.</> : "Ask the Mine Manager to add one under Administration."}</span>
              </div>
            ) : (
              <ul className="provider-pick">
                {eligible.map((provider) => (
                  <li key={provider.id}>
                    <label className="check-option check-option--card">
                      <input type="checkbox" value={provider.id} {...form.register("providerIds")} />
                      <span><strong>{provider.name}</strong><small>{approvalLabel(provider, shell?.now ?? "")}{provider.contactName ? ` · ${provider.contactName}` : ""}</small></span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="card-note">Only providers already approved for this mine are shown. After sending, give each provider their private reply link. They submit their own quote.</p>
          </section>
          {error ? <p className="signin__error" role="alert">{error}</p> : null}
          <button className="button button--primary button--wide button--large" disabled={create.isPending || eligible.length === 0}><Send /> {create.isPending ? "Sending…" : "Send request"}</button>
        </aside>
      </form>
    </div>
  );
}

/** The private page where the provider sends their own quote. The mine copies it to them and never types the quote. */
function ReplyLink({ name, token }: { name: string; token: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/provider/respond/${token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="reply-link">
      <label>
        <span>Reply link for {name}</span>
        <input readOnly aria-label={`Reply link for ${name}`} value={link} onFocus={(event) => event.currentTarget.select()} />
      </label>
      <button type="button" className="button button--quiet button--small" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}

// ---- Request detail --------------------------------------------------------------------------------

type DialogState =
  | { kind: "schedule" }
  | { kind: "complete" }
  | { kind: "cancel" };

export function ServiceRequestScreen({ equipmentId, requestId }: { equipmentId: string; requestId: string }) {
  const equipment = useEquipment(equipmentId);
  const request = useServiceRequest(requestId);
  if (equipment.isPending || request.isPending) return <LoadingState />;
  if (equipment.isError) return <ErrorState message={equipment.error.message} onRetry={() => equipment.refetch()} />;
  if (request.isError) return <ErrorState message={request.error.message} onRetry={() => request.refetch()} />;
  return <RequestDetail equipment={equipment.data} request={request.data} />;
}

function RequestDetail({ equipment, request }: { equipment: EquipmentView; request: ServiceRequest }) {
  const { context } = useDemoContext();
  const actions = useRequestMutations(request);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const actor = { name: context.persona, role: context.role };
  const canAct = canRequestService(actor).allowed;
  const close = () => setDialog(null);
  const live = request.status !== "completed" && request.status !== "cancelled";
  const awardable = request.status === "open";
  const quoted = request.invites.filter((invite) => invite.quote?.amount !== null && invite.quote !== null && invite.state !== "declined");
  const lowest = quoted.length > 1 ? Math.min(...quoted.map((invite) => invite.quote?.amount ?? Infinity)) : null;
  const awarded = request.invites.find((invite) => invite.id === request.awardedInviteId);
  const plan = equipment.plans.find((item) => item.id === request.planId);

  return (
    <div className="workspace-page">
      <Link href={`/equipment/${equipment.id}`} className="back-link"><ArrowLeft /> {equipment.name}</Link>
      <PageHeader
        eyebrow={`${request.number} · ${equipment.code}`}
        title={request.title}
        description={`Service request for ${equipment.name}.`}
        icon={Wrench}
        action={
          <div className="header-actions">
            <StatusBadge value={statusTone[request.status]} label={requestStatusLabels[request.status]} />
            {canAct && (request.status === "awarded" || request.status === "scheduled") ? (
              <>
                <button className="button button--quiet" onClick={() => setDialog({ kind: "schedule" })}><CalendarCheck /> {request.scheduledFor ? "Change booking" : "Book the work"}</button>
                <button className="button button--primary" onClick={() => setDialog({ kind: "complete" })}><CheckCircle2 /> Mark complete</button>
              </>
            ) : null}
            {canAct && live ? <button className="button button--quiet" onClick={() => setDialog({ kind: "cancel" })}><XCircle /> Cancel request</button> : null}
          </div>
        }
      />

      <div className="detail-layout">
        <div className="detail-layout__main">
          <section className="card detail-card" aria-labelledby="quotes-heading">
            <header className="card__header"><div><span className="eyebrow">Replies</span><h2 id="quotes-heading">Providers and quotes</h2></div></header>
            <ul className="invite-list">
              {request.invites.map((invite) => {
                const quote = invite.quote;
                return (
                  <li className={`invite invite--${invite.state}`} key={invite.id}>
                    <div className="invite__head">
                      <strong>{invite.providerName}</strong>
                      <StatusBadge value={inviteTone[invite.state]} label={inviteStateLabels[invite.state]} />
                      {lowest !== null && quote && quote.amount === lowest ? <span className="tag-lowest">Lowest quote</span> : null}
                    </div>
                    {quote ? (
                      <dl className="invite__quote">
                        <div><dt>Quoted</dt><dd>{quote.amount !== null ? formatMoney(quote.amount) : "—"}</dd></div>
                        {quote.reference ? <div><dt>Reference</dt><dd>{quote.reference}</dd></div> : null}
                        {quote.availableFrom ? <div><dt>Can start</dt><dd>{quote.availableFrom}</dd></div> : null}
                        {quote.validUntil ? <div><dt>Valid until</dt><dd>{quote.validUntil}</dd></div> : null}
                      </dl>
                    ) : null}
                    {quote?.notes ? <p className="invite__note">{quote.notes}</p> : null}
                    {invite.state === "declined" ? <p className="invite__note">Declined: {invite.declinedReason}</p> : null}
                    {request.status === "open" && invite.state === "sent" ? <p className="invite__note">Waiting for {invite.providerName} to reply.</p> : null}
                    {canAct && request.status === "open" && invite.state !== "declined" ? (
                      <div className="invite__actions">
                        {invite.state === "quoted" && awardable ? <button className="button button--primary button--small" disabled={actions.award.isPending} onClick={() => actions.award.mutate(invite.id)}>Choose this provider</button> : null}
                      </div>
                    ) : null}
                    {canAct && request.status === "open" && invite.state !== "declined" ? <ReplyLink name={invite.providerName} token={invite.token} /> : null}
                  </li>
                );
              })}
            </ul>
            <p className="card-note">Send each provider their reply link. Quotes appear here when the provider submits them, and you cannot change them. Choosing a provider records your decision only. VESPER does not place orders or make payments.</p>
          </section>
        </div>

        <aside className="detail-layout__aside">
          <section className="card detail-card" aria-labelledby="summary-heading">
            <header className="card__header"><div><span className="eyebrow">Request</span><h2 id="summary-heading">Summary</h2></div></header>
            <dl className="definition-grid definition-grid--single">
              <div><dt>Equipment</dt><dd><Link href={`/equipment/${equipment.id}`}>{equipment.name}</Link></dd></div>
              <div><dt>Urgency</dt><dd>{urgencyLabels[request.urgency]}</dd></div>
              <div><dt>Preferred date</dt><dd>{request.preferredDate ?? "Not set"}</dd></div>
              {plan ? <div><dt>Maintenance plan</dt><dd>{plan.name}</dd></div> : null}
              {awarded ? <div><dt>Chosen provider</dt><dd>{awarded.providerName}</dd></div> : null}
              {request.scheduledFor ? <div><dt>Booked for</dt><dd>{request.scheduledFor}</dd></div> : null}
              {request.cancelledReason ? <div><dt>Cancelled because</dt><dd>{request.cancelledReason}</dd></div> : null}
              <div><dt>Requested by</dt><dd>{request.createdBy} · {formatDemoDateTime(request.createdAt)}</dd></div>
            </dl>
            {request.description ? <p className="prose">{request.description}</p> : null}
          </section>

          <section className="card detail-card" aria-labelledby="history-heading">
            <header className="card__header"><div><span className="eyebrow">History</span><h2 id="history-heading">Activity</h2></div></header>
            <ol className="timeline">
              {[...request.events].reverse().map((event) => (
                <li key={event.id}><strong>{event.summary}</strong><small>{event.actor} · {formatDemoDateTime(event.at)}</small></li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {dialog?.kind === "schedule" ? (
        <ScheduleDialog current={request.scheduledFor} pending={actions.schedule.isPending} onClose={close} onSave={(date) => actions.schedule.mutate({ date }, { onSuccess: close })} />
      ) : null}
      {dialog?.kind === "complete" ? (
        <CompleteDialog title={request.title} hasPlan={Boolean(plan)} pending={actions.complete.isPending} onClose={close} onSave={(values) => actions.complete.mutate({ ...values, performedAt: "" }, { onSuccess: close })} />
      ) : null}
      {dialog?.kind === "cancel" ? (
        <CancelRequestDialog pending={actions.cancel.isPending} onClose={close} onSave={(reason) => actions.cancel.mutate({ reason }, { onSuccess: close })} />
      ) : null}
    </div>
  );
}
