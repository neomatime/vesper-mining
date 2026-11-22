"use client";

/**
 * The other Shift Control tabs and the Close shift task: Exceptions (the issues holding up a shift), Reports (production against
 * plan), the Handover tab (opens the current shift's handover) and Close shift (check the results, pass unfinished work on, send
 * the handover).
 *
 * Closing a shift sends its handover but does not mark it received: the incoming supervisor confirms receipt separately.
 */
import type { OperationalIssue, ProductionRecord } from "@vesper/api-contracts";
import { AlertTriangle, ArrowLeft, BarChart3, CalendarDays, Check, ClipboardList, Download, Info, Layers, Lock, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { demoFetch } from "@/lib/api";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { activeActions, isFinished, stateLabels } from "@/lib/issue-rules";
import { formatTonnes, productionStateLabels, productionTone } from "@/lib/shipment-rules";
import { formatDay, shiftTimes } from "@/lib/shift-format";
import { canActOnShift, type ShiftView } from "@/lib/shift-rules";
import { downloadCsv } from "@/lib/csv";
import { useDemoContext } from "@/stores/demo-context";
import { Field } from "./form-field";
import { ShiftControlTabs } from "./module-tabs";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { useLogistics } from "./use-logistics";
import { useShiftMutations } from "./use-shift-mutations";
import { RegisterView, type Register } from "./workspace-screen";

const issueTone = (issue: OperationalIssue) => (isFinished(issue.workflowState) || issue.workflowState === "verified" ? "closed" : issue.workflowState === "reported" ? "draft" : issue.workflowState === "awaiting_dependency" ? "awaiting_dependency" : "in_progress");

// ---- Exceptions --------------------------------------------------------------------------------------------------------

export function ShiftExceptionsScreen() {
  const { data: shell, isLoading } = useShellData();
  if (isLoading || !shell) return <LoadingState />;
  const shiftOf = (issue: OperationalIssue) => shell.shifts.find((shift) => shift.work.some((item) => item.issueId === issue.id))?.name ?? null;
  const dueOf = (issue: OperationalIssue) => activeActions(issue).filter((action) => action.state !== "complete" && action.dueAt).map((action) => action.dueAt as string).sort()[0] ?? null;
  const open = shell.issues.filter((issue) => !isFinished(issue.workflowState) && issue.workflowState !== "verified");
  const current = shell.shifts.find((shift) => shift.state === "in_progress");
  const dueThisShift = current ? open.filter((issue) => { const due = dueOf(issue); return due && Date.parse(due) <= Date.parse(current.endsAt); }).length : 0;

  const register: Register<OperationalIssue> = {
    icon: AlertTriangle,
    tiles: [
      { label: "Open issues", value: open.length, hint: "Not yet verified or closed", attention: open.length > 0 },
      { label: "Due this shift", value: dueThisShift, hint: "Actions due before the shift ends", attention: dueThisShift > 0 },
      { label: "Closed", value: shell.issues.length - open.length, hint: "Finished and kept as history" },
    ],
    columns: [
      { key: "issue", label: "Issue", render: (issue) => <span className="cell-main"><strong>{issue.title}</strong><small>{issue.issueNumber}</small></span> },
      { key: "shift", label: "Shift", render: (issue) => shiftOf(issue) ?? <span className="muted">—</span> },
      { key: "owner", label: "Owner", render: (issue) => issue.owner ?? <span className="muted">Not assigned</span> },
      { key: "due", label: "Due", render: (issue) => { const due = dueOf(issue); return isFinished(issue.workflowState) ? "Completed" : due ? formatDemoDateTime(due) : <span className="muted">No deadline</span>; } },
      { key: "status", label: "Status", render: (issue) => <StatusBadge value={issueTone(issue)} label={stateLabels[issue.workflowState]} /> },
      { key: "next", label: "Next step", render: (issue) => <span className="row-link-text">{isFinished(issue.workflowState) ? "View issue" : issue.owner ? "Add update" : "Choose an owner"}</span> },
    ],
    filters: [
      { key: "open", label: "Open", test: (issue) => !isFinished(issue.workflowState) && issue.workflowState !== "verified" },
      { key: "all", label: "All", test: () => true },
      { key: "closed", label: "Closed", test: (issue) => isFinished(issue.workflowState) || issue.workflowState === "verified" },
    ],
    href: (issue) => `/exceptions/${issue.id}`,
    text: (issue) => [issue.issueNumber, issue.title, issue.owner, shiftOf(issue)].join(" "),
    rows: shell.issues,
    action: { label: "Report an issue", href: "/exceptions/new", plus: true },
    emptyTitle: "No issues",
    emptyBody: "Nothing is holding up the shift. Report an issue if something is.",
    footnote: "Open issues stay visible until they are resolved.",
  };

  return (
    <RegisterView
      initialFilter="all"
      header={{ eyebrow: "Shift Control & Handover", title: "Exceptions", description: "See what is holding up a shift and who will fix it." }}
      register={register}
      tabs={
        <>
          <ShiftControlTabs active="exceptions" />
          <div className="note-bar" style={{ marginBottom: 14 }}><Info /> <span>Showing shift issues from Work &amp; Exceptions. <Link className="row-link" href="/exceptions">Open all issues</Link></span></div>
        </>
      }
    />
  );
}

// ---- Reports -----------------------------------------------------------------------------------------------------------

export function ShiftReportsScreen() {
  const query = useLogistics();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const records = [...query.data.production].sort((a, b) => a.number.localeCompare(b.number));
  const sum = (pick: (item: (typeof records)[number]) => number) => records.reduce((total, item) => total + pick(item), 0);
  const waiting = records.filter((item) => item.state === "needs_checking");
  const download = () =>
    downloadCsv("shift-production.csv", [
      ["Record", "Shift", "Material", "Target (t)", "Reported (t)", "Checked (t)", "Status"],
      ...records.map((item) => [item.number, item.shiftName, item.mineral, item.targetTonnes, item.reportedTonnes, item.check?.confirmedTonnes ?? "", productionStateLabels[item.state]]),
    ]);

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Shift Control & Handover" title="Shift reports" description="Compare the plan with the recorded and checked amounts." icon={BarChart3} action={<button className="button button--primary" onClick={download}><Download /> Download report</button>} />
      <ShiftControlTabs active="reports" />
      <p className="notice-line">Shift view of Reports. <Link className="row-link" href="/reports">Open all reports</Link></p>
      <section className="kpi-row" aria-label="Summary">
        <article className="kpi"><span>Target</span><strong>{formatTonnes(sum((item) => item.targetTonnes))}</strong><small>Planned for these shifts</small></article>
        <article className="kpi"><span>Reported</span><strong>{formatTonnes(sum((item) => item.reportedTonnes))}</strong><small>Recorded by supervisors</small></article>
        <article className="kpi"><span>Checked</span><strong>{formatTonnes(sum((item) => item.check?.confirmedTonnes ?? 0))}</strong><small>Confirmed quantities</small></article>
        <article className={`kpi ${waiting.length ? "kpi--attention" : ""}`}><span>Needs checking</span><strong>{waiting.length === 1 ? "1 record" : `${waiting.length} records`}</strong><small>{waiting.length ? "Not counted as stock yet" : "Everything is checked"}</small></article>
      </section>
      <section className="card register-card">
        <div className="card__header"><div><h2>Production summary</h2></div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Shift</th><th scope="col">Material</th><th scope="col" className="number-cell">Target</th><th scope="col" className="number-cell">Reported</th><th scope="col" className="number-cell">Checked</th><th scope="col">Result</th></tr></thead>
            <tbody>
              {records.map((item) => (
                <tr key={item.id}>
                  <td data-label="Shift">{item.shiftName}</td><td data-label="Material">{item.mineral}</td>
                  <td data-label="Target" className="number-cell">{formatTonnes(item.targetTonnes)}</td>
                  <td data-label="Reported" className="number-cell">{formatTonnes(item.reportedTonnes)}</td>
                  <td data-label="Checked" className="number-cell">{item.check ? formatTonnes(item.check.confirmedTonnes) : "—"}</td>
                  <td data-label="Result"><StatusBadge value={productionTone[item.state]} label={productionStateLabels[item.state]} /></td>
                </tr>
              ))}
              <tr className="total-row">
                <td data-label="Shift">Total</td><td />
                <td className="number-cell" data-label="Target">{formatTonnes(sum((item) => item.targetTonnes))}</td>
                <td className="number-cell" data-label="Reported">{formatTonnes(sum((item) => item.reportedTonnes))}</td>
                <td className="number-cell" data-label="Checked">{formatTonnes(sum((item) => item.check?.confirmedTonnes ?? 0))}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
        {waiting.length > 0 ? <p className="card__footnote">Checked total excludes {waiting.map((item) => item.shiftName).join(", ")} until the quantity is confirmed.</p> : null}
      </section>
      {waiting.length > 0 ? (
        <section className="card register-card"><div className="card__header"><div><h2>Needs attention</h2></div></div>
          <p className="empty-line">{waiting.map((item) => `${item.shiftName}: check ${formatTonnes(item.reportedTonnes)} reported. `).join("")}Owner: Inventory controller.</p>
        </section>
      ) : null}
    </div>
  );
}

