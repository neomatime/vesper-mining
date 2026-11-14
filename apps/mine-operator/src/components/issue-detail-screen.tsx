"use client";

import { useQuery } from "@tanstack/react-query";
import type { Action, IssueDependency, OperationalIssue } from "@vesper/api-contracts";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  ImageIcon,
  Link2,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { demoFetch } from "@/lib/api";
import { formatStatus, recoverySummary } from "@/lib/calculations";
import { formatDemoDateTime } from "@/lib/demo-clock";
import {
  activeActions,
  canAct,
  defectOperabilityLabels,
  defectSymptomLabels,
  isFinished,
  lifecycleRail,
  railPosition,
  stateLabels,
  transitionOptions,
  type Actor,
  type TransitionOption,
} from "@/lib/issue-rules";
import { initials } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
import {
  ActionDialog,
  DependencyDialog,
  EditIssueDialog,
  ResolveDependencyDialog,
  TransitionDialog,
  dependencyKindLabel,
} from "./issue-dialogs";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { useIssueMutations } from "./use-issue-mutations";

type DialogState =
  | { kind: "edit" }
  | { kind: "transition"; option: TransitionOption }
  | { kind: "action"; action?: Action }
  | { kind: "dependency" }
  | { kind: "resolve"; dependency: IssueDependency; mode: "resolved" | "bypassed" };

const nextStepHint: Record<OperationalIssue["workflowState"], string> = {
  reported: "Review the report and decide whether it needs coordinated action.",
  reviewed: "Choose an accountable owner and add at least one action with an owner and a deadline.",
  action_assigned: "The owner starts the work, or records what the work is waiting for.",
  in_progress: "Complete the actions, then report the resolution with evidence.",
  awaiting_dependency: "Resolve or bypass the open dependency to resume work.",
  resolution_reported: "Someone independent verifies the evidence, or rejects it with a reason.",
  verified: "Close the issue once every action is complete.",
  closed: "This issue is closed. A Mine Manager can reopen it with a reason.",
  reopened: "Resume work on the issue.",
  cancelled: "Cancelled issues are kept as history.",
  duplicate: "Duplicate issues are kept as history.",
};

function attachmentKind(name: string): "photo" | "document" | "other" {
  if (/\.(jpe?g|png|gif|webp|heic)$/i.test(name)) return "photo";
  if (/\.(pdf|docx?|xlsx?|txt|csv)$/i.test(name)) return "document";
  return "other";
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IssueDetailScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["issue", id],
    queryFn: () => demoFetch<OperationalIssue>(`/issues/${id}`),
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <IssueDetail issue={query.data} />;
}

