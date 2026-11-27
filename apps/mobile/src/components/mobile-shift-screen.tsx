"use client";

/**
 * A shift as the field sees it on the phone: when it runs, who supervises, the crew with their duties, the briefing and the work.
 * Read-only: shifts are planned and changed in Mining Operations.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Clock3, HardHat, MessageSquareText, UserRound } from "lucide-react";
import Link from "next/link";
import { ErrorState, LoadingState } from "@core/components/query-state";
import { useShellData } from "@core/components/shell-data";
import { StatusBadge } from "@core/components/status-badge";
import { demoFetch } from "@core/lib/api";
import { formatDemoDateTime } from "@core/lib/demo-clock";
import { shiftTimes } from "@core/lib/shift-format";
import { shiftStateLabels, type ShiftView } from "@core/lib/shift-rules";
import { useDemoContext } from "@core/stores/demo-context";

export function MobileShiftScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["shift", id], queryFn: () => demoFetch<ShiftView>(`/shifts/${id}`) });
  const { data: shell } = useShellData();
  const { context } = useDemoContext();
  if (query.isPending) return <LoadingState variant="panel" />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;

  const shift = query.data;
  const unit = (equipmentId: string | null) => shell?.equipment.find((item) => item.id === equipmentId)?.name;

  return (
    <div className="mobile-task-page">
      <Link href="/schedule" className="back-link"><ArrowLeft /> Shift calendar</Link>
      <div className="mobile-page-header">
        <span className="eyebrow">{formatDemoDateTime(shift.startsAt).split(",")[0]}</span>
        <h1>{shift.name}</h1>
        <p>{shiftTimes(shift)}</p>
        <StatusBadge value={shift.state === "in_progress" ? "in_progress" : shift.state === "closed" ? "complete" : shift.state === "cancelled" ? "unknown" : "pending"} label={shiftStateLabels[shift.state]} />
      </div>

      <section className="mobile-stack" aria-label="Shift details">
        <article className="mobile-card"><UserRound /><div><small>Supervisor</small><strong>{shift.supervisor ?? "Not assigned yet"}</strong></div></article>
        <article className="mobile-card"><Clock3 /><div><small>Runs</small><strong>{formatDemoDateTime(shift.startsAt)} – {formatDemoDateTime(shift.endsAt)}</strong></div></article>
        {shift.briefing ? <article className="mobile-card"><MessageSquareText /><div><small>Briefing</small><p>{shift.briefing}</p></div></article> : null}
      </section>

      <section className="mobile-stack" aria-labelledby="shift-crew">
        <h2 id="shift-crew">Crew ({shift.crew.length})</h2>
        {shift.crew.length ? shift.crew.map((member) => (
          <article className={`mobile-card ${member.name === context.persona ? "mobile-card--unread" : ""}`} key={member.id}>
            <HardHat />
            <div><small>{member.duty}{member.name === context.persona ? " · you" : ""}</small><strong>{member.name}</strong>{unit(member.equipmentId) ? <p>{unit(member.equipmentId)}</p> : null}</div>
          </article>
        )) : <p className="muted">No crew on this shift yet.</p>}
      </section>

      <section className="mobile-stack" aria-labelledby="shift-work">
        <h2 id="shift-work">Work ({shift.work.length})</h2>
        {shift.work.length ? shift.work.map((item) => (
          <article className="mobile-card" key={item.id}>
            {item.done ? <CheckCircle2 /> : <Circle />}
            <div><small>{item.done ? "Done" : "Open"}{item.owner ? ` · ${item.owner}` : ""}</small><strong>{item.title}</strong></div>
          </article>
        )) : <p className="muted">No work listed for this shift.</p>}
      </section>
    </div>
  );
}
