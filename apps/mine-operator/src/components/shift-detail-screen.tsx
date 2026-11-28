"use client";

/**
 * One shift: state, times, crew and duties, work and tasks, the handover and the history. The handover card is hidden when the
 * subscription lacks shift_handover.
 */
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Link2,
  Lock,
  Pencil,
  Play,
  Plus,
  Send,
  Square,
  Trash2,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { demoFetch } from "@core/lib/api";
import { formatDemoDateTime } from "@core/lib/demo-clock";
import { openDependencies } from "@core/lib/issue-rules";
import { formatDay, remaining, shiftTimes } from "@core/lib/shift-format";
import { canActOnShift, handoverLabels, shiftStateLabels, type ShiftView } from "@core/lib/shift-rules";
import { useDemoContext } from "@core/stores/demo-context";
import { ConfirmDialog } from "@core/components/dialog";
import { MoreMenu } from "./more-menu";
import { PageHeader } from "@core/components/page-header";
import { ErrorState, LoadingState } from "@core/components/query-state";
import { CancelShiftDialog, CrewDialog, ShiftFormDialog, WorkDialog } from "./shift-dialogs";
import { useShellData } from "@core/components/shell-data";
import { StatusBadge } from "@core/components/status-badge";
import { TaskCompletionDialog, TaskCompletionNote } from "@core/components/task-completion";
import { useShiftMutations } from "@core/components/use-shift-mutations";
import { ImpactCard } from "./impact-panels";
import { useFeature } from "./use-entitlements";
import { Busy } from "@core/components/busy";

export function ShiftDetailScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["shift", id],
    queryFn: () => demoFetch<ShiftView>(`/shifts/${id}`),
  });
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  return <ShiftDetail shift={query.data} />;
}

const stateTone = { scheduled: "pending", in_progress: "in_progress", closed: "complete", cancelled: "unknown" } as const;

type DialogState = { kind: "edit" } | { kind: "crew" } | { kind: "work" } | { kind: "cancel" } | { kind: "delete" };

