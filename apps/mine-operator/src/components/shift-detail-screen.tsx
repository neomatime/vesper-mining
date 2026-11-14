"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Link2,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Square,
  Trash2,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { demoFetch } from "@/lib/api";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { openDependencies } from "@/lib/issue-rules";
import { formatDay, remaining, shiftTimes } from "@/lib/shift-format";
import { draftShiftReport, reportSources, reportToText } from "@/lib/shift-report";
import { canActOnShift, handoverLabels, shiftStateLabels, type ShiftView } from "@/lib/shift-rules";
import { useDemoContext } from "@/stores/demo-context";
import { ConfirmDialog } from "./dialog";
import { MoreMenu } from "./more-menu";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { CancelShiftDialog, CrewDialog, ShiftFormDialog, WorkDialog } from "./shift-dialogs";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { TaskCompletionDialog, TaskCompletionNote } from "./task-completion";
import { useShiftMutations } from "./use-shift-mutations";

export function ShiftDetailScreen({ id, handover = false }: { id: string; handover?: boolean }) {
  const query = useQuery({
    queryKey: ["shift", id],
    queryFn: () => demoFetch<ShiftView>(`/shifts/${id}`),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return handover ? <HandoverView shift={query.data} /> : <ShiftDetail shift={query.data} />;
}

const stateTone = { scheduled: "pending", in_progress: "in_progress", closed: "complete", cancelled: "unknown" } as const;

type DialogState = { kind: "edit" } | { kind: "crew" } | { kind: "work" } | { kind: "cancel" } | { kind: "delete" } | { kind: "close" };

function ShiftDetail({ shift }: { shift: ShiftView }) {
  const { context } = useDemoContext();
  const { data: shell } = useShellData();
  const actor = { name: context.persona, role: context.role };
  const mutations = useShiftMutations(shift);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [completing, setCompleting] = useState<{ id: string; title: string } | null>(null);

  const live = shift.state === "scheduled" || shift.state === "in_progress";
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
            {shift.state === "scheduled" && canRun ? <button className="button button--primary" disabled={mutations.start.isPending} onClick={() => mutations.start.mutate()}><Play /> {mutations.start.isPending ? "Starting…" : "Start shift"}</button> : null}
            {shift.state === "in_progress" && canRun ? <button className="button button--primary" onClick={() => setDialog({ kind: "close" })}><Square /> Close shift</button> : null}
            {live && canManage ? <button className="button button--quiet" onClick={() => setDialog({ kind: "edit" })}><Pencil /> Edit</button> : null}
            <MoreMenu>
              {(closeMenu) => (
                <>
                  <Link className="menu-item" href={`/shifts/${shift.id}/handover`} onClick={closeMenu}><span className="menu-item__icon"><Send size={16} /></span><span className="menu-item__copy"><strong>Handover</strong><small>{shift.next ? `To ${shift.next.name}` : "No next shift yet"}</small></span></Link>
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
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Before the shift starts</span><h2>Briefing</h2></div>{live && canManage ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "edit" })}><Pencil /> Edit</button> : null}</header>
            {shift.briefing ? <p className="prose">{shift.briefing}</p> : <div className="empty-inline"><strong>No briefing yet</strong><span>{live && canManage ? "Add what the crew should know before they start." : "The supervisor adds the briefing for the crew."}</span></div>}
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
              {live && canManage ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "work" })}><Plus /> Add work</button> : null}
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
          <article className="card next-action-card">
            <span className="eyebrow">Handover</span>
            <h2>{handoverLabels[shift.handover.state]}</h2>
            <p>{shift.next ? `To ${shift.next.name}${shift.next.supervisor ? `, led by ${shift.next.supervisor}` : ""}.` : "There is no next shift scheduled yet."}</p>
            <Link className="button button--quiet button--wide" href={`/shifts/${shift.id}/handover`}>{shift.handover.state === "draft" ? "Prepare handover" : "Open handover"}</Link>
            {shift.state === "in_progress" ? <small className="dd-note">{remaining(shift.endsAt, shiftNow(shell?.now))} left on this shift</small> : null}
          </article>
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
      {dialog?.kind === "close" ? (
        <ConfirmDialog
          title="Close this shift?"
          body={
            <>
              {done} of {shift.work.length} tasks are finished. {shift.unresolved} {shift.unresolved === 1 ? "item continues" : "items continue"} into {shift.next ? shift.next.name : "the next shift"}, and the issues stay open.
              {shift.handover.state === "draft" && shift.unresolved > 0 ? <> Publish the handover first.</> : null}
            </>
          }
          confirmLabel="Close shift"
          pending={mutations.close.isPending}
          onConfirm={() => mutations.close.mutate(undefined, { onSuccess: close, onError: close })}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function shiftNow(now: string | undefined) {
  return now ?? new Date().toISOString();
}

function HandoverView({ shift }: { shift: ShiftView }) {
  const { context } = useDemoContext();
  const actor = { name: context.persona, role: context.role };
  const mutations = useShiftMutations(shift);
  const { data: shell } = useShellData();
  const { handover } = shift;
  const [notes, setNotes] = useState(handover.notes);
  const [sources, setSources] = useState<{ href: string; label: string }[]>([]);
  const [confirm, setConfirm] = useState<"withdraw" | null>(null);

  const canHandOver = canActOnShift("handover", actor, shift).allowed;
  const canAcknowledge = canActOnShift("acknowledge", actor, shift, shift.next).allowed && handover.publishedBy !== actor.name;
  const started = shift.state === "in_progress" || shift.state === "closed";
  const dirty = notes !== handover.notes;
  const canEditNotes = canHandOver && handover.state === "draft" && shift.state !== "cancelled";
  const isPublisher = handover.publishedBy === actor.name;

  // Builds the report from records already in VESPER. It is added to the notes as editable text, below anything already written.
  const prepareDraft = () => {
    if (!shell) return;
    const draft = draftShiftReport({ shift, issues: shell.issues, equipment: shell.equipment, now: shell.now });
    const text = reportToText(draft, shift.name);
    setNotes(notes.trim() ? `${notes.trimEnd()}\n\n${text}` : text);
    setSources(reportSources(draft));
  };

  const steps = [
    { key: "draft", label: "Draft", detail: handover.notesUpdatedAt ? `Saved ${formatDemoDateTime(handover.notesUpdatedAt)}` : "Not saved yet" },
    { key: "published", label: "Published", detail: handover.publishedAt ? `${handover.publishedBy} · ${formatDemoDateTime(handover.publishedAt)}` : "Waiting for the outgoing supervisor" },
    { key: "acknowledged", label: "Acknowledged", detail: handover.acknowledgedAt ? `${handover.acknowledgedBy} · ${formatDemoDateTime(handover.acknowledgedAt)}` : "Waiting for the incoming supervisor" },
  ] as const;
  const stepIndex = steps.findIndex((step) => step.key === handover.state);

  return (
    <div className="workspace-page">
      <Link href={`/shifts/${shift.id}`} className="back-link"><ArrowLeft /> {shift.name}</Link>
      <PageHeader
        eyebrow={`${shift.name} · ${shiftTimes(shift)}`}
        title="Shift handover"
        description={shift.next ? `Hand over to ${shift.next.name}${shift.next.supervisor ? `, led by ${shift.next.supervisor}` : ""}. Unresolved work carries across and the issues stay open.` : "There is no next shift scheduled yet. Schedule one so it can acknowledge this handover."}
        icon={UsersRound}
        action={<StatusBadge value={stateTone[shift.state]} label={shiftStateLabels[shift.state]} />}
      />

      <ol className="lifecycle lifecycle--short" aria-label="Handover progress">
        {steps.map((step, index) => (
          <li key={step.key} className={`lifecycle__step lifecycle__step--${index < stepIndex || handover.state === "acknowledged" ? "done" : index === stepIndex ? "current" : "todo"}`} aria-current={index === stepIndex ? "step" : undefined}>
            <span className="lifecycle__dot">{index < stepIndex || handover.state === "acknowledged" ? <CheckCircle2 aria-hidden="true" /> : null}</span>
            <span className="lifecycle__label">{step.label}</span>
            <small>{step.detail}</small>
          </li>
        ))}
      </ol>

      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Outstanding coordination</span><h2>{shift.unresolved} {shift.unresolved === 1 ? "item" : "items"} to carry forward</h2></div><Clock3 /></header>
            {shift.issues.length === 0 ? (
              <div className="empty-inline"><strong>Nothing to carry forward</strong><span>Every issue is verified or closed.</span></div>
            ) : (
              <div className="record-list">
                {shift.issues.map((issue) => {
                  const waiting = openDependencies(issue).length;
                  return (
                    <Link className="record-row" href={`/exceptions/${issue.id}`} key={issue.id}>
                      <span className="record-row__copy"><strong>{issue.title}</strong><small>{issue.issueNumber} · owner: {issue.owner ?? "not assigned"}{waiting ? ` · ${waiting} open ${waiting === 1 ? "dependency" : "dependencies"}` : ""}</small></span>
                      {waiting ? <span className="chip chip--inline"><Link2 /> {waiting}</span> : null}
                      <StatusBadge value={issue.workflowState} />
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          <article className="card handover-notes">
            <label>
              <span>Notes for {shift.next ? shift.next.name : "the next shift"}</span>
              <textarea rows={Math.min(32, Math.max(6, notes.split("\n").length + 4))} value={notes} onChange={(event) => setNotes(event.target.value)} readOnly={!canEditNotes} aria-describedby="handover-note-help" />
            </label>
            <p id="handover-note-help">
              {handover.state !== "draft"
                ? "Published notes are locked. Withdraw the handover to edit them."
                : shift.state === "cancelled"
                  ? "A cancelled shift has no handover."
                  : canHandOver
                    ? "Write what the incoming shift must know."
                    : `Viewing as ${context.role}. The handover belongs to ${shift.supervisor ?? "this shift's supervisor"} or the Mine Manager.`}
            </p>
            {canEditNotes ? (
              <div className="handover-draft">
                <button type="button" className="button button--quiet" onClick={prepareDraft} disabled={!shell}><FileText /> Prepare draft from shift records</button>
                <small>Adds what VESPER already knows: work done, issues that moved, equipment changes and what carries over. You review and edit it before publishing.</small>
              </div>
            ) : null}
            {sources.length > 0 ? (
              <div className="handover-sources" aria-label="Records the draft draws on">
                <small>Drawn from</small>
                <ul>{sources.map((source) => <li key={source.href}><Link href={source.href}>{source.label}</Link></li>)}</ul>
              </div>
            ) : null}
            {canEditNotes ? (
              <div className="button-row button-row--end">
                <button className="button button--quiet" disabled={!dirty || mutations.saveNotes.isPending} onClick={() => mutations.saveNotes.mutate(notes)}>{mutations.saveNotes.isPending ? "Saving…" : dirty ? "Save draft" : "Saved"}</button>
                <button className="button button--primary" disabled={!started || mutations.publish.isPending || notes.trim().length < 20} onClick={() => mutations.publish.mutate(dirty ? notes : null)}><Send /> {mutations.publish.isPending ? "Publishing…" : "Publish handover"}</button>
              </div>
            ) : null}
            {canEditNotes && !started ? <small className="field-hint">Start the shift before publishing the handover.</small> : null}
            {canEditNotes && started && notes.trim().length < 20 ? <small className="field-hint">Write at least twenty characters to publish.</small> : null}
          </article>
        </div>

        <aside className="detail-layout__aside">
          <article className="card next-action-card">
            <span className="eyebrow">Handover state</span>
            <h2>{handover.state === "acknowledged" ? "Receipt acknowledged" : handover.state === "published" ? "Ready for the incoming supervisor" : "Draft in preparation"}</h2>
            <p>Acknowledgement confirms receipt of information only. It does not resolve issues, grant safety clearance or change accountable ownership.</p>
            {handover.state === "acknowledged" ? (
              <div className="inline-success"><CheckCircle2 /> Acknowledged by {handover.acknowledgedBy} at {handover.acknowledgedAt ? formatDemoDateTime(handover.acknowledgedAt) : ""}</div>
            ) : handover.state === "published" ? (
              <>
                <button className="button button--primary button--wide" disabled={!canAcknowledge || mutations.acknowledge.isPending} onClick={() => mutations.acknowledge.mutate()}>{mutations.acknowledge.isPending ? "Recording…" : "Acknowledge handover"}</button>
                {isPublisher ? <small className="step-buttons__reason">The incoming supervisor acknowledges, not the person who published it.</small> : !canAcknowledge ? <small className="step-buttons__reason">Only {shift.next?.supervisor ?? "the next shift's supervisor"} or the Mine Manager can acknowledge.</small> : null}
                {canHandOver ? <button className="button button--quiet button--wide" onClick={() => setConfirm("withdraw")}><RotateCcw /> Withdraw handover</button> : null}
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
          pending={mutations.withdraw.isPending}
          onConfirm={() => mutations.withdraw.mutate(undefined, { onSettled: () => setConfirm(null) })}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
