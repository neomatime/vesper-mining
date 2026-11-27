"use client";

/**
 * My reports: everything the person reported and where it stands now, and the outbox of reports and checks recorded offline
 * that are still waiting to be sent from this phone.
 */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CloudOff, Inbox, RotateCw, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import type { OperationalIssue } from "@vesper/api-contracts";
import { ErrorState, LoadingState } from "@core/components/query-state";
import { useOutboxSync } from "@core/components/use-outbox-sync";
import { demoFetch } from "@core/lib/api";
import { formatDemoDateTime } from "@core/lib/demo-clock";
import { useDemoContext } from "@core/stores/demo-context";
import { useOutbox } from "@core/stores/outbox";

/** The steps a reporter cares about, from their report being received to the fix being checked. */
const steps = ["Received", "Reviewed", "Being fixed", "Fixed", "Checked"] as const;
function stepOf(state: OperationalIssue["workflowState"]): { index: number; label: string; closedWithout?: boolean } {
  switch (state) {
    case "reported": return { index: 0, label: "Received, waiting for review" };
    case "reviewed": return { index: 1, label: "Reviewed by the supervisor" };
    case "action_assigned": return { index: 2, label: "Work assigned" };
    case "in_progress": return { index: 2, label: "Being fixed" };
    case "awaiting_dependency": return { index: 2, label: "Waiting on parts or a contractor" };
    case "reopened": return { index: 2, label: "Reopened" };
    case "resolution_reported": return { index: 3, label: "Fixed, waiting to be checked" };
    case "verified": return { index: 4, label: "Fix checked" };
    case "closed": return { index: 4, label: "Closed" };
    default: return { index: 4, label: state === "duplicate" ? "Closed as a duplicate" : "Closed without action", closedWithout: true };
  }
}

export function MyReportsScreen() {
  const persona = useDemoContext((state) => state.context.persona);
  const connectivity = useDemoContext((state) => state.connectivity);
  const setConnectivity = useDemoContext((state) => state.setConnectivity);
  const outbox = useOutbox((state) => state.items).filter((item) => item.by === persona);
  const remove = useOutbox((state) => state.remove);
  const { send, sending } = useOutboxSync();
  const query = useQuery({ queryKey: ["issues", "mine"], queryFn: () => demoFetch<OperationalIssue[]>("/issues"), staleTime: 0 });

  const mine = (query.data ?? [])
    .filter((issue) => issue.events.some((event) => event.type === "reported" && event.actor === persona))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const open = mine.filter((issue) => stepOf(issue.workflowState).index < 4);
  const done = mine.filter((issue) => stepOf(issue.workflowState).index >= 4);

  return (
    <div className="mobile-task-page">
      <div className="mobile-page-header">
        <span className="eyebrow">Track</span>
        <h1>My reports</h1>
        <p>Everything you reported, and where it stands now.</p>
      </div>

      {outbox.length ? (
        <section className="mobile-stack outbox" aria-labelledby="outbox-title">
          <h2 id="outbox-title"><CloudOff aria-hidden="true" /> Waiting to send ({outbox.length})</h2>
          <p className="muted">Kept on this phone. Not received centrally until it is sent{connectivity === "offline" ? ", when you are back online" : ""}.</p>
          {outbox.map((item) => (
            <article className={`mobile-card outbox__item ${item.lastError ? "outbox__item--error" : ""}`} key={item.id}>
              <Inbox />
              <div>
                <small>{item.kind === "prestart" ? "Pre-start check" : "Report"} · kept on this phone</small>
                <strong>{item.title}</strong>
                {item.lastError ? <p className="field-error">Not accepted: {item.lastError}</p> : <p>Pending Synchronisation</p>}
              </div>
              <button type="button" className="icon-button icon-button--light" aria-label={`Remove ${item.title} from this phone`} onClick={() => { if (window.confirm(`Remove "${item.title}"? It has not been sent and will be lost.`)) remove(item.id); }}><Trash2 /></button>
            </article>
          ))}
          {connectivity === "offline" ? (
            <button type="button" className="button button--primary button--wide" onClick={() => setConnectivity("online")}><RotateCw aria-hidden="true" /> Back online and send</button>
          ) : (
            <button type="button" className="button button--primary button--wide" onClick={() => void send()} disabled={sending}><Send aria-hidden="true" /> {sending ? "Sending…" : "Send now"}</button>
          )}
        </section>
      ) : null}

      {query.isPending ? <LoadingState variant="panel" /> : query.isError && !query.data ? <ErrorState message="Your reports could not be loaded." onRetry={() => query.refetch()} retrying={query.isFetching} /> : (
        <>
          <section className="mobile-stack" aria-labelledby="open-reports">
            <h2 id="open-reports">Open ({open.length})</h2>
            {open.length ? open.map((issue) => <ReportCard key={issue.id} issue={issue} />) : (
              <article className="mobile-card"><AlertTriangle /><div><strong>Nothing open</strong><p>When you report something, you can follow it here.</p></div></article>
            )}
            <Link className="button button--quiet button--wide" href="/report"><AlertTriangle aria-hidden="true" /> Report an issue</Link>
          </section>
          {done.length ? (
            <section className="mobile-stack" aria-labelledby="done-reports">
              <h2 id="done-reports">Closed ({done.length})</h2>
              {done.map((issue) => <ReportCard key={issue.id} issue={issue} />)}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReportCard({ issue }: { issue: OperationalIssue }) {
  const step = stepOf(issue.workflowState);
  return (
    <Link className="mobile-card mobile-card--link report-card" href={`/issues/${issue.id}`} aria-label={`${issue.title}: ${step.label}`}>
      <div>
        <small>{issue.issueNumber} · updated {formatDemoDateTime(issue.updatedAt)}</small>
        <strong>{issue.title}</strong>
        <ol className={`report-steps ${step.closedWithout ? "report-steps--closed" : ""}`} aria-label={`Progress: ${step.label}`}>
          {steps.map((label, index) => <li key={label} className={index < step.index ? "is-done" : index === step.index ? "is-current" : ""} title={label} />)}
        </ol>
        <p>{step.label}{issue.attachments?.length ? ` · ${issue.attachments.length} photo${issue.attachments.length === 1 ? "" : "s"}` : ""}</p>
      </div>
      <ArrowRight />
    </Link>
  );
}
