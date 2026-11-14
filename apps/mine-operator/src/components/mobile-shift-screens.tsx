"use client";

import { AlertTriangle, ArrowRight, Bell, CalendarDays, Check, CheckCircle2, Clock3, MapPin, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDemoTime, formatDemoDateTime } from "@/lib/demo-clock";
import { activeActions, isOpen } from "@/lib/issue-rules";
import { remaining, shiftTimes } from "@/lib/shift-format";
import type { ShiftView } from "@/lib/shift-rules";
import { useDemoContext } from "@/stores/demo-context";
import { LoadingState } from "./query-state";
import { useNotifications } from "./notification-list";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { useShiftMutations } from "./use-shift-mutations";
import { TaskCompletionDialog, TaskCompletionNote } from "./task-completion";

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** The shift a person is on right now, or the next one they are on. */
function myShift(shifts: ShiftView[], name: string) {
  const mine = shifts.filter((shift) => (shift.state === "in_progress" || shift.state === "scheduled") && (shift.supervisor === name || shift.crew.some((member) => member.name === name)));
  return mine.find((shift) => shift.state === "in_progress") ?? mine.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
}

function greeting(now: string) {
  const hour = Number(formatDemoTime(now).slice(0, 2));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function MyShiftScreen() {
  const { context } = useDemoContext();
  const { data } = useShellData();
  const notifications = useNotifications();
  if (!data) return <LoadingState />;

  const shift = myShift(data.shifts, context.persona);
  const first = context.persona.split(" ")[0];

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
          <Link href="/mobile/report"><AlertTriangle /><span><strong>Report</strong><small>Record an issue</small></span></Link>
          <Link href="/mobile/notifications"><Bell /><span><strong>Track</strong><small>{notifications.unread} unread {notifications.unread === 1 ? "alert" : "alerts"}</small></span></Link>
        </section>
        <section className="mobile-stack">
          <Link className="mobile-card mobile-card--link" href="/mobile/schedule"><CalendarDays /><div><strong>Shift calendar</strong><p>See the shifts you are on, day by day</p></div><ArrowRight /></Link>
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

      {priority ? (
        <section className="mobile-priority">
          <div><AlertTriangle /><span><small>Needs attention</small><strong>{priority.title}</strong><p>{priority.description}</p></span></div>
          <Link href={`/exceptions/${priority.id}`}>Track issue <ArrowRight /></Link>
        </section>
      ) : null}

      <section className="mobile-actions">
        <Link href="/mobile/report"><AlertTriangle /><span><strong>Report</strong><small>Record an issue</small></span></Link>
        <Link href="/mobile/my-work"><Wrench /><span><strong>Act</strong><small>{myOpenTasks} open {myOpenTasks === 1 ? "task" : "tasks"}</small></span></Link>
        <Link href="/mobile/notifications"><Bell /><span><strong>Track</strong><small>{notifications.unread} unread {notifications.unread === 1 ? "alert" : "alerts"}</small></span></Link>
      </section>

      <section className="mobile-stack">
        <Link className="mobile-card mobile-card--link" href="/mobile/schedule"><CalendarDays /><div><strong>Shift calendar</strong><p>See the shifts you are on, day by day</p></div><ArrowRight /></Link>
      </section>

      {shift.briefing ? (
        <section className="mobile-stack"><h2>From your supervisor</h2><article className="mobile-card"><div><p>{shift.briefing}</p></div></article></section>
      ) : null}
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
          {task.issueId ? <Link href={`/exceptions/${task.issueId}`} aria-label={`Open the issue for ${task.title}`}><ArrowRight /></Link> : null}
        </article>
      ))}
    </>
  );
}

export function MyWorkScreen() {
  const { context } = useDemoContext();
  const { data } = useShellData();
  if (!data) return <LoadingState />;

  const shift = myShift(data.shifts, context.persona);
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
          <Link className="mobile-card mobile-card--link" href={`/exceptions/${issue.id}`} key={action.id}>
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
