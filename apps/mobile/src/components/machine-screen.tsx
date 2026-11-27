"use client";

/**
 * A machine as the field sees it, opened by scanning its QR label or typing its fleet number: what it is, whether it is
 * reported available, today's pre-start check, the issues open on it, and the two things to do from here (check it, report a
 * fault on it).
 */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, ClipboardCheck, ListChecks, MapPin, ScanLine, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { LoadingState } from "@core/components/query-state";
import { useShellData } from "@core/components/shell-data";
import { StatusBadge } from "@core/components/status-badge";
import { demoFetch } from "@core/lib/api";
import { formatDemoDateTime, formatDemoTime } from "@core/lib/demo-clock";
import { categoryLabels, stateLabels as availabilityLabels } from "@core/lib/equipment-rules";
import { isOpen, stateLabels } from "@core/lib/issue-rules";
import { latestCheck, prestartCategories, type PrestartCheck } from "@core/lib/prestart-rules";
import { currentShiftFor } from "@core/lib/shift-rules";
import { useDemoContext } from "@core/stores/demo-context";

export function MachineScreen({ id }: { id: string }) {
  const { data } = useShellData();
  const { context } = useDemoContext();
  const checks = useQuery({ queryKey: ["prestart", id], queryFn: () => demoFetch<PrestartCheck[]>(`/prestart-checks?equipmentId=${encodeURIComponent(id)}`), staleTime: 0 });
  if (!data) return <LoadingState variant="panel" />;

  const machine = data.equipment.find((item) => item.id === id);
  if (!machine) {
    return (
      <div className="mobile-task-page">
        <Link href="/scan" className="back-link"><ArrowLeft /> Scan again</Link>
        <div className="mobile-page-header"><h1>Machine not found</h1><p>This label is not linked to a machine at {context.siteName}. Ask the supervisor to check it.</p></div>
      </div>
    );
  }
  const issues = data.issues.filter((issue) => issue.equipmentId === machine.id && isOpen(issue));
  const checkable = prestartCategories.includes(machine.category);
  const shift = currentShiftFor(data.shifts, context.persona);
  const done = checkable ? latestCheck(checks.data ?? [], machine.id, shift?.id ?? null, data.now) : null;

  return (
    <div className="mobile-task-page">
      <Link href="/scan" className="back-link"><ArrowLeft /> Scan another</Link>
      <div className="mobile-page-header">
        <span className="eyebrow">{categoryLabels[machine.category]} · {machine.code}</span>
        <h1>{machine.name}</h1>
        <p>{machine.makeModel ?? ""}{machine.hours !== null && machine.hours !== undefined ? `${machine.makeModel ? " · " : ""}${machine.hours.toLocaleString("en-GB")} hours` : ""}</p>
        <StatusBadge value={machine.state === "available" ? "complete" : "blocked"} label={`${availabilityLabels[machine.state]} (${machine.stateQuality})`} />
      </div>

      <section className="mobile-actions mobile-actions--two">
        {checkable ? <Link href={`/checks/${machine.id}`}><ListChecks /><span><strong>Pre-start</strong><small>{done ? `Done ${formatDemoTime(done.at)}` : "Not done this shift"}</small></span></Link> : null}
        <Link href={`/report?equipmentId=${encodeURIComponent(machine.id)}`}><AlertTriangle /><span><strong>Report a fault</strong><small>On {machine.code}</small></span></Link>
      </section>

      <section className="mobile-stack" aria-label="Machine details">
        <article className="mobile-card"><MapPin /><div><small>Where</small><strong>{machine.areaName ?? machine.location ?? "Not recorded"}</strong></div></article>
        {checkable ? (
          <article className="mobile-card">{done?.issueIds.length ? <TriangleAlert /> : <ClipboardCheck />}<div><small>Pre-start check this shift</small><strong>{done ? (done.issueIds.length ? `${done.issueIds.length} fault${done.issueIds.length === 1 ? "" : "s"} reported` : "All clear") : "Not done yet"}</strong>{done ? <p>{done.by} · {formatDemoTime(done.at)}</p> : null}</div></article>
        ) : null}
      </section>

      <section className="mobile-stack" aria-labelledby="machine-issues">
        <h2 id="machine-issues">Open issues ({issues.length})</h2>
        {issues.length ? issues.map((issue) => (
          <Link className="mobile-card mobile-card--link" key={issue.id} href={`/issues/${issue.id}`}>
            <Wrench />
            <div><small>{issue.issueNumber} · {stateLabels[issue.workflowState]}</small><strong>{issue.title}</strong><p>Reported {formatDemoDateTime(issue.reportedAt)}</p></div>
            <ArrowRight />
          </Link>
        )) : <p className="muted">No open issues on this machine.</p>}
      </section>

      <Link className="button button--quiet button--wide" href="/scan"><ScanLine aria-hidden="true" /> Scan another machine</Link>
    </div>
  );
}
