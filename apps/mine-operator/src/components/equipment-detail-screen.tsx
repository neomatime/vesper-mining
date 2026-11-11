"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, FileText, Gauge, Wrench } from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "./query-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

type EquipmentRecord = {
  id: string;
  code: string;
  name: string;
  area: string;
  state: string;
  quality: string;
  nextAction: string;
};

export function EquipmentDetailScreen({ id, maintenance = false }: { id: string; maintenance?: boolean }) {
  const query = useQuery({
    queryKey: ["equipment", id],
    queryFn: () => demoFetch<EquipmentRecord>(`/equipment/${id}`),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const item = query.data;

  return (
    <div className="workspace-page">
      <Link href="/equipment" className="back-link"><ArrowLeft /> Equipment register</Link>
      <PageHeader eyebrow={`${item.code} · Equipment & Maintenance`} title={maintenance ? `${item.name} maintenance` : item.name} description="Equipment state, maintenance evidence and delay stages remain linked without implying operational clearance." icon={Wrench} action={<StatusBadge value={item.state.includes("Unavailable") ? "reported" : "verified"} label={item.state} />} />
      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Asset context</span><h2>Current record</h2></div><StatusBadge value={item.quality.toLowerCase().includes("verified") ? "verified" : "reported"} label={item.quality} /></header>
            <dl className="definition-grid">
              <div><dt>Asset code</dt><dd>{item.code}</dd></div>
              <div><dt>Assigned area</dt><dd>{item.area}</dd></div>
              <div><dt>Reported state</dt><dd>{item.state}</dd></div>
              <div><dt>Next action</dt><dd>{item.nextAction}</dd></div>
              <div><dt>External reference</dt><dd><FileText /> CMMS-WO-DEMO-2048</dd></div>
              <div><dt>Source freshness</dt><dd><Clock3 /> 24 Apr · 08:42 demo time</dd></div>
            </dl>
          </article>
          <article className="card detail-card">
            <header className="card__header"><div><span className="eyebrow">Delay intelligence</span><h2>Recorded stage timeline</h2></div><span>Incomplete intervals remain labelled</span></header>
            <div className="stage-timeline">
              <div className="complete"><CheckCircle2 /><strong>Fault detected</strong><small>08:02 · reported source</small></div>
              <div className="complete"><CheckCircle2 /><strong>Response started</strong><small>08:17 · Maintenance</small></div>
              <div className="active"><Gauge /><strong>Resources confirmation</strong><small>In progress · duration not final</small></div>
              <div><span /><strong>Repair completed</strong><small>Pending</small></div>
              <div><span /><strong>Authorised release recorded</strong><small>Managed by the approved mine process</small></div>
              <div><span /><strong>Operation resumed</strong><small>Not yet recorded</small></div>
            </div>
          </article>
        </div>
        <aside className="detail-layout__aside">
          <article className="card next-action-card">
            <span className="eyebrow">Upcoming maintenance</span>
            <CalendarClock />
            <h2>{item.code === "EX-204" ? "1,000 hour service" : "Maintenance context"}</h2>
            <p>{item.code === "EX-204" ? "200 operating hours remain from the verified fixture reading. At 10 hours/day, the illustrative estimate is 20 days." : "Open the linked issue and evidence before changing the reported state."}</p>
            {item.code === "EX-204" ? <Link href="/resources/readiness-ex204-1000h" className="button button--primary button--wide">Review resource readiness</Link> : <Link href="/exceptions/issue-riv-001" className="button button--primary button--wide">Open linked issue</Link>}
          </article>
          <p className="confirmation-note">Downtime is not automatically lost production or financially recoverable time.</p>
        </aside>
      </section>
    </div>
  );
}