// ---- Handover tab ------------------------------------------------------------------------------------------------------

/** Opens the handover of the shift that is running now, or the next one, so the tab always leads somewhere useful. */
export function HandoverTabScreen() {
  const router = useRouter();
  const { data: shell, isLoading } = useShellData();
  const target = shell ? (shell.shifts.find((shift) => shift.state === "in_progress") ?? shell.shifts.find((shift) => shift.state === "scheduled"))?.id : undefined;
  useEffect(() => { if (target) router.replace(`/shifts/${target}/handover`); }, [target, router]);
  if (isLoading) return <LoadingState />;
  if (!target) {
    return (
      <div className="workspace-page">
        <PageHeader eyebrow="Shift Control & Handover" title="Handover" description="Tell the next team what is done and what needs attention." icon={ClipboardList} />
        <ShiftControlTabs active="handover" />
        <section className="card empty-inline empty-inline--centered"><strong>No shift to hand over</strong><span>Schedule or start a shift first. <Link className="row-link" href="/shifts">Go to Shifts</Link></span></section>
      </div>
    );
  }
  return <LoadingState />;
}

// ---- Close shift -------------------------------------------------------------------------------------------------------

export function CloseShiftScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["shift", id], queryFn: () => demoFetch<ShiftView>(`/shifts/${id}`) });
  const logistics = useLogistics();
  const { data: shell } = useShellData();
  if (query.isPending || logistics.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  if (logistics.isError) return <ErrorState message={logistics.error.message} onRetry={() => logistics.refetch()} />;
  return <CloseForm shift={query.data} production={logistics.data.production.filter((item) => item.shiftId === id)} issues={shell?.issues ?? []} />;
}

