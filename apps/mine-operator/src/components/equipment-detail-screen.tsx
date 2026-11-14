"use client";

import { useQuery } from "@tanstack/react-query";
import type { MaintenancePlan } from "@vesper/api-contracts";
import {
  AlertTriangle,
  ArrowLeft,
  Gauge,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { demoFetch } from "@/lib/api";
import { formatStatus } from "@/lib/calculations";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { downtimePeriods, downtimeWithin, formatDuration } from "@/lib/downtime";
import { canActOnEquipment, categoryLabels, downtimeReasonLabels, planTone, type EquipmentView } from "@/lib/equipment-rules";
import { stateLabels as issueStateLabels } from "@/lib/issue-rules";
import { useDemoContext } from "@/stores/demo-context";
import { ConfirmDialog } from "./dialog";
import { MoreMenu } from "./more-menu";
import { EquipmentFormDialog, PlanDialog, ReadingDialog, RetireDialog, ServiceDialog, StateDialog } from "./equipment-dialogs";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { useEquipmentMutations } from "./use-equipment-mutations";
import { useServiceRequests } from "./use-service";
import { canRequestService, isOpenRequest, requestStatusLabels } from "@/lib/service-rules";

type DialogState =
  | { kind: "edit" }
  | { kind: "state" }
  | { kind: "reading" }
  | { kind: "plan"; plan?: MaintenancePlan }
  | { kind: "service"; planId?: string }
  | { kind: "retire" }
  | { kind: "delete" };

const DAY = 86_400_000;

/** Downtime built from the availability changes people report, so there is no separate log to keep. */
function DowntimeCard({ item, now }: { item: EquipmentView; now: string }) {
  const periods = downtimePeriods(item, now);
  const from = new Date(Date.parse(now) - 7 * DAY).toISOString();
  const week = downtimeWithin(periods, from, now);
  const recent = [...periods].reverse().slice(0, 5);
  const current = periods.find((period) => period.end === null);

  return (
    <article className="card detail-card" aria-labelledby="downtime-heading">
      <header className="card__header">
        <div><span className="eyebrow">Last 7 days</span><h2 id="downtime-heading">Downtime</h2></div>
      </header>
      {periods.length === 0 ? (
        <div className="empty-inline"><strong>No downtime reported</strong><span>When availability is reported as unavailable, the time and the reason are kept here.</span></div>
      ) : (
        <>
          <div className="downtime-summary">
            <div><strong>{formatDuration(week.total)}</strong><small>reported unavailable in the last 7 days</small></div>
            {current ? <div><strong>{formatDuration(current.minutes)}</strong><small>unavailable now, since {formatDemoDateTime(current.start)}</small></div> : null}
          </div>
          {week.byReason.length > 0 ? (
            <ul className="downtime-reasons" aria-label="Downtime by reason">
              {week.byReason.map((row) => (
                <li key={row.reason}><span>{row.reason === "unrecorded" ? "Reason not recorded" : downtimeReasonLabels[row.reason]}</span><b>{formatDuration(row.minutes)}</b></li>
              ))}
            </ul>
          ) : null}
          <table className="data-table" aria-label="Recent downtime periods">
            <thead><tr><th>From</th><th>To</th><th>Length</th><th>Reason</th></tr></thead>
            <tbody>
              {recent.map((period) => (
                <tr key={period.start}>
                  <td>{formatDemoDateTime(period.start)}</td>
                  <td>{period.end ? formatDemoDateTime(period.end) : <span className="muted">Still unavailable</span>}</td>
                  <td>{formatDuration(period.minutes)}</td>
                  <td>{period.reason ? downtimeReasonLabels[period.reason] : <span className="muted">Not recorded</span>}{period.note ? <small className="downtime-note">{period.note}</small> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="card__footnote">Times and reasons are as reported. They are not measured by the machine, and waiting is not judged avoidable.</p>
        </>
      )}
    </article>
  );
}

const serviceTypeLabel = { service: "Service", inspection: "Inspection", repair: "Repair" } as const;

export function EquipmentDetailScreen({ id }: { id: string; maintenance?: boolean }) {
  const query = useQuery({
    queryKey: ["equipment", id],
    queryFn: () => demoFetch<EquipmentView>(`/equipment/${id}`),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <EquipmentDetail item={query.data} />;
}

function EquipmentDetail({ item }: { item: EquipmentView }) {
  const { context } = useDemoContext();
  const { data: shell } = useShellData();
  const actor = { name: context.persona, role: context.role };
  const mutations = useEquipmentMutations(item);
  const serviceRequests = useServiceRequests(item.id);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const retired = item.retiredAt !== null;
  const canManage = !retired && canActOnEquipment("manage", actor).allowed;
  const canService = !retired && canActOnEquipment("service", actor).allowed;
  const canRequest = !retired && canRequestService(actor).allowed;
  const canReading = !retired && canActOnEquipment("reading", actor).allowed;
  const canState = !retired && canActOnEquipment("state", actor).allowed;
  const canRetire = canActOnEquipment("manage", actor).allowed;
  const areas = shell?.areas ?? [];
  const close = () => setDialog(null);
  const events = [...item.events].reverse();

  return (
    <div className="workspace-page">
      <Link href="/equipment" className="back-link"><ArrowLeft /> Equipment</Link>
      <PageHeader
        eyebrow={`${item.code} · ${categoryLabels[item.category]}`}
        title={item.name}
        description={[item.areaName ?? "No area assigned", item.makeModel].filter(Boolean).join(" · ")}
        icon={Wrench}
        action={
          <div className="header-actions">
            {canReading ? <button className="button button--quiet" onClick={() => setDialog({ kind: "reading" })}><Gauge /> Record reading</button> : null}
            {canService ? <button className="button button--primary" onClick={() => setDialog({ kind: "service" })}><Plus /> Log service</button> : null}
            <MoreMenu>
              {(closeMenu) => (
                <>
                  {canManage ? <button className="menu-item" onClick={() => { closeMenu(); setDialog({ kind: "edit" }); }}><span className="menu-item__icon"><Pencil size={16} /></span><span className="menu-item__copy"><strong>Edit details</strong></span></button> : null}
                  {!retired ? <Link className="menu-item" href={`/exceptions/new?equipmentId=${item.id}`} onClick={closeMenu}><span className="menu-item__icon"><AlertTriangle size={16} /></span><span className="menu-item__copy"><strong>Report an issue</strong><small>For this equipment</small></span></Link> : null}
                  {canRetire && !retired ? <button className="menu-item" onClick={() => { closeMenu(); setDialog({ kind: "retire" }); }}><span className="menu-item__icon"><Lock size={16} /></span><span className="menu-item__copy"><strong>Retire</strong><small>Keep the history, take it off the active register</small></span></button> : null}
                  {canRetire && retired ? <button className="menu-item" onClick={() => { closeMenu(); mutations.restore.mutate(); }}><span className="menu-item__icon"><RotateCcw size={16} /></span><span className="menu-item__copy"><strong>Restore</strong><small>Return it to the active register</small></span></button> : null}
                  {canRetire ? <button className="menu-item menu-item--danger" onClick={() => { closeMenu(); setDialog({ kind: "delete" }); }}><span className="menu-item__icon"><Trash2 size={16} /></span><span className="menu-item__copy"><strong>Delete</strong><small>Only for records made in error</small></span></button> : null}
                </>
              )}
            </MoreMenu>
          </div>
        }
      />

      {retired ? (
        <div className="readonly-banner" role="note">
          <Lock aria-hidden="true" />
          <div>
            <strong>Retired {formatDemoDateTime(item.retiredAt!)}. This record is read-only.</strong>
            <span>{item.retiredReason}</span>
          </div>
        </div>
      ) : null}

      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card">
            <header className="card__header">
              <div><span className="eyebrow">Asset</span><h2>Details</h2></div>
              {canManage ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "edit" })}><Pencil /> Edit</button> : null}
            </header>
            <dl className="definition-grid">
              <div><dt>Category</dt><dd>{categoryLabels[item.category]}</dd></div>
              <div><dt>Make and model</dt><dd>{item.makeModel ?? <span className="muted">Not recorded</span>}</dd></div>
              <div><dt>Serial number</dt><dd>{item.serialNumber ?? <span className="muted">Not recorded</span>}</dd></div>
              <div><dt>Operating area</dt><dd>{item.areaName ? <Link href="/map">{item.areaName}</Link> : <span className="muted">Not assigned</span>}</dd></div>
              <div><dt>Meter reading</dt><dd>{item.hours !== null ? `${item.hours.toLocaleString("en-GB")} hours` : <span className="muted">No reading yet</span>}{item.hoursReadAt ? <small className="dd-note">{formatDemoDateTime(item.hoursReadAt)} · {item.hoursSource}</small> : null}</dd></div>
              <div><dt>Average use</dt><dd>{item.hoursPerDay ? `${item.hoursPerDay} hours a day` : <span className="muted">Not recorded</span>}</dd></div>
            </dl>
            {item.notes ? <p className="card__footnote">{item.notes}</p> : null}
          </article>

          <DowntimeCard item={item} now={shell?.now ?? item.stateUpdatedAt} />

          <article className="card detail-card">
            <header className="card__header">
              <div><span className="eyebrow">Planned work</span><h2>Maintenance plans</h2></div>
              {canManage ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "plan" })}><Plus /> Add plan</button> : null}
            </header>
            {item.plans.length === 0 ? (
              <div className="empty-inline">
                <strong>No maintenance plans yet</strong>
                <span>{canManage ? "Add a plan, for example a 500 hour service, and VESPER works out when it is due." : "The Maintenance Planner adds the plans that apply to this equipment."}</span>
              </div>
            ) : (
              <ul className="work-list">
                {item.maintenance.map((status) => {
                  const plan = item.plans.find((candidate) => candidate.id === status.planId)!;
                  return (
                    <li className="work-row" key={plan.id}>
                      <div className="work-row__copy">
                        <strong>{plan.name}</strong>
                        <small>{status.detail}</small>
                      </div>
                      <StatusBadge value={planTone[status.state]} label={status.label} />
                      <div className="row-controls">
                        {canRequest && (status.state === "due_soon" || status.state === "overdue") ? <Link className="button button--quiet button--small" href={`/equipment/${item.id}/service/new?planId=${plan.id}`}>Request service</Link> : null}
                        {canService ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "service", planId: plan.id })}>Log service</button> : null}
                        {canManage ? (
                          <>
                            <button className="icon-button icon-button--light" aria-label={`Edit plan: ${plan.name}`} onClick={() => setDialog({ kind: "plan", plan })}><Pencil /></button>
                            <button className="icon-button icon-button--light" aria-label={`Remove plan: ${plan.name}`} disabled={mutations.removePlan.isPending} onClick={() => mutations.removePlan.mutate(plan.id)}><Trash2 /></button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <article className="card detail-card" aria-labelledby="service-requests-heading">
            <header className="card__header">
              <div><span className="eyebrow">Service providers</span><h2 id="service-requests-heading">Service requests</h2></div>
              {canRequest ? <Link className="button button--quiet button--small" href={`/equipment/${item.id}/service/new`}><Plus /> Request service</Link> : null}
            </header>
            {(serviceRequests.data ?? []).length === 0 ? (
              <div className="empty-inline"><strong>No service requests</strong><span>{canRequest ? "Ask approved service providers to quote when this equipment needs maintenance." : "The Mine Manager or Maintenance Planner asks approved providers to quote for maintenance."}</span></div>
            ) : (
              <ul className="work-list">
                {[...(serviceRequests.data ?? [])].reverse().map((request) => (
                  <li className="work-row" key={request.id}>
                    <Link className="work-row__copy" href={`/equipment/${item.id}/service/${request.id}`}>
                      <strong>{request.title}</strong>
                      <small>{request.number} · {request.invites.length} {request.invites.length === 1 ? "provider" : "providers"} asked</small>
                    </Link>
                    <StatusBadge value={isOpenRequest(request) ? "in_progress" : request.status === "completed" ? "complete" : "unknown"} label={requestStatusLabels[request.status]} />
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card detail-card">
            <header className="card__header">
              <div><span className="eyebrow">Record</span><h2>Service history</h2></div>
              {canService ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "service" })}><Plus /> Log entry</button> : null}
            </header>
            {item.services.length === 0 ? (
              <div className="empty-inline"><strong>Nothing logged yet</strong><span>Services, inspections and repairs appear here, newest first.</span></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table" aria-label="Service history">
                  <thead><tr><th scope="col">When</th><th scope="col">Type</th><th scope="col">What was done</th><th scope="col">Hours</th><th scope="col">By</th><th scope="col">Work order</th></tr></thead>
                  <tbody>
                    {item.services.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDemoDateTime(entry.performedAt)}</td>
                        <td>{serviceTypeLabel[entry.type]}</td>
                        <td>{entry.summary}</td>
                        <td>{entry.hours !== null ? entry.hours.toLocaleString("en-GB") : <span className="muted">—</span>}</td>
                        <td>{entry.performedBy}</td>
                        <td>{entry.workOrderRef ?? <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        <aside className="detail-layout__aside">
          <article className="card next-action-card">
            <span className="eyebrow">Availability</span>
            <h2>{item.state === "available" ? "Available" : "Unavailable"}</h2>
            <p>{item.stateNote ?? (item.state === "available" ? "Reported as ready for work." : "Reported as not available for work.")}</p>
            <small className="dd-note">{formatStatus(item.stateQuality)} · {formatDemoDateTime(item.stateUpdatedAt)}</small>
            {canState ? <button className="button button--quiet button--wide" onClick={() => setDialog({ kind: "state" })}>Update availability</button> : null}
            <p className="confirmation-note">A report is not verification, and repair is not permission to operate.</p>
          </article>

          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Connected</span><h2>Linked work</h2></div></header>
            {item.linkedIssues.length === 0 && item.readiness.length === 0 ? (
              <div className="empty-inline"><strong>Nothing linked</strong><span>Issues and planned maintenance for this equipment show up here.</span></div>
            ) : (
              <ul className="work-list">
                {item.linkedIssues.map((issue) => (
                  <li className="work-row" key={issue.id}>
                    <Link className="work-row__copy" href={`/exceptions/${issue.id}`}><strong>{issue.title}</strong><small>{issue.issueNumber} · {issueStateLabels[issue.workflowState]}</small></Link>
                  </li>
                ))}
                {item.readiness.map((activity) => (
                  <li className="work-row" key={activity.id}>
                    <Link className="work-row__copy" href={`/resources/${activity.id}`}><strong>{activity.title}</strong><small>Readiness · {formatStatus(activity.status)}</small></Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card timeline-card">
            <span className="eyebrow">History</span>
            <h2>Activity</h2>
            <ol>
              {events.map((event) => (
                <li key={event.id}>
                  <span />
                  <div>
                    <strong>{event.summary}</strong>
                    {event.note ? <q>{event.note}</q> : null}
                    <small>{event.actor} · {event.actorRole} · {formatDemoDateTime(event.occurredAt)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </aside>
      </section>

      {dialog?.kind === "edit" ? (
        <EquipmentFormDialog item={item} areas={areas} pending={mutations.update.isPending} onClose={close} onSave={(input) => mutations.update.mutate(input, { onSuccess: close })} />
      ) : null}
      {dialog?.kind === "state" ? (
        <StateDialog item={item} pending={mutations.setState.isPending} onClose={close} onSave={(input) => mutations.setState.mutate(input, { onSuccess: close })} />
      ) : null}
      {dialog?.kind === "reading" ? (
        <ReadingDialog item={item} pending={mutations.recordReading.isPending} onClose={close} onSave={(input) => mutations.recordReading.mutate(input, { onSuccess: close })} />
      ) : null}
      {dialog?.kind === "plan" ? (
        <PlanDialog
          item={item}
          plan={dialog.plan}
          pending={mutations.addPlan.isPending || mutations.updatePlan.isPending}
          onClose={close}
          onSave={(input) =>
            dialog.plan
              ? mutations.updatePlan.mutate({ ...input, planId: dialog.plan.id }, { onSuccess: close })
              : mutations.addPlan.mutate(input, { onSuccess: close })
          }
        />
      ) : null}
      {dialog?.kind === "service" ? (
        <ServiceDialog item={item} planId={dialog.planId} pending={mutations.logService.isPending} onClose={close} onSave={(input) => mutations.logService.mutate(input, { onSuccess: close })} />
      ) : null}
      {dialog?.kind === "retire" ? (
        <RetireDialog item={item} pending={mutations.retire.isPending} onClose={close} onSave={(reason) => mutations.retire.mutate({ reason }, { onSuccess: close, onError: close })} />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title="Delete this equipment?"
          body={<>This removes <strong>{item.name}</strong> from the register for good. Only records made in error can be deleted. Anything with history has to be retired instead, so the history is kept.</>}
          confirmLabel="Delete equipment"
          tone="danger"
          pending={mutations.remove.isPending}
          onConfirm={() => mutations.remove.mutate(undefined, { onError: close })}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