function ShiftDetail({ shift }: { shift: ShiftView }) {
  const { context } = useDemoContext();
  const { data: shell } = useShellData();
  const actor = { name: context.persona, role: context.role };
  const mutations = useShiftMutations(shift);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [completing, setCompleting] = useState<{ id: string; title: string } | null>(null);

  const live = shift.state === "scheduled" || shift.state === "in_progress";
  const handoverIncluded = useFeature("shift_handover");
  const canManage = canActOnShift("manage", actor).allowed;
  const canRun = canActOnShift("run", actor, shift).allowed;
  const equipment = (shell?.equipment ?? []).filter((item) => !item.retiredAt);
  const equipmentName = (id: string | null) => equipment.find((item) => item.id === id)?.name ?? null;
  const close = () => setDialog(null);
  const events = [...shift.events].reverse();
  const done = shift.work.filter((item) => item.done).length;

  const steps = [
    { key: "scheduled", label: "Scheduled", detail: `Starts ${formatDemoDateTime(shift.startsAt)}` },
    { key: "in_progress", label: "In progress", detail: shift.startedAt ? `Started ${formatDemoDateTime(shift.startedAt)}` : "Not started yet" },
    { key: "closed", label: "Closed", detail: shift.closedAt ? `Closed ${formatDemoDateTime(shift.closedAt)}` : `Ends ${formatDemoDateTime(shift.endsAt)}` },
  ] as const;
  const stepIndex = shift.state === "cancelled" ? -1 : steps.findIndex((step) => step.key === shift.state);

  return (
    <div className="workspace-page">
      <Link href="/shifts" className="back-link"><ArrowLeft /> Shifts</Link>
      <PageHeader
        eyebrow={`${formatDay(shift.startsAt)} · ${shiftTimes(shift)}`}
        title={shift.name}
        description={shift.supervisor ? `Supervised by ${shift.supervisor}` : "No supervisor assigned yet"}
        icon={UsersRound}
        action={
          <div className="header-actions">
            <StatusBadge value={stateTone[shift.state]} label={shiftStateLabels[shift.state]} />
            {shift.state === "scheduled" && canRun ? <button className="button button--primary" disabled={mutations.start.isPending} onClick={() => mutations.start.mutate()}><Play /> <Busy pending={mutations.start.isPending} label="Starting…">Start shift</Busy></button> : null}
            {shift.state === "in_progress" && canRun ? <Link className="button button--primary" href={`/shifts/${shift.id}/close`}><Square /> Close shift</Link> : null}
            {live && canManage ? <button className="button button--quiet" onClick={() => setDialog({ kind: "edit" })}><Pencil /> Edit</button> : null}
            <MoreMenu>
              {(closeMenu) => (
                <>
                  {handoverIncluded ? (
                  <Link className="menu-item" href={`/shifts/${shift.id}/handover`} onClick={closeMenu}><span className="menu-item__icon"><Send size={16} /></span><span className="menu-item__copy"><strong>Handover</strong><small>{shift.next ? `To ${shift.next.name}` : "No next shift yet"}</small></span></Link>
                  ) : null}
                  {shift.state === "scheduled" && canManage ? <button className="menu-item" onClick={() => { closeMenu(); setDialog({ kind: "cancel" }); }}><span className="menu-item__icon"><XCircle size={16} /></span><span className="menu-item__copy"><strong>Cancel shift</strong><small>Keep it on the roster as cancelled</small></span></button> : null}
                  {(shift.state === "scheduled" || shift.state === "cancelled") && canManage ? <button className="menu-item menu-item--danger" onClick={() => { closeMenu(); setDialog({ kind: "delete" }); }}><span className="menu-item__icon"><Trash2 size={16} /></span><span className="menu-item__copy"><strong>Delete</strong><small>Only for shifts made in error</small></span></button> : null}
                </>
              )}
            </MoreMenu>
          </div>
        }
      />

      {shift.state === "cancelled" ? (
        <div className="readonly-banner" role="note"><Lock aria-hidden="true" /><div><strong>Cancelled. This shift is read-only.</strong><span>{shift.cancelledReason}</span></div></div>
      ) : (
        <ol className="lifecycle lifecycle--short" aria-label="Shift progress">
          {steps.map((step, index) => (
            <li key={step.key} className={`lifecycle__step lifecycle__step--${index < stepIndex || shift.state === "closed" ? "done" : index === stepIndex ? "current" : "todo"}`} aria-current={index === stepIndex ? "step" : undefined}>
              <span className="lifecycle__dot">{index < stepIndex || shift.state === "closed" ? <CheckCircle2 aria-hidden="true" /> : null}</span>
              <span className="lifecycle__label">{step.label}</span>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
      )}

      <section className="detail-layout">
        <div className="detail-layout__main">
          <ImpactCard focus="shift" id={shift.id} />
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Before the shift starts</span><h2>Briefing</h2></div>{live && canManage ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "edit" })}><Pencil /> Edit</button> : null}</header>
            {shift.briefing ? <p className="prose">{shift.briefing}</p> : <div className="empty-inline"><strong>No briefing yet</strong><span>{live && canManage ? "Add what the crew should know before they start." : "The supervisor adds the briefing for the crew."}</span></div>}
            {shift.crew.length && (shift.briefing || shift.previous) ? <ReadReceipts shift={shift} /> : null}
          </article>

          <article className="card detail-card">
            <header className="card__header">
              <div><span className="eyebrow">People</span><h2>Crew</h2></div>
              {live && canManage ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "crew" })}><Plus /> Add crew</button> : null}
            </header>
            <ul className="work-list">
              {shift.supervisor ? (
                <li className="work-row">
                  <span className="work-row__icon"><UserRound /></span>
                  <div className="work-row__copy"><strong>{shift.supervisor}</strong><small>Supervisor</small></div>
                </li>
              ) : null}
              {shift.crew.map((member) => (
                <li className="work-row" key={member.id}>
                  <span className="work-row__icon"><UserRound /></span>
                  <div className="work-row__copy"><strong>{member.name}</strong><small>{member.duty}{equipmentName(member.equipmentId) ? ` · ${equipmentName(member.equipmentId)}` : ""}</small></div>
                  {live && canManage ? <button className="icon-button icon-button--light" aria-label={`Remove ${member.name} from the shift`} disabled={mutations.removeCrew.isPending} onClick={() => mutations.removeCrew.mutate(member.id)}><Trash2 /></button> : null}
                </li>
              ))}
            </ul>
            {shift.crew.length === 0 ? <div className="empty-inline"><strong>No crew added yet</strong><span>{live && canManage ? "Add the operators, drivers and crews working this shift." : "The supervisor adds the crew for this shift."}</span></div> : null}
          </article>

          <article className="card detail-card">
            <header className="card__header">
              <div><span className="eyebrow">{shift.work.length ? `${done} of ${shift.work.length} finished` : "Planned for the shift"}</span><h2>Work</h2></div>
              <div className="card__tools">
                <Link className="button button--quiet button--small" href={`/shifts/${shift.id}/allocation`}><ClipboardList /> Allocation sheet</Link>
                {live && canManage ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "work" })}><Plus /> Add work</button> : null}
              </div>
            </header>
            {shift.work.length === 0 ? (
              <div className="empty-inline"><strong>No work planned yet</strong><span>{live && canManage ? "Add tasks, or attach an open issue so it stays in view across shifts." : "The supervisor plans the work for this shift."}</span></div>
            ) : (
              <ul className="work-list">
                {shift.work.map((item) => {
                  const mayToggle = live && (canManage || item.owner === actor.name);
                  return (
                    <li className="work-row" key={item.id}>
                      <button className={`check ${item.done ? "check--done" : ""}`} aria-pressed={item.done} aria-label={`${item.done ? "Reopen" : "Mark done"}: ${item.title}`} disabled={!mayToggle || mutations.updateWork.isPending} onClick={() => (item.done ? mutations.updateWork.mutate({ workId: item.id, done: false }) : setCompleting({ id: item.id, title: item.title }))}>
                        {item.done ? <Check /> : null}
                      </button>
                      <div className="work-row__copy">
                        <strong className={item.done ? "struck" : ""}>{item.title}</strong>
                        <small>{item.owner ?? "Not assigned"}{item.doneAt ? ` · finished ${formatDemoDateTime(item.doneAt)}` : ""}</small>
                        <TaskCompletionNote task={item} />
                      </div>
                      {item.issueId ? <Link className="chip chip--link" href={`/exceptions/${item.issueId}`}><Link2 /> Issue</Link> : null}
                      {live && canManage ? <button className="icon-button icon-button--light" aria-label={`Remove work: ${item.title}`} disabled={mutations.removeWork.isPending} onClick={() => mutations.removeWork.mutate(item.id)}><Trash2 /></button> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Continues past this shift</span><h2>{shift.unresolved} {shift.unresolved === 1 ? "item" : "items"} to carry forward</h2></div><Clock3 /></header>
            {shift.issues.length === 0 ? (
              <div className="empty-inline"><strong>Nothing to carry forward</strong><span>Every issue is verified or closed.</span></div>
            ) : (
              <div className="record-list">
                {shift.issues.map((issue) => {
                  const waiting = openDependencies(issue).length;
                  return (
                    <Link className="record-row" href={`/exceptions/${issue.id}`} key={issue.id}>
                      <span className="record-row__copy"><strong>{issue.title}</strong><small>{issue.issueNumber} · owner: {issue.owner ?? "not assigned"}{waiting ? ` · ${waiting} open ${waiting === 1 ? "dependency" : "dependencies"}` : ""}</small></span>
                      <StatusBadge value={issue.workflowState} />
                    </Link>
                  );
                })}
              </div>
            )}
          </article>
        </div>

        <aside className="detail-layout__aside">
          {handoverIncluded ? (
          <article className="card next-action-card">
            <span className="eyebrow">Handover</span>
            <h2>{handoverLabels[shift.handover.state]}</h2>
            <p>{shift.next ? `To ${shift.next.name}${shift.next.supervisor ? `, led by ${shift.next.supervisor}` : ""}.` : "There is no next shift scheduled yet."}</p>
            <Link className="button button--quiet button--wide" href={`/shifts/${shift.id}/handover`}>{shift.handover.state === "draft" ? "Prepare handover" : "Open handover"}</Link>
            {shift.state === "in_progress" ? <small className="dd-note">{remaining(shift.endsAt, shiftNow(shell?.now))} left on this shift</small> : null}
          </article>
          ) : null}
          <article className="card timeline-card">
            <span className="eyebrow">History</span>
            <h2>Activity</h2>
            <ol>
              {events.map((event) => (
                <li key={event.id}><span /><div><strong>{event.summary}</strong>{event.note ? <q>{event.note}</q> : null}<small>{event.actor} · {event.actorRole} · {formatDemoDateTime(event.occurredAt)}</small></div></li>
              ))}
            </ol>
          </article>
        </aside>
      </section>

      {dialog?.kind === "edit" ? <ShiftFormDialog shift={shift} pending={mutations.update.isPending} onClose={close} onSave={(input) => mutations.update.mutate(input, { onSuccess: close })} /> : null}
      {dialog?.kind === "crew" ? <CrewDialog shift={shift} equipment={equipment} pending={mutations.addCrew.isPending} onClose={close} onSave={(input) => mutations.addCrew.mutate(input, { onSuccess: close })} /> : null}
      {completing ? (
        <TaskCompletionDialog
          title={completing.title}
          pending={mutations.updateWork.isPending}
          onClose={() => setCompleting(null)}
          onSave={(input) => mutations.updateWork.mutate({ workId: completing.id, done: true, ...input }, { onSuccess: () => setCompleting(null) })}
        />
      ) : null}
      {dialog?.kind === "work" ? <WorkDialog shift={shift} issues={shift.issues} pending={mutations.addWork.isPending} onClose={close} onSave={(input) => mutations.addWork.mutate(input, { onSuccess: close })} /> : null}
      {dialog?.kind === "cancel" ? <CancelShiftDialog shift={shift} pending={mutations.cancel.isPending} onClose={close} onSave={(reason) => mutations.cancel.mutate({ reason }, { onSuccess: close })} /> : null}
      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title="Delete this shift?"
          body={<>This removes <strong>{shift.name}</strong> from the roster for good. Only shifts made in error can be deleted. A shift with people, work or notes has to be cancelled instead, so the record is kept.</>}
          confirmLabel="Delete shift"
          tone="danger"
          pending={mutations.remove.isPending}
          onConfirm={() => mutations.remove.mutate(undefined, { onError: close })}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function shiftNow(now: string | undefined) {
  return now ?? new Date().toISOString();
}

/** Who in the crew has confirmed, in VESPER Mobile, that they read the briefing and the handover from the shift before. */
function ReadReceipts({ shift }: { shift: ShiftView }) {
  const receipts = shift.acknowledgements ?? [];
  const at = (name: string, kind: "briefing" | "handover") => receipts.find((entry) => entry.name === name && entry.kind === kind)?.at ?? null;
  const people = shift.crew.filter((member) => member.duty !== "Contractor" || receipts.some((entry) => entry.name === member.name));
  const read = (kind: "briefing" | "handover") => people.filter((member) => at(member.name, kind)).length;
  return (
    <div className="read-receipts" aria-label="Read by the crew">
      <p className="read-receipts__summary">
        {shift.briefing ? <span>Briefing read by <strong>{read("briefing")} of {people.length}</strong></span> : null}
        {shift.previous ? <span>Handover from {shift.previous.name} read by <strong>{read("handover")} of {people.length}</strong></span> : null}
      </p>
      <ul>
        {people.map((member) => (
          <li key={member.id}>
            <span>{member.name}</span>
            {shift.briefing ? <small className={at(member.name, "briefing") ? "is-read" : ""}>Briefing: {at(member.name, "briefing") ? formatDemoDateTime(at(member.name, "briefing")!) : "not yet"}</small> : null}
            {shift.previous ? <small className={at(member.name, "handover") ? "is-read" : ""}>Handover: {at(member.name, "handover") ? formatDemoDateTime(at(member.name, "handover")!) : "not yet"}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