function CloseForm({ shift, production, issues }: { shift: ShiftView; production: ProductionRecord[]; issues: OperationalIssue[] }) {
  const router = useRouter();
  const { context } = useDemoContext();
  const actor = { name: context.persona, role: context.role };
  const mutations = useShiftMutations(shift);
  const { data: shell } = useShellData();
  const nextShift = shell?.shifts.find((item) => item.id === shift.next?.id);
  const [notes, setNotes] = useState(shift.handover.notes);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const permission = canActOnShift("run", actor, shift);
  const unfinished = shift.work.filter((item) => !item.done);
  const missingOwner = unfinished.filter((item) => !item.owner);
  const dueOf = (issueId: string | null) => {
    const issue = issues.find((item) => item.id === issueId);
    const due = issue ? activeActions(issue).filter((action) => action.state !== "complete" && action.dueAt).map((action) => action.dueAt as string).sort()[0] : undefined;
    return due ? formatDemoDateTime(due) : shift.next ? `When ${shift.next.name} starts` : "Next shift";
  };
  const draft = shift.handover.state === "draft";
  const canEditNotes = draft && permission.allowed;

  if (shift.state !== "in_progress") {
    return (
      <div className="task-page">
        <Link href={`/shifts/${shift.id}`} className="back-link"><ArrowLeft /> Back to shifts</Link>
        <section className="card detail-card restricted"><Lock aria-hidden="true" /><h2>{shift.name} is not running</h2><p>{shift.state === "closed" ? "This shift is already closed." : "Only a running shift can be closed."}</p></section>
      </div>
    );
  }
  if (!permission.allowed) {
    return (
      <div className="task-page">
        <Link href={`/shifts/${shift.id}`} className="back-link"><ArrowLeft /> Back to shifts</Link>
        <section className="card detail-card restricted"><Lock aria-hidden="true" /><h2>This step is for the shift supervisor</h2><p>{permission.reason}</p></section>
      </div>
    );
  }

  const closeShift = async () => {
    setError("");
    if (missingOwner.length > 0) return setError(`Give each unfinished task an owner first: ${missingOwner.map((item) => item.title).join(", ")}.`);
    if (!reviewed) return setError("Tick “I have reviewed the handover” to continue.");
    const text = notes.trim();
    if (draft && shift.unresolved + unfinished.length > 0 && text.length < 20) return setError("Write a note for the next team, at least 20 characters, so the unfinished work is not lost.");
    setBusy(true);
    try {
      if (draft && text.length >= 20) await mutations.publish.mutateAsync(text);
      await mutations.close.mutateAsync();
      router.push("/shifts");
    } catch {
      // The mutation hooks have already told the person what went wrong.
    } finally {
      setBusy(false);
    }
  };

  const saveLater = async () => {
    setBusy(true);
    try {
      if (canEditNotes && notes !== shift.handover.notes) await mutations.saveNotes.mutateAsync(notes);
      router.push("/shifts");
    } catch {
      // Already reported.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="task-page">
      <Link href={`/shifts/${shift.id}`} className="back-link"><ArrowLeft /> Back to shifts</Link>
      <PageHeader eyebrow="Shift Control & Handover" title="Close shift" description="Check the results and pass unfinished work to the next team." icon={Users} />
      <section className="card task-card">
        <div className="task-context"><CalendarDays size={18} aria-hidden="true" /><strong>{shift.name}</strong><span>{formatDay(shift.startsAt)} · {shiftTimes(shift)}</span></div>

        <section className="task-section">
          <h2><Layers size={18} aria-hidden="true" /> Production</h2>
          {production.length === 0 ? <p className="field-hint">No production was recorded for this shift. <Link className="row-link" href="/shifts/production/new">Record production</Link></p> : (
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th scope="col">Mineral</th><th scope="col" className="number-cell">Target</th><th scope="col" className="number-cell">Reported</th><th scope="col">Submitted</th><th scope="col" /></tr></thead>
              <tbody>{production.map((item) => (
                <tr key={item.id}><td data-label="Mineral">{item.mineral}</td><td className="number-cell" data-label="Target">{formatTonnes(item.targetTonnes)}</td><td className="number-cell" data-label="Reported">{formatTonnes(item.reportedTonnes)}</td>
                  <td data-label="Submitted"><StatusBadge value={productionTone[item.state]} label={productionStateLabels[item.state]} /></td>
                  <td><Link className="row-link-text" href={`/shipments/inventory/check/${item.id}`}>View production</Link></td></tr>
              ))}</tbody>
            </table></div>
          )}
          <p className="field-hint">Checking can continue after the shift closes.</p>
        </section>

        <section className="task-section">
          <h2><ClipboardList size={18} aria-hidden="true" /> Work to carry forward</h2>
          {unfinished.length === 0 ? <div className="note-bar note-bar--good"><Check /> <span>Everything planned for this shift is done.{shift.unresolved > 0 ? ` ${shift.unresolved} open ${shift.unresolved === 1 ? "issue stays" : "issues stay"} open and visible to the next team.` : ""}</span></div> : (
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th scope="col">Task</th><th scope="col">Next owner</th><th scope="col">Due</th></tr></thead>
              <tbody>{unfinished.map((item) => <tr key={item.id}><td data-label="Task">{item.title}</td><td data-label="Next owner">{item.owner ?? <span className="muted">Not assigned</span>}</td><td data-label="Due">{dueOf(item.issueId)}</td></tr>)}</tbody>
            </table></div>
          )}
          {unfinished.length > 0 ? (missingOwner.length === 0 ? <div className="note-bar note-bar--good"><Check /> <span>All owners assigned.</span></div> : <div className="note-bar note-bar--warn" role="status"><AlertTriangle /> <span>{missingOwner.length} {missingOwner.length === 1 ? "task has" : "tasks have"} no owner. <Link className="row-link" href={`/shifts/${shift.id}`}>Assign owners on the shift page</Link>.</span></div>) : null}
        </section>

        <section className="task-section">
          <h2><Users size={18} aria-hidden="true" /> Next shift</h2>
          <div className="task-grid task-grid--two">
            <div className="fact-row">
              <div className="fact"><span>Shift</span><strong>{shift.next ? `${shift.next.name}${nextShift ? ` · ${shiftTimes(nextShift)}` : ""}` : "None scheduled"}</strong></div>
              <div className="fact"><span>Next supervisor</span><strong>{shift.next?.supervisor ?? "Not assigned"}</strong></div>
            </div>
            <Field label="Note for the next team" hint={draft ? undefined : "The handover has already been sent, so the note is locked."}>
              <textarea rows={3} value={notes} readOnly={!canEditNotes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>
        </section>

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} style={{ width: 20, height: 20 }} /> I have reviewed the handover.</label>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        <div className="task-footer">
          <p>{shift.next?.supervisor ?? "The next supervisor"} will still need to confirm receipt.</p>
          <div className="button-row">
            <button type="button" className="button button--quiet" disabled={busy} onClick={saveLater}>Save and finish later</button>
            <button type="button" className="button button--primary" disabled={busy} onClick={closeShift}><Check /> {busy ? "Closing…" : "Close shift & send handover"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
