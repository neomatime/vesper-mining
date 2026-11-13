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
import type { EquipmentView } from "@/lib/equipment-rules";
import { needsAttention } from "@/lib/needs-attention";
import { homeRole, plannerHome, storesHome, supervisorHome } from "@/lib/role-home";
import { shiftTimes } from "@/lib/shift-format";
import { useDemoContext } from "@/stores/demo-context";
import type { ShiftView } from "@/lib/shift-rules";
import { recoverySummary } from "@/lib/calculations";
import { ErrorState, LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { OperationalMapClient } from "./operational-map-client";
import { RoleHomeScreen } from "./role-home-screen";

type OverviewResponse = {
  context: { persona: string; role: string; siteName: string };
  priorityIssue: OperationalIssue;
  issues: OperationalIssue[];
  areas: MapArea[];
  equipment: EquipmentView[];
  readiness: ReadinessActivity[];
  shifts: ShiftView[];
  now: string;
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
  // The person is whoever is signed in, not whoever the demo records were first written for.
  const { context: signedIn } = useDemoContext();
  const query = useQuery({
    queryKey: ["overview", "site-riverside"],
    queryFn: () => demoFetch<OverviewResponse>("/overview"),
  });

  if (query.isPending) return <LoadingState label="Loading the command centre" />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const { context, priorityIssue, issues, areas, equipment, readiness, shifts, now } = query.data;
  const role = homeRole(signedIn.role);
  if (role !== "manager") {
    const home = { issues, equipment, readiness, shifts, now };
    const model = role === "supervisor" ? supervisorHome(home, signedIn.persona) : role === "planner" ? plannerHome(home) : storesHome(home);
    const running = shifts.find((item) => item.state === "in_progress");
    return <RoleHomeScreen model={model} persona={signedIn.persona} siteName={context.siteName} now={now} shiftLabel={running ? `${running.name} · ${shiftTimes(running)}` : undefined} />;
  }

  const currentShift = shifts.find((item) => item.state === "in_progress") ?? shifts.find((item) => item.state === "scheduled") ?? shifts.at(-1);
  const completeActions = priorityIssue.actions.filter((action) => action.state === "complete").length;
  const progress = `${completeActions}/${priorityIssue.actions.length}`;
  // The most urgent thing is the hero below. These are the next ones, so the person can see the whole of what needs them.
  const nextUp = needsAttention({ issues, readiness, equipment, shifts, now }, { issueId: priorityIssue.id }).slice(0, 2);
  const awaitingConfirmation = readiness.filter((item) => item.status === "needs_confirmation").length;

  return (
    <div className="dashboard-page">
      <section className="dashboard-greeting">
        <div>
          <span className="eyebrow">Command Centre{currentShift ? ` · ${currentShift.name}` : ""}</span>
          <h1>Good morning, {signedIn.persona.split(" ")[0]}</h1>
          <p>Here is what requires attention at {context.siteName} today.</p>
        </div>
        <div className="context-pills">
          <span><Clock3 /> Thu, 24 Apr 2025</span>
          <span><UsersRound /> {currentShift ? `${currentShift.name} · ${shiftTimes(currentShift)}` : "No shift scheduled"}</span>
          <span className="context-pills__freshness"><span /> Updated 4 min ago</span>
        </div>
      </section>

      <section className="needs-now" aria-labelledby="needs-now-title">
        <header className="section-heading">
          <h2 id="needs-now-title">Needs you now</h2>
          <p>{nextUp.length === 0 ? "One thing, and nothing waiting behind it" : `${nextUp.length + 1} things, most urgent first`}</p>
        </header>

        <div className="priority-grid">
          <div className="needs-now__main">
          <article className="hero-card">
            <div className="hero-card__art" aria-hidden="true" />
            <div className="hero-card__content">
              <div className="hero-card__eyebrow"><Target /> Operational constraint <span>Most urgent</span></div>
              <h2>{priorityIssue.title}</h2>
              <p>{priorityIssue.description}</p>
              <div className="hero-card__footer">
                <div className="hero-card__facts">
                  <span><Clock3 /><small>Delay since report</small><strong>42 min</strong></span>
                  <span><Layers3 /><small>Impact</small><strong>Requires review</strong></span>
                  <span><ShieldAlert /><small>Priority</small><strong>High</strong></span>
                </div>
                <Link href={`/exceptions/${priorityIssue.id}`} className="button button--light">Review recovery actions <ArrowRight /></Link>
              </div>
              <small className="hero-card__note">Opens the recovery review. Nothing changes until an action is taken.</small>
            </div>
          </article>
          {nextUp.length > 0 ? (
            <div className="attention-grid" aria-label="Also needs you">
              {nextUp.map((item) => (
                <article className="card attention-card" key={item.id}>
                  <div className="attention-card__main">
                    <StatusBadge value={item.status} label={item.statusLabel} />
                    <h3>{item.title}</h3>
                    <p>{item.reason}</p>
                  </div>
                  <Link className="button button--quiet" href={item.href}>{item.action} <ArrowRight /></Link>
                </article>
              ))}
            </div>
          ) : null}
          </div>

          <article className="card recovery-card">
            <header className="card__header"><div><span className="eyebrow">Recovery progress</span><h2>Recovery status</h2></div><StatusBadge value={priorityIssue.quality} /></header>
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
            <div className="recovery-card__opportunity">
              <small>Recovery opportunity</small>
              <strong>Opportunity not quantified</strong>
              <p>No validated formula supports a tonnage, Rand value, recovery window or countdown for this scenario.</p>
              <Link className="button button--quiet button--small" href={`/exceptions/${priorityIssue.id}`}>Review evidence</Link>
            </div>
          </article>
        </div>

      </section>

      <section className="metric-grid" aria-label="Operational summary">
        <article className="metric-card"><span><Gauge /></span><div><small>Production</small><strong>156,200 <em>t</em></strong><p>Reported · current shift</p></div></article>
        <article className="metric-card"><span><Target /></span><div><small>Plan</small><strong>162,000 <em>t</em></strong><p>Target</p></div></article>
        <article className="metric-card"><span><Wrench /></span><div><small>Equipment availability</small><strong>92<em>%</em></strong><p>Of tracked equipment</p></div></article>
        <article className="metric-card"><span><Box /></span><div><small>Readiness risks</small><strong>{readiness.filter((item) => item.status !== "ready").length}</strong><p>{awaitingConfirmation === 0 ? "None waiting on confirmation" : `${awaitingConfirmation} needs confirming`}</p></div></article>
        <article className="metric-card"><span><Clock3 /></span><div><small>Open handover items</small><strong>{currentShift?.unresolved ?? 0}</strong><p>Carried to the next shift</p></div></article>
      </section>

      <section className="operational-grid">
        <article className="card map-card">
          <header className="card__header"><div><span className="eyebrow">Site status</span><h2>Operational Map</h2></div><Link href="/map">Open full map <ArrowRight /></Link></header>
          <OperationalMapClient areas={areas} compact />
        </article>
        <div className="operational-stack">
          <article className="card dependency-card">
            <header className="card__header"><div><span className="eyebrow">Waiting on others</span><h2>Dependencies</h2></div></header>
            <div className="dependency-item"><span><Box /></span><div><strong>Spare part · Crusher C-02</strong><small>Stores · confirmation in progress</small></div><StatusBadge value="in_progress" /></div>
            <div className="dependency-item"><span><UsersRound /></span><div><strong>Repair team mobilisation</strong><small>Contractor · awaiting part confirmation</small></div><StatusBadge value="pending" /></div>
            <div className="dependency-item"><span><ShieldAlert /></span><div><strong>Safety authorisation</strong><small>Managed outside VESPER · reference only</small></div><StatusBadge value="unknown" label="External" /></div>
          </article>
          <article className="card handover-card">
            <header className="card__header"><div><span className="eyebrow">Next shift</span><h2>Handover</h2></div><Link href={currentShift ? `/shifts/${currentShift.id}/handover` : "/shifts"}>View</Link></header>
            <div className="handover-count"><strong>3</strong><span>open items to carry over</span></div>
            <Link href={`/exceptions/${priorityIssue.id}`}><MapPin /> {priorityIssue.title}</Link>
            <Link href="/exceptions/issue-riv-002"><ShieldAlert /> Central Pit · Reduced Output</Link>
            <Link href="/equipment/eq-dz017"><Wrench /> DZ-017 · Service due</Link>
          </article>
        </div>
      </section>

      <section className="insight-grid insight-grid--single">
        <article className="card chart-card">
          <header className="card__header"><div><span className="eyebrow">This shift</span><h2>Production vs plan</h2></div><Link href="/reports/production-vs-plan">Details</Link></header>
          <div className="chart-wrap" aria-label="Production versus plan from 18 to 24 April 2025">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={-8}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 180]} />
                <Tooltip />
                <Bar dataKey="plan" fill="var(--chart-plan)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="actual" fill="var(--chart-actual)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </div>
  );
}
