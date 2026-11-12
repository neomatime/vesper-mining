"use client";

import { useQuery } from "@tanstack/react-query";
import type { MapArea, OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  MapPin,
  ShieldAlert,
  Target,
  UsersRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { demoFetch } from "@/lib/api";
import { shiftTimes } from "@/lib/shift-format";
import type { ShiftView } from "@/lib/shift-rules";
import { recoverySummary } from "@/lib/calculations";
import { ErrorState, LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { OperationalMapClient } from "./operational-map-client";

type OverviewResponse = {
  context: { persona: string; role: string; siteName: string };
  priorityIssue: OperationalIssue;
  issues: OperationalIssue[];
  areas: MapArea[];
  equipment: Array<{ id: string; state: string }>;
  readiness: ReadinessActivity[];
  shifts: ShiftView[];
};

const chartData = [
  { day: "18", plan: 126, actual: 111 },
  { day: "19", plan: 132, actual: 118 },
  { day: "20", plan: 128, actual: 105 },
  { day: "21", plan: 144, actual: 137 },
  { day: "22", plan: 149, actual: 147 },
  { day: "23", plan: 151, actual: 128 },
  { day: "24", plan: 162, actual: 156 },
];

export function OverviewScreen() {
  const query = useQuery({
    queryKey: ["overview", "site-riverside"],
    queryFn: () => demoFetch<OverviewResponse>("/overview"),
  });

  if (query.isPending) return <LoadingState label="Loading the command centre" />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const { context, priorityIssue, areas, readiness, shifts } = query.data;
  const currentShift = shifts.find((item) => item.state === "in_progress") ?? shifts.find((item) => item.state === "scheduled") ?? shifts.at(-1);
  const completeActions = priorityIssue.actions.filter((action) => action.state === "complete").length;
  const progress = `${completeActions}/${priorityIssue.actions.length}`;

  return (
    <div className="dashboard-page">
      <section className="dashboard-greeting">
        <div>
          <span className="eyebrow">Command Centre{currentShift ? ` · ${currentShift.name}` : ""}</span>
          <h1>Good morning, {context.persona.split(" ")[0]}</h1>
          <p>Here is what requires attention at {context.siteName} today.</p>
        </div>
        <div className="context-pills">
          <span><Clock3 /> Thu, 24 Apr 2025</span>
          <span><UsersRound /> {currentShift ? `${currentShift.name} · ${shiftTimes(currentShift)}` : "No shift scheduled"}</span>
          <span className="context-pills__freshness"><span /> Updated 4 min ago</span>
        </div>
      </section>

      <section className="priority-grid">
        <article className="hero-card">
          <div className="hero-card__art" aria-hidden="true" />
          <div className="hero-card__content">
            <div className="hero-card__eyebrow"><Target /> Operational constraint <span>Primary</span></div>
            <h2>{priorityIssue.title}</h2>
            <p>{priorityIssue.description}</p>
            <div className="hero-card__facts">
              <span><Clock3 /><small>Delay since report</small><strong>42 min</strong></span>
              <span><Layers3 /><small>Impact</small><strong>Requires review</strong></span>
              <span><ShieldAlert /><small>Priority</small><strong>High</strong></span>
            </div>
            <Link href={`/exceptions/${priorityIssue.id}`} className="button button--light">View details <ArrowRight /></Link>
          </div>
        </article>

        <article className="card recovery-card">
          <header className="card__header"><div><span className="eyebrow">Evidence-led progress</span><h2>Recovery status</h2></div><StatusBadge value={priorityIssue.quality} /></header>
          <div className="recovery-card__body">
            <div className="progress-orbit" style={{ "--progress": `${(completeActions / priorityIssue.actions.length) * 100}%` } as React.CSSProperties}>
              <strong>{progress}</strong><span>steps complete</span>
            </div>
            <div className="recovery-steps">
              {priorityIssue.actions.map((action) => (
                <div key={action.id} className={`recovery-step recovery-step--${action.state}`}>
                  {action.state === "complete" ? <CheckCircle2 /> : <span />}
                  <div><strong>{action.title}</strong><small>{action.team} · {action.owner}</small></div>
                </div>
              ))}
            </div>
          </div>
          <p className="card__footnote">{recoverySummary(priorityIssue.actions)}</p>
        </article>
      </section>

      <section className="metric-grid" aria-label="Operational summary">
        <article className="metric-card"><span><Gauge /></span><div><small>Production</small><strong>156,200 <em>t</em></strong><p>Reported · current shift</p></div></article>
        <article className="metric-card"><span><Target /></span><div><small>Plan</small><strong>162,000 <em>t</em></strong><p>Target</p></div></article>
        <article className="metric-card"><span><Wrench /></span><div><small>Equipment availability</small><strong>92<em>%</em></strong><p>Defined sample</p></div></article>
        <article className="metric-card"><span><Box /></span><div><small>Readiness risks</small><strong>{readiness.filter((item) => item.status !== "ready").length}</strong><p>1 needs confirmation</p></div></article>
        <article className="metric-card"><span><Clock3 /></span><div><small>Open handover items</small><strong>{currentShift?.unresolved ?? 0}</strong><p>Original issues retained</p></div></article>
      </section>

      <section className="operational-grid">
        <article className="card map-card">
          <header className="card__header"><div><span className="eyebrow">Explainable status</span><h2>Operational Map</h2></div><Link href="/map">Open full map <ArrowRight /></Link></header>
          <OperationalMapClient areas={areas} compact />
        </article>
        <article className="card action-card">
          <header className="card__header"><div><span className="eyebrow">Accountability</span><h2>Action plan · C-02</h2></div><Link href={`/exceptions/${priorityIssue.id}`}>Review all</Link></header>
          <div className="action-list">
            {priorityIssue.actions.map((action, index) => (
              <div className="action-row" key={action.id}>
                <span className={`action-row__marker action-row__marker--${action.state}`}>{index + 1}</span>
                <div><strong>{action.title}</strong><small>{action.team} · {action.owner}</small></div>
                <StatusBadge value={action.state} />
              </div>
            ))}
          </div>
          <Link className="button button--primary button--wide" href={`/exceptions/${priorityIssue.id}`}>Review recovery actions <ArrowRight /></Link>
          <p className="confirmation-note">Opens the recovery review. Nothing changes until an action is taken.</p>
        </article>
      </section>

      <section className="insight-grid">
        <article className="card chart-card">
          <header className="card__header"><div><span className="eyebrow">This shift</span><h2>Production vs plan</h2></div><Link href="/reports/production-vs-plan">Details</Link></header>
          <div className="chart-wrap" aria-label="Production versus plan from 18 to 24 April 2025">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={-8}>
                <CartesianGrid vertical={false} stroke="#E7ECE8" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 180]} />
                <Tooltip />
                <Bar dataKey="plan" fill="#CDE8DA" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="actual" fill="#16865B" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="card opportunity-card">
          <header className="card__header"><div><span className="eyebrow">Evidence boundary</span><h2>Recovery opportunity</h2></div></header>
          <div className="opportunity-card__icon"><Target /></div>
          <h3>Opportunity not quantified</h3>
          <p>No validated formula supports a tonnage, Rand value, recovery window or countdown for this scenario.</p>
          <Link className="button button--quiet button--wide" href={`/exceptions/${priorityIssue.id}`}>Review evidence</Link>
        </article>
        <article className="card dependency-card">
          <header className="card__header"><div><span className="eyebrow">Cross-team context</span><h2>Dependencies</h2></div></header>
          <div className="dependency-item"><span><Box /></span><div><strong>Spare part · Crusher C-02</strong><small>Stores · confirmation in progress</small></div><StatusBadge value="in_progress" /></div>
          <div className="dependency-item"><span><UsersRound /></span><div><strong>Repair team mobilisation</strong><small>Contractor · awaiting part confirmation</small></div><StatusBadge value="pending" /></div>
          <div className="dependency-item"><span><ShieldAlert /></span><div><strong>Safety authorisation</strong><small>Managed outside VESPER · reference only</small></div><StatusBadge value="unknown" label="External" /></div>
        </article>
        <article className="card handover-card">
          <header className="card__header"><div><span className="eyebrow">Shift continuity</span><h2>Handover</h2></div><Link href={currentShift ? `/shifts/${currentShift.id}/handover` : "/shifts"}>View</Link></header>
          <div className="handover-count"><strong>3</strong><span>open items to carry over</span></div>
          <Link href={`/exceptions/${priorityIssue.id}`}><MapPin /> {priorityIssue.title}</Link>
          <Link href="/exceptions/issue-riv-002"><ShieldAlert /> Central Pit · Reduced Output</Link>
          <Link href="/equipment/eq-dz017"><Wrench /> DZ-017 · Service due</Link>
        </article>
      </section>
    </div>
  );
}
