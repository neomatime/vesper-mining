"use client";

/**
 * The phone's My Shift (crew, duty, equipment, briefing) and My Work (tasks owned by the person, with note and evidence on
 * completion).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, ListChecks, MapPin, MessageSquareText, Repeat2, ScanLine, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDemoTime, formatDemoDateTime } from "@core/lib/demo-clock";
import { activeActions, isOpen } from "@core/lib/issue-rules";
import { remaining, shiftTimes } from "@core/lib/shift-format";
import { currentShiftFor, type ShiftView } from "@core/lib/shift-rules";
import { useDemoContext } from "@core/stores/demo-context";
import { demoFetch, demoSend } from "@core/lib/api";
import { useToast } from "@core/components/toast-provider";
import { latestCheck, prestartCategories, type PrestartCheck } from "@core/lib/prestart-rules";
import type { EquipmentView } from "@core/lib/equipment-rules";
import { LoadingState } from "@core/components/query-state";
import { useShellData } from "@core/components/shell-data";
import { StatusBadge } from "@core/components/status-badge";
import { useShiftMutations } from "@core/components/use-shift-mutations";
import { TaskCompletionDialog, TaskCompletionNote } from "@core/components/task-completion";

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function greeting(now: string) {
  const hour = Number(formatDemoTime(now).slice(0, 2));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function MyShiftScreen() {
  const { context } = useDemoContext();
  const { data } = useShellData();
  if (!data) return <LoadingState variant="panel" />;

  const shift = currentShiftFor(data.shifts, context.persona);
  const first = context.persona.split(" ")[0];
  // The person's own reports that are still open, for the Track shortcut.
  const myOpenReports = data.issues.filter((issue) => issue.events.some((event) => event.type === "reported" && event.actor === context.persona) && !["verified", "closed", "cancelled", "duplicate"].includes(issue.workflowState)).length;
  const track = <Link href="/my-reports"><ClipboardList /><span><strong>Track</strong><small>{myOpenReports} open {myOpenReports === 1 ? "report" : "reports"}</small></span></Link>;

  if (!shift) {
    return (
      <div className="mobile-task-page">
        <section className="mobile-hero">
          <span className="eyebrow">My shift</span>
          <h1>{greeting(data.now)}, {first}</h1>
          <p>You are not on a shift right now.</p>
          <div className="mobile-hero__facts"><span><Clock3 /> Your supervisor adds you when the next shift is scheduled</span></div>
        </section>
        <section className="mobile-actions mobile-actions--two">
          <Link href="/report"><AlertTriangle /><span><strong>Report</strong><small>Record an issue</small></span></Link>
          {track}
        </section>
        <section className="mobile-stack">
          <Link className="mobile-card mobile-card--link" href="/schedule"><CalendarDays /><div><strong>Shift calendar</strong><p>See the shifts you are on, day by day</p></div><ArrowRight /></Link>
        </section>
      </div>
    );
  }

  const me = shift.crew.find((member) => member.name === context.persona);
  const unit = data.equipment.find((item) => item.id === me?.equipmentId);
  const myOpenTasks = shift.work.filter((item) => item.owner === context.persona && !item.done).length;
  const priority = [...shift.issues].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])[0];

  return (
    <div className="mobile-task-page">
      <section className="mobile-hero">
        <span className="eyebrow">{shift.state === "in_progress" ? "My shift" : "Your next shift"}</span>
        <h1>{greeting(data.now)}, {first}</h1>
        <p>{shift.name} · {shiftTimes(shift)} · {context.siteName}</p>
        <div className="mobile-hero__facts">
          <span><Clock3 /> {shift.state === "in_progress" ? `${remaining(shift.endsAt, data.now)} remaining` : `Starts ${formatDemoDateTime(shift.startsAt)}`}</span>
          {me ? <span><MapPin /> {me.duty}{unit ? ` · ${unit.code}` : ""}</span> : <span><MapPin /> {shift.supervisor === context.persona ? "Supervisor" : "On shift"}</span>}
        </div>
      </section>

      {unit && prestartCategories.includes(unit.category) ? <PrestartCard unit={unit} shiftId={shift.id} now={data.now} /> : null}

      {priority ? (
        <section className="mobile-priority">
          <div><AlertTriangle /><span><small>Needs attention</small><strong>{priority.title}</strong><p>{priority.description}</p></span></div>
          <Link href={`/issues/${priority.id}`}>Track issue <ArrowRight /></Link>
        </section>
      ) : null}

      <section className="mobile-actions">
        <Link href="/report"><AlertTriangle /><span><strong>Report</strong><small>Record an issue</small></span></Link>
        <Link href="/my-work"><Wrench /><span><strong>Act</strong><small>{myOpenTasks} open {myOpenTasks === 1 ? "task" : "tasks"}</small></span></Link>
        {track}
      </section>

      {shift.briefing || shift.previous ? <ReadCards shift={shift} /> : null}

      <section className="mobile-stack">
        <Link className="mobile-card mobile-card--link" href="/scan"><ScanLine /><div><strong>Scan a machine</strong><p>Open a machine from its QR label or fleet number</p></div><ArrowRight /></Link>
        <Link className="mobile-card mobile-card--link" href="/schedule"><CalendarDays /><div><strong>Shift calendar</strong><p>See the shifts you are on, day by day</p></div><ArrowRight /></Link>
      </section>
    </div>
  );
}

function ShiftTasks({ shift, name }: { shift: ShiftView; name: string }) {
  const mutations = useShiftMutations(shift);
  const [completing, setCompleting] = useState<{ id: string; title: string } | null>(null);
  const tasks = shift.work.filter((item) => item.owner === name).sort((a, b) => Number(a.done) - Number(b.done));
  if (tasks.length === 0) return null;
  return (
    <>
      {completing ? (
        <TaskCompletionDialog
          title={completing.title}
          pending={mutations.updateWork.isPending}
          onClose={() => setCompleting(null)}
          onSave={(input) => mutations.updateWork.mutate({ workId: completing.id, done: true, ...input }, { onSuccess: () => setCompleting(null) })}
        />
      ) : null}
      <h2>{shift.name} tasks</h2>
      {tasks.map((task) => (
        <article className="mobile-card" key={task.id}>
          <button className={`check ${task.done ? "check--done" : ""}`} aria-pressed={task.done} aria-label={`${task.done ? "Reopen" : "Mark done"}: ${task.title}`} disabled={mutations.updateWork.isPending || shift.state !== "in_progress"} onClick={() => (task.done ? mutations.updateWork.mutate({ workId: task.id, done: false }) : setCompleting({ id: task.id, title: task.title }))}>
            {task.done ? <Check /> : null}
          </button>
          <div>
            <strong className={task.done ? "struck" : ""}>{task.title}</strong>
            <p>{task.done && task.doneAt ? `Finished ${formatDemoDateTime(task.doneAt)}` : shift.state === "in_progress" ? "To do" : "Starts with the shift"}</p>
            <TaskCompletionNote task={task} />
          </div>
          {task.issueId ? <Link href={`/issues/${task.issueId}`} aria-label={`Open the issue for ${task.title}`}><ArrowRight /></Link> : null}
        </article>
      ))}
    </>
  );
}

export function MyWorkScreen() {
  const { context } = useDemoContext();
  const { data } = useShellData();
  if (!data) return <LoadingState variant="panel" />;

  const shift = currentShiftFor(data.shifts, context.persona);
  const mine = data.issues
    .filter(isOpen)
    .flatMap((issue) => activeActions(issue).filter((action) => action.owner === context.persona && action.state !== "complete").map((action) => ({ issue, action })));
  const hasTasks = shift?.work.some((item) => item.owner === context.persona);

  return (
    <div className="mobile-task-page">
      <div className="mobile-page-header"><span className="eyebrow">{shift ? `${shift.name} · assigned work` : "Assigned work"}</span><h1>My Work</h1><p>Your tasks and actions.</p></div>
      <section className="mobile-stack">
        {shift ? <ShiftTasks shift={shift} name={context.persona} /> : null}
        {mine.length > 0 ? <h2>Issue actions</h2> : null}
        {mine.map(({ issue, action }) => (
          <Link className="mobile-card mobile-card--link" href={`/issues/${issue.id}`} key={action.id}>
            <Wrench />
            <div><StatusBadge value={action.state} /><strong>{action.title}</strong><p>{issue.issueNumber}{action.dueAt ? ` · due ${formatDemoTime(action.dueAt)}` : ""}</p></div>
            <ArrowRight />
          </Link>
        ))}
        {!hasTasks && mine.length === 0 ? (
          <article className="mobile-card"><CheckCircle2 /><div><strong>Nothing assigned to you</strong><p>New tasks and actions appear here as soon as they are given to you.</p></div></article>
        ) : null}
      </section>
    </div>
  );
}

/** Today's pre-start check for the machine the person is on: still to do, all clear, or faults reported. */
function PrestartCard({ unit, shiftId, now }: { unit: EquipmentView; shiftId: string; now: string }) {
  const history = useQuery({ queryKey: ["prestart", unit.id], queryFn: () => demoFetch<PrestartCheck[]>(`/prestart-checks?equipmentId=${encodeURIComponent(unit.id)}`), staleTime: 0 });
  const done = latestCheck(history.data ?? [], unit.id, shiftId, now);
  if (history.isPending) return null;
  if (!done) {
    return (
      <Link className="mobile-card mobile-card--link prestart-card prestart-card--due" href={`/checks/${unit.id}`}>
        <ListChecks />
        <div><small>Before you start</small><strong>Pre-start check for {unit.code}</strong><p>Not done yet this shift · about 3 minutes</p></div>
        <ArrowRight />
      </Link>
    );
  }
  return (
    <Link className={`mobile-card mobile-card--link prestart-card ${done.issueIds.length ? "prestart-card--faults" : "prestart-card--clear"}`} href={done.issueIds.length ? "/my-reports" : `/checks/${unit.id}`}>
      {done.issueIds.length ? <TriangleAlert /> : <ClipboardCheck />}
      <div><small>Pre-start check · {formatDemoTime(done.at)}</small><strong>{done.issueIds.length ? `${done.issueIds.length} fault${done.issueIds.length === 1 ? "" : "s"} reported on ${unit.code}` : `${unit.code} all clear`}</strong><p>{done.issueIds.length ? "Track them in My reports" : `Checked by ${done.by}`}</p></div>
      <ArrowRight />
    </Link>
  );
}