function IssueDetail({ issue }: { issue: OperationalIssue }) {
  const { context } = useDemoContext();
  const { data: shell } = useShellData();
  const actor: Actor = { name: context.persona, role: context.role };
  const mutations = useIssueMutations(issue);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const finished = isFinished(issue.workflowState);
  const canEdit = !finished && canAct("edit", actor, issue).allowed;
  const canAssign = canAct("assign", actor, issue).allowed;
  const canManageActions = !finished && canAct("manage_actions", actor, issue).allowed;
  const canManageDependencies = !finished && canAct("manage_dependencies", actor, issue).allowed;
  const options = transitionOptions(issue, actor);
  const actions = activeActions(issue);
  const removed = issue.actions.filter((action) => action.removedAt);
  const equipmentName = shell?.equipment.find((item) => item.id === issue.equipmentId)?.name;
  const areaName = shell?.areas.find((item) => item.id === issue.areaId)?.name;
  const position = railPosition(issue.workflowState);
  const events = [...issue.events].reverse();
  const lastVerification = issue.verifications.at(-1);
  const close = () => setDialog(null);

  return (
    <div className="workspace-page">
      <Link className="back-link" href="/exceptions"><ArrowLeft /> Work & Exceptions</Link>
      <PageHeader
        eyebrow={`${issue.issueNumber} · ${stateLabels[issue.workflowState]}`}
        title={issue.title}
        description={issue.description}
        action={
          <div className="header-actions">
            <StatusBadge value={issue.operationalStatus} />
            {canEdit ? (
              <button className="button button--quiet" onClick={() => setDialog({ kind: "edit" })}><Pencil /> Edit details</button>
            ) : null}
          </div>
        }
      />

      {finished ? (
        <div className="readonly-banner" role="note">
          <Lock aria-hidden="true" />
          <div>
            <strong>{stateLabels[issue.workflowState]}. This record is read-only history.</strong>
            <span>{nextStepHint[issue.workflowState]}</span>
          </div>
        </div>
      ) : (
        <ol className="lifecycle" aria-label="Issue progress">
          {lifecycleRail.map((state, index) => {
            const status = index < position ? "done" : index === position ? "current" : "todo";
            return (
              <li key={state} className={`lifecycle__step lifecycle__step--${status}`} aria-current={status === "current" ? "step" : undefined}>
                <span className="lifecycle__dot">{status === "done" ? <CheckCircle2 aria-hidden="true" /> : null}</span>
                <span className="lifecycle__label">{stateLabels[state]}</span>
                {status === "current" && issue.workflowState === "awaiting_dependency" ? <em>Waiting</em> : null}
                {status === "current" && issue.workflowState === "reopened" ? <em>Reopened</em> : null}
              </li>
            );
          })}
        </ol>
      )}

      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Current coordination state</span><h2>Issue summary</h2></div><StatusBadge value={issue.quality} /></header>
            <dl className="definition-grid">
              <div><dt>Accountable owner</dt><dd><UserRound /> {issue.owner ?? <span className="muted">Not assigned yet</span>}</dd></div>
              <div><dt>Workflow state</dt><dd>{stateLabels[issue.workflowState]}</dd></div>
              <div><dt>Priority</dt><dd><span className={`priority priority--${issue.priority}`}>{formatStatus(issue.priority)}</span></dd></div>
              <div><dt>Reported</dt><dd><Clock3 /> {formatDemoDateTime(issue.reportedAt)}</dd></div>
              <div><dt>Equipment</dt><dd>{issue.equipmentId ? <Link href={`/equipment/${issue.equipmentId}`}>{equipmentName ?? issue.equipmentId}</Link> : <span className="muted">None linked</span>}</dd></div>
              <div><dt>Operating area</dt><dd>{issue.areaId ? <Link href="/map">{areaName ?? issue.areaId}</Link> : <span className="muted">None linked</span>}</dd></div>
              {issue.defect ? (
                <>
                  <div><dt>Primary cause</dt><dd>{defectSymptomLabels[issue.defect.symptom]}</dd></div>
                  <div><dt>Secondary cause</dt><dd>{issue.defect.secondary ? defectSymptomLabels[issue.defect.secondary] : <span className="muted">None recorded</span>}</dd></div>
                  <div><dt>Still working? (as reported)</dt><dd>{defectOperabilityLabels[issue.defect.operability]}</dd></div>
                </>
              ) : null}
            </dl>
            <div className="evidence-callout"><ShieldCheck /><div><strong>Reported information is not operational clearance</strong><p>Repair completion, independent verification, authorised release and operation resumption remain distinct events.</p></div></div>
          </article>

          <article className="card detail-card">
            <header className="card__header">
              <div><span className="eyebrow">Action flow</span><h2>Actions</h2></div>
              <div className="card__tools">
                <span>{recoverySummary(actions)}</span>
                {canManageActions ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "action" })}><Plus /> Add action</button> : null}
              </div>
            </header>
            {actions.length === 0 ? (
              <div className="empty-inline">
                <strong>No actions yet</strong>
                <span>{canManageActions ? "Add the first action with an owner and a deadline so the work counts as assigned." : "A coordinator adds actions once the issue is reviewed."}</span>
              </div>
            ) : (
              <ul className="work-list">
                {actions.map((action, index) => {
                  const mayMove = !finished && (canManageActions || action.owner === actor.name);
                  return (
                    <li className="work-row" key={action.id}>
                      <span className={`action-row__marker action-row__marker--${action.state}`}>{action.state === "complete" ? <CheckCircle2 /> : index + 1}</span>
                      <div className="work-row__copy">
                        <strong>{action.title}</strong>
                        <small>
                          {action.team} · {action.owner} · {action.dueAt ? `due ${formatDemoDateTime(action.dueAt)}` : "no deadline set"}
                          {action.completedAt ? ` · completed ${formatDemoDateTime(action.completedAt)}` : ""}
                        </small>
                      </div>
                      <StatusBadge value={action.state} />
                      {mayMove || canManageActions ? (
                        <div className="row-controls">
                          {mayMove && action.state !== "complete" && action.state !== "in_progress" ? (
                            <button className="button button--quiet button--small" disabled={mutations.updateAction.isPending} onClick={() => mutations.updateAction.mutate({ actionId: action.id, state: "in_progress" })}>Start</button>
                          ) : null}
                          {mayMove && action.state !== "complete" ? (
                            <button className="button button--quiet button--small" disabled={mutations.updateAction.isPending} onClick={() => mutations.updateAction.mutate({ actionId: action.id, state: "complete" })}>Mark complete</button>
                          ) : null}
                          {mayMove && action.state === "complete" ? (
                            <button className="button button--quiet button--small" disabled={mutations.updateAction.isPending} onClick={() => mutations.updateAction.mutate({ actionId: action.id, state: "in_progress" })}><RotateCcw /> Reopen</button>
                          ) : null}
                          {canManageActions ? (
                            <>
                              <button className="icon-button icon-button--light" aria-label={`Edit action: ${action.title}`} onClick={() => setDialog({ kind: "action", action })}><Pencil /></button>
                              {action.state !== "complete" ? (
                                <button className="icon-button icon-button--light" aria-label={`Remove action: ${action.title}`} disabled={mutations.removeAction.isPending} onClick={() => mutations.removeAction.mutate({ actionId: action.id, title: action.title })}><Trash2 /></button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {removed.length > 0 ? (
              <div className="removed-actions">
                <button className="link-button" onClick={() => setShowRemoved((value) => !value)} aria-expanded={showRemoved}>
                  {showRemoved ? "Hide" : "Show"} removed actions ({removed.length})
                </button>
                {showRemoved ? (
                  <ul className="work-list work-list--muted">
                    {removed.map((action) => (
                      <li className="work-row" key={action.id}>
                        <div className="work-row__copy"><strong>{action.title}</strong><small>{action.team} · {action.owner}</small></div>
                        {canManageActions ? (
                          <button className="button button--quiet button--small" disabled={mutations.restoreAction.isPending} onClick={() => mutations.restoreAction.mutate(action.id)}><RotateCcw /> Restore</button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </article>

          <article className="card detail-card">
            <header className="card__header">
              <div><span className="eyebrow">What the work is waiting for</span><h2>Dependencies</h2></div>
              {canManageDependencies ? <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "dependency" })}><Plus /> Add dependency</button> : null}
            </header>
            {issue.dependencies.length === 0 ? (
              <div className="empty-inline">
                <strong>Nothing is blocking this issue</strong>
                <span>If work is waiting on parts, a contractor or a decision, record it here so it carries across shifts.</span>
              </div>
            ) : (
              <ul className="work-list">
                {issue.dependencies.map((dependency) => {
                  const blocked = issue.actions.find((action) => action.id === dependency.blockedActionId);
                  return (
                    <li className="work-row work-row--top" key={dependency.id}>
                      <span className="work-row__icon"><Link2 /></span>
                      <div className="work-row__copy">
                        <strong>{dependency.reason}</strong>
                        <small>
                          {dependencyKindLabel(dependency.kind)} · {dependency.owner}
                          {dependency.reviewBy ? ` · review by ${formatDemoDateTime(dependency.reviewBy)}` : ""}
                          {blocked ? ` · blocks “${blocked.title}”` : ""}
                        </small>
                        {dependency.resolutionNote ? <small className="work-row__note">{dependency.state === "bypassed" ? "Bypassed: " : "Resolved: "}{dependency.resolutionNote}</small> : null}
                      </div>
                      <StatusBadge value={dependency.state === "open" ? "pending" : dependency.state === "resolved" ? "complete" : "unknown"} label={formatStatus(dependency.state)} />
                      {canManageDependencies ? (
                        <div className="row-controls">
                          {dependency.state === "open" ? (
                            <>
                              <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "resolve", dependency, mode: "resolved" })}>Resolve</button>
                              <button className="button button--quiet button--small" onClick={() => setDialog({ kind: "resolve", dependency, mode: "bypassed" })}>Bypass</button>
                            </>
                          ) : (
                            <button className="button button--quiet button--small" disabled={mutations.updateDependency.isPending} onClick={() => mutations.updateDependency.mutate({ dependencyId: dependency.id, state: "open" })}><RotateCcw /> Reopen</button>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <NotesCard issue={issue} pending={mutations.addComment.isPending} onAdd={(body, attachments, done) => mutations.addComment.mutate({ body, attachments }, { onSuccess: done })} />
        </div>

        <aside className="detail-layout__aside">
          <article className="card next-action-card">
            <span className="eyebrow">What happens next</span>
            <h2>{finished ? "No further steps" : "Next step"}</h2>
            <p>{nextStepHint[issue.workflowState]}</p>
            {options.length > 0 ? (
              <div className="step-buttons">
                {options.map((option) => (
                  <div key={option.to} className="step-buttons__item">
                    <button
                      className={`button button--wide ${option.tone === "primary" ? "button--primary" : option.tone === "danger" ? "button--danger-quiet" : "button--quiet"}`}
                      disabled={!option.allowed}
                      onClick={() => setDialog({ kind: "transition", option })}
                    >
                      {option.label}
                    </button>
                    {!option.allowed && option.reason ? <small className="step-buttons__reason">{option.reason}</small> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="confirmation-note">Viewing as {actor.name}, {actor.role}. Steps recorded here do not change equipment status or grant safety authorisation.</p>
          </article>

          {lastVerification ? (
            <article className={`card verification-card verification-card--${lastVerification.result}`}>
              <span className="eyebrow">Independent verification</span>
              <h2>{lastVerification.result === "confirmed" ? "Verified" : "Not accepted"}</h2>
              <p>{lastVerification.note}</p>
              <small>{lastVerification.verifier} · {formatDemoDateTime(lastVerification.verifiedAt)}</small>
            </article>
          ) : null}

          <article className="card timeline-card">
            <span className="eyebrow">Append-only history</span>
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
        <EditIssueDialog
          issue={issue}
          equipment={(shell?.equipment ?? []).filter((item) => !item.retiredAt)}
          areas={shell?.areas ?? []}
          canAssign={canAssign}
          pending={mutations.update.isPending}
          onClose={close}
          onSave={(changes) => mutations.update.mutate(changes, { onSuccess: close })}
        />
      ) : null}
      {dialog?.kind === "transition" ? (
        <TransitionDialog
          issue={issue}
          option={dialog.option}
          pending={mutations.transition.isPending}
          onClose={close}
          onSave={(input) => mutations.transition.mutate({ to: dialog.option.to, ...input }, { onSuccess: close })}
        />
      ) : null}
      {dialog?.kind === "action" ? (
        <ActionDialog
          action={dialog.action}
          pending={mutations.addAction.isPending || mutations.updateAction.isPending}
          onClose={close}
          onSave={(input) =>
            dialog.action
              ? mutations.updateAction.mutate({ actionId: dialog.action.id, ...input }, { onSuccess: close })
              : mutations.addAction.mutate(input, { onSuccess: close })
          }
        />
      ) : null}
      {dialog?.kind === "dependency" ? (
        <DependencyDialog issue={issue} pending={mutations.addDependency.isPending} onClose={close} onSave={(input) => mutations.addDependency.mutate(input, { onSuccess: close })} />
      ) : null}
      {dialog?.kind === "resolve" ? (
        <ResolveDependencyDialog
          dependency={dialog.dependency}
          mode={dialog.mode}
          pending={mutations.updateDependency.isPending}
          onClose={close}
          onSave={(note) => mutations.updateDependency.mutate({ dependencyId: dialog.dependency.id, state: dialog.mode, resolutionNote: note }, { onSuccess: close })}
        />
      ) : null}
    </div>
  );
}

function NotesCard({
  issue,
  pending,
  onAdd,
}: {
  issue: OperationalIssue;
  pending: boolean;
  onAdd: (body: string, attachments: { name: string; kind: "photo" | "document" | "other"; sizeLabel: string }[], done: () => void) => void;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const tooShort = body.trim().length < 2;

  return (
    <article className="card detail-card">
      <header className="card__header"><div><span className="eyebrow">Evidence and discussion</span><h2>Notes and evidence</h2></div></header>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (tooShort) return;
          onAdd(
            body.trim(),
            files.map((file) => ({ name: file.name, kind: attachmentKind(file.name), sizeLabel: sizeLabel(file.size) })),
            () => {
              setBody("");
              setFiles([]);
              if (input.current) input.current.value = "";
            },
          );
        }}
      >
        <label className="sr-only" htmlFor={`note-${issue.id}`}>Add a note</label>
        <textarea id={`note-${issue.id}`} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a note, observation or update for the team" />
        {files.length > 0 ? (
          <ul className="chips" aria-label="Files to attach">
            {files.map((file) => <li key={file.name}><Paperclip /> {file.name} <small>{sizeLabel(file.size)}</small></li>)}
          </ul>
        ) : null}
        <div className="composer__footer">
          <div>
            <input ref={input} id={`files-${issue.id}`} className="sr-only" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} />
            <label htmlFor={`files-${issue.id}`} className="button button--quiet button--small"><Paperclip /> Attach evidence</label>
            <small className="field-hint">Evidence is recorded by file name and size.</small>
          </div>
          <button className="button button--primary button--small" disabled={pending || tooShort}>{pending ? "Adding…" : "Add note"}</button>
        </div>
      </form>
      {issue.comments.length === 0 ? (
        <div className="empty-inline"><strong>No notes yet</strong><span>Notes and evidence stay with the issue and appear in the shift handover.</span></div>
      ) : (
        <ul className="comments">
          {[...issue.comments].reverse().map((comment) => (
            <li key={comment.id} className="comment">
              <span className="avatar avatar--small">{initials(comment.author)}</span>
              <div>
                <p><strong>{comment.author}</strong> <small>{comment.role} · {formatDemoDateTime(comment.createdAt)}</small></p>
                <p>{comment.body}</p>
                {comment.attachments.length > 0 ? (
                  <ul className="chips">
                    {comment.attachments.map((file) => (
                      <li key={file.id}>{file.kind === "photo" ? <ImageIcon /> : <FileText />} {file.name} <small>{file.sizeLabel}</small></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