/**
 * The briefing for this shift and the handover from the shift before, each with "I've read it". The supervisor sees who has
 * confirmed; confirming records the person and the time once.
 */
function ReadCards({ shift }: { shift: ShiftView }) {
  const { context } = useDemoContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const previous = useQuery({ queryKey: ["shift", shift.previous?.id], queryFn: () => demoFetch<ShiftView>(`/shifts/${shift.previous!.id}`), enabled: Boolean(shift.previous) });
  const confirm = useMutation({
    mutationFn: (kind: "briefing" | "handover") => demoSend<ShiftView>(`/shifts/${shift.id}/read`, "POST", { kind }),
    onSuccess: async (_, kind) => {
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.push({ title: kind === "briefing" ? "Briefing confirmed" : "Handover confirmed", detail: "Your supervisor can see you have read it." });
    },
    onError: (error) => toast.push({ tone: "error", title: "Not recorded", detail: error instanceof Error ? error.message : undefined }),
  });
  const readAt = (kind: "briefing" | "handover") => (shift.acknowledgements ?? []).find((entry) => entry.name === context.persona && entry.kind === kind)?.at ?? null;
  const handover = previous.data?.handover;
  const showHandover = handover && handover.state !== "draft" && handover.notes;

  const card = (kind: "briefing" | "handover", title: string, by: string | null, text: string) => {
    const at = readAt(kind);
    return (
      <article className={`mobile-card read-card ${at ? "read-card--done" : ""}`}>
        {kind === "briefing" ? <MessageSquareText /> : <Repeat2 />}
        <div>
          <small>{title}{by ? ` · ${by}` : ""}</small>
          <p className="read-card__text">{text}</p>
          {at ? (
            <span className="read-card__done"><Check aria-hidden="true" /> You confirmed at {formatDemoTime(at)}</span>
          ) : (
            <button type="button" className="button button--primary read-card__confirm" disabled={confirm.isPending} onClick={() => confirm.mutate(kind)}>
              <Check aria-hidden="true" /> I&apos;ve read it
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className="mobile-stack" aria-labelledby="read-cards">
      <h2 id="read-cards">Before you start</h2>
      {shift.briefing ? card("briefing", "Briefing from your supervisor", shift.supervisor, shift.briefing) : null}
      {showHandover ? card("handover", `Handover from ${shift.previous?.name}`, handover.publishedBy, handover.notes) : null}
    </section>
  );
}
