"use client";

/**
 * Trade Overview: the commercial command centre. What needs attention across agreements, deliveries and settlements today, the most
 * urgent commitment and where it stands, and rule-based intelligence that says which records it read. Nothing here is a forecast:
 * every figure is counted from the records.
 */
import { ArrowRight, Boxes, CalendarDays, CircleCheck, Circle, CircleDot, ClipboardCheck, Database, FileText, Layers, Mail, MessageCircle, Network, Send, Sparkles, Target, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { addDays, daysBetween, formatRand, formatTonnes } from "@core/lib/trade-rules";
import { useDemoContext } from "@core/stores/demo-context";
import type { TradeView } from "../use-trade";
import { agreementState } from "./trade-status";
import { dayLabel, KpiTiles, Money, RailCard, RailList, TradeData } from "./trade-ui";

export function TradeOverviewScreen() {
  return <TradeData label="Loading the commercial overview" variant="dashboard">{(data) => <Overview data={data} />}</TradeData>;
}

/** Answers a question from the Trade records with simple rules. It says what it counted, and never guesses. */
export function answerTradeQuestion(question: string, data: TradeView): string {
  const q = question.toLowerCase();
  const client = data.clients.find((item) => q.includes(item.name.toLowerCase()) || q.includes(item.name.split(" ")[0].toLowerCase()));
  if (client) {
    const outstanding = client.outstanding === null ? "restricted" : formatRand(client.outstanding);
    return `${client.name}: ${client.activeAgreements} active agreement${client.activeAgreements === 1 ? "" : "s"}, ${formatTonnes(client.accepted)} accepted of ${formatTonnes(client.committed)} committed, outstanding balance ${outstanding}, ${client.openEnquiries} open enquir${client.openEnquiries === 1 ? "y" : "ies"}.`;
  }
  if (/overdue|owe|outstanding|settle|invoice|payment/.test(q)) {
    const overdue = data.settlements.filter((item) => item.status === "overdue" || item.status === "disputed");
    if (overdue.length === 0) return "No invoice is overdue or disputed.";
    return `${overdue.length} invoice${overdue.length === 1 ? " is" : "s are"} overdue or disputed: ${overdue.map((item) => `${item.invoiceNumber} (${data.clients.find((c) => c.id === item.clientId)?.name}${item.balance === null ? "" : `, ${formatRand(item.balance)}`})`).join("; ")}.`;
  }
  if (/risk|behind|late|short/.test(q)) {
    const risky = data.agreements.filter((item) => item.health === "at_risk");
    const late = data.deliveries.filter((item) => item.timing === "late");
    return `${risky.length} agreement${risky.length === 1 ? " is" : "s are"} behind on accepted tonnes (${risky.map((item) => item.number).join(", ") || "none"}), and ${late.length} deliver${late.length === 1 ? "y is" : "ies are"} late (${late.map((item) => item.number).join(", ") || "none"}).`;
  }
  if (/approv/.test(q)) {
    const mine = data.approvals.filter((item) => item.status === "pending" && item.canDecide);
    const pending = data.approvals.filter((item) => item.status === "pending");
    return `${pending.length} approval${pending.length === 1 ? " is" : "s are"} pending; ${mine.length} can be decided by you (${mine.map((item) => item.number).join(", ") || "none"}).`;
  }
  if (/deliver|week|truck|dispatch/.test(q)) {
    const week = data.deliveries.filter((item) => item.stage !== "cancelled" && item.scheduledDate >= data.today && item.scheduledDate <= addDays(data.today, 7));
    return `${week.length} deliver${week.length === 1 ? "y is" : "ies are"} scheduled in the next 7 days: ${week.map((item) => `${item.number} (${formatTonnes(item.tonnes)}, ${item.scheduledDate})`).join("; ") || "none"}. Dispatch is recorded by Mining Operations.`;
  }
  return "Try asking about overdue invoices, agreements at risk, pending approvals, this week's deliveries, or a client by name.";
}

function Overview({ data }: { data: TradeView }) {
  const { context } = useDemoContext();
  const firstName = context.persona.split(" ")[0];
  const today = data.today;
  const active = data.agreements.filter((item) => item.status === "active");
  const openDeliveries = data.deliveries.filter((item) => !["accepted", "cancelled"].includes(item.stage));
  const dueSoon = openDeliveries.filter((item) => item.scheduledDate <= addDays(today, 7));
  const outstanding = data.can.pricing ? data.settlements.reduce((total, item) => total + (item.balance ?? 0), 0) : null;
  const openEnquiries = data.enquiries.filter((item) => !["won", "lost"].includes(item.stage));

  // The most urgent commitment: active agreements' current commitments, least accepted share first, then the soonest due.
  const candidates = active
    .filter((item) => item.current)
    .map((item) => ({ agreement: item, commitment: item.current! }))
    .sort((a, b) => (a.agreement.health === "at_risk" ? 0 : 1) - (b.agreement.health === "at_risk" ? 0 : 1) || a.commitment.dueDate.localeCompare(b.commitment.dueDate) || a.commitment.share - b.commitment.share);
  const focus = candidates[0];

  const pendingApprovals = data.approvals.filter((item) => item.status === "pending");
  const attention = [
    ...pendingApprovals.slice(0, 1).map((item) => ({ key: item.id, icon: ClipboardCheck, tone: "attention" as const, title: "Pending approval", detail: `${item.number}: ${item.description}`, action: { label: "Review", href: "/trade/approvals" } })),
    ...data.settlements.filter((item) => item.status === "overdue").slice(0, 1).map((item) => ({ key: item.id, icon: Database, tone: "critical" as const, title: "Settlement overdue", detail: `${item.invoiceNumber} for ${data.clients.find((c) => c.id === item.clientId)?.name} is ${item.daysOverdue} days overdue.`, action: { label: "View settlement", href: `/trade/settlements?focus=${item.id}` } })),
    ...data.documents.filter((item) => item.expiresInDays !== null && item.expiresInDays >= 0 && item.expiresInDays <= 14).slice(0, 1).map((item) => ({ key: item.id, icon: FileText, tone: "attention" as const, title: "Document expiring", detail: `${item.name} expires in ${item.expiresInDays} day${item.expiresInDays === 1 ? "" : "s"}.`, action: { label: "Review documents", href: "/trade/documents" } })),
    ...data.deliveries.filter((item) => item.timing === "late").slice(0, 1).map((item) => ({ key: item.id, icon: Truck, tone: "critical" as const, title: "Delivery late", detail: `${item.number} (${item.agreementNumber}) was due ${dayLabel(item.scheduledDate)} and nothing has been received.`, action: { label: "View delivery", href: `/trade/deliveries/${item.id}` } })),
  ];

  const weekEnd = addDays(today, 7);
  const thisMonth = active.flatMap((item) => item.commitments).filter((item) => item.dueDate.slice(0, 7) === today.slice(0, 7));
  const readyToDispatch = data.links.flatMap((link) => link.shipments).filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index && ["preparing", "waiting", "confirmed"].includes(item.state)).reduce((total, item) => total + item.tonnes, 0);
  const dueSettlements = data.settlements.filter((item) => item.status !== "settled" && item.dueDate >= today && item.dueDate <= addDays(today, 14));
  const expected = data.can.pricing ? dueSettlements.filter((item) => item.dueDate <= weekEnd).reduce((total, item) => total + (item.balance ?? 0), 0) : null;

  return (
    <div className="workspace-page trade-page">
      <header className="page-header trade-greeting">
        <div className="page-header__copy">
          <div className="eyebrow">Command Centre · Trade</div>
          <h1>{greeting(data.now)}, {firstName}</h1>
          <p>Here is what needs attention across your agreements, deliveries and settlements today.</p>
        </div>
        <div className="trade-chips" aria-label="Context">
          <span className="trade-chip"><CalendarDays aria-hidden="true" /> {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
          <span className="trade-chip"><Network aria-hidden="true" /> Trade workspace</span>
          <span className="trade-chip"><span className="trade-chip__dot" aria-hidden="true" /> Updated {new Date(data.now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })}</span>
        </div>
      </header>

      <KpiTiles
        items={[
          { label: "Active agreements", value: active.length, hint: `${active.filter((item) => item.health === "at_risk").length} at risk`, icon: FileText },
          { label: "Pending deliveries", value: `${dueSoon.length} due`, hint: "In the next 7 days", icon: Truck },
          { label: "Settlements outstanding", value: <Money value={outstanding} />, hint: `${data.settlements.filter((item) => item.status === "overdue").length} overdue`, icon: Database, tone: data.settlements.some((item) => item.status === "overdue") ? "attention" : undefined },
          { label: "Open enquiries", value: openEnquiries.length, hint: `${openEnquiries.filter((item) => item.stage === "new").length} new`, icon: Target },
        ]}
      />

      <h2 className="trade-section-title">Needs you now</h2>
      <div className="trade-overview-grid">
        <div className="trade-overview-main">
          {focus ? <PriorityCard data={data} focus={focus} /> : <section className="card trade-hero trade-hero--calm"><h3>No commitment needs attention</h3><p>Every active agreement is on track.</p></section>}
          <ul className="trade-attention" aria-label="Needs attention">
            {attention.length === 0 ? <li className="muted">Nothing else needs attention right now.</li> : attention.map((item) => (
              <li key={item.key}>
                <span className="trade-attention__icon" aria-hidden="true"><item.icon /></span>
                <span className={`trade-attention__dot trade-attention__dot--${item.tone}`} aria-hidden="true" />
                <span className="trade-attention__copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                <Link className="button button--quiet button--small" href={item.action.href}>{item.action.label} <ArrowRight aria-hidden="true" /></Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="trade-overview-side">
          {focus ? <CommitmentSteps data={data} focus={focus} /> : null}
          <RailCard title="Commercial pipeline" action={{ label: "Open enquiries", href: "/trade/enquiries" }}>
            <RailList
              empty="No open enquiries."
              items={(["new", "qualified", "quotation_sent", "negotiation"] as const).map((stage) => {
                const rows = openEnquiries.filter((item) => item.stage === stage);
                const value = data.can.pricing ? rows.reduce((total, item) => total + (item.value ?? 0), 0) : null;
                return { key: stage, icon: Mail, title: `${rows.length} ${{ new: "new", qualified: "qualified", quotation_sent: "quoted", negotiation: "in negotiation" }[stage]}`, detail: `${formatTonnes(rows.reduce((total, item) => total + item.tonnes, 0))} requested`, aside: value === null ? undefined : value ? formatRand(value) : "No quote yet" };
              })}
            />
          </RailCard>
        </div>
      </div>

      <div className="trade-intel-row">
        <IntelligenceCard data={data} />
        <AskVesper data={data} />
      </div>

      <KpiTiles
        label="This week"
        items={[
          { label: "Committed this month", value: formatTonnes(thisMonth.reduce((total, item) => total + item.tonnes, 0)), hint: `${formatTonnes(thisMonth.reduce((total, item) => total + item.accepted, 0))} accepted so far`, icon: Layers },
          { label: "Deliveries this week", value: data.deliveries.filter((item) => item.stage !== "cancelled" && item.scheduledDate >= today && item.scheduledDate <= weekEnd).length, hint: "Scheduled in the next 7 days", icon: Truck },
          { label: "Allocated, not dispatched", value: formatTonnes(readyToDispatch), hint: "Linked Mining Operations shipments", icon: Boxes },
          { label: "Settlements due", value: dueSettlements.length, hint: "In the next 14 days", icon: Database },
          { label: "Receipts due this week", value: <Money value={expected} />, hint: "Balances due by invoice", icon: Wallet },
        ]}
      />
    </div>
  );
}

function greeting(iso: string) {
  const hour = Number(new Date(iso).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" }));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

type Focus = { agreement: TradeView["agreements"][number]; commitment: NonNullable<TradeView["agreements"][number]["current"]> };

function PriorityCard({ data, focus }: { data: TradeView; focus: Focus }) {
  const { agreement, commitment } = focus;
  const remaining = Math.max(0, commitment.tonnes - commitment.accepted);
  const days = daysBetween(data.today, commitment.dueDate);
  const state = agreementState(agreement);
  const atRisk = agreement.health === "at_risk" || (remaining > 0 && days <= 7);
  return (
    <section className="trade-hero" aria-labelledby="priority-title">
      <div className="trade-hero__eyebrow"><Target aria-hidden="true" /> Commercial priority {atRisk ? <span className="trade-hero__tag">Most urgent</span> : null}</div>
      <h3 id="priority-title">{agreement.title} {agreement.number} — {remaining > 0 ? (atRisk ? "fulfilment at risk" : "in progress") : "accepted in full"}</h3>
      <p>
        {formatTonnes(commitment.accepted)} of {formatTonnes(commitment.tonnes)} accepted for the {commitment.label} ({formatTonnes(commitment.dispatched)} dispatched and {formatTonnes(commitment.received)} received by Mining Operations). {state.label === "At risk" ? "Accepted tonnes are behind plan for this agreement." : ""}
      </p>
      <dl className="trade-hero__facts">
        <div><dt><CalendarDays aria-hidden="true" /> Due in</dt><dd>{days >= 0 ? `${days} day${days === 1 ? "" : "s"}` : `${-days} days ago`}</dd></div>
        <div><dt><Layers aria-hidden="true" /> Customer</dt><dd>{agreement.clientName}</dd></div>
        <div><dt><Wallet aria-hidden="true" /> Value not yet accepted</dt><dd><Money value={agreement.pricePerTonne === null ? null : remaining * agreement.pricePerTonne} /></dd></div>
      </dl>
      <Link className="button button--light" href={`/trade/agreements/${agreement.id}`}>Review agreement <ArrowRight aria-hidden="true" /></Link>
    </section>
  );
}

/** The commitment's progress as separate steps, each read from a record: planned, dispatched, received, accepted, invoiced, paid. */
function CommitmentSteps({ data, focus }: { data: TradeView; focus: Focus }) {
  const { commitment } = focus;
  const deliveries = data.deliveries.filter((item) => item.commitmentId === commitment.id && item.stage !== "cancelled");
  const settlements = data.settlements.filter((item) => item.deliveryIds.some((id) => deliveries.some((delivery) => delivery.id === id)));
  const step = (done: boolean, started: boolean) => (done ? "done" : started ? "progress" : "pending") as "done" | "progress" | "pending";
  const steps = [
    { label: "Deliveries planned for the full quantity", state: step(commitment.planned >= commitment.tonnes, commitment.planned > 0) },
    { label: "Dispatched by Mining Operations", state: step(commitment.dispatched >= commitment.tonnes, commitment.dispatched > 0) },
    { label: "Received at the delivery point", state: step(commitment.received >= commitment.tonnes, commitment.received > 0) },
    { label: "Accepted by the customer", state: step(commitment.accepted >= commitment.tonnes, commitment.accepted > 0) },
    { label: "Invoiced and settled", state: step(settlements.length > 0 && settlements.every((item) => item.status === "settled") && commitment.accepted >= commitment.tonnes, settlements.length > 0) },
  ];
  const count = (state: string) => steps.filter((item) => item.state === state).length;
  return (
    <RailCard title={`Commitment progress · ${focus.agreement.number}`}>
      <p className="trade-steps__summary">{count("done")} complete · {count("progress")} in progress · {count("pending")} pending</p>
      <ol className="trade-steps">
        {steps.map((item) => (
          <li key={item.label} className={`trade-steps__item trade-steps__item--${item.state}`}>
            {item.state === "done" ? <CircleCheck aria-hidden="true" /> : item.state === "progress" ? <CircleDot aria-hidden="true" /> : <Circle aria-hidden="true" />}
            <span>{item.label}</span>
            <span className="sr-only">{item.state === "done" ? "complete" : item.state === "progress" ? "in progress" : "pending"}</span>
          </li>
        ))}
      </ol>
    </RailCard>
  );
}

function IntelligenceCard({ data }: { data: TradeView }) {
  const risky = data.agreements.filter((item) => item.health === "at_risk");
  const overdue = data.settlements.filter((item) => item.status === "overdue" || item.status === "disputed");
  const lines = [
    risky.length ? `${risky.map((item) => `${item.number} (${item.clientName})`).join(" and ")} ${risky.length === 1 ? "is" : "are"} below 85% of the tonnes that should have been accepted by now.` : "Every active agreement is at or above 85% of the tonnes due so far.",
    overdue.length ? `${overdue.length} invoice${overdue.length === 1 ? " is" : "s are"} overdue or disputed (${overdue.map((item) => item.invoiceNumber).join(", ")}). Resolve these before new deliveries to the same clients.` : "No invoice is overdue or disputed.",
  ];
  return (
    <section className="card trade-intel" aria-labelledby="trade-intel-title">
      <span className="trade-intel__icon" aria-hidden="true"><Sparkles /></span>
      <div>
        <h2 id="trade-intel-title">VESPER Intelligence <span className="trade-badge">Rule-based</span></h2>
        {lines.map((line) => <p key={line}>{line}</p>)}
        <small className="muted">Counted from agreements, deliveries and settlements. Not a forecast.</small>
      </div>
      <Link className="button button--quiet button--small" href="/trade/reports">View reports <ArrowRight aria-hidden="true" /></Link>
    </section>
  );
}

function AskVesper({ data }: { data: TradeView }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  return (
    <section className="card trade-ask" aria-labelledby="trade-ask-title">
      <h2 id="trade-ask-title"><MessageCircle aria-hidden="true" /> Ask VESPER</h2>
      <form onSubmit={(event) => { event.preventDefault(); if (question.trim()) setAnswer(answerTradeQuestion(question, data)); }}>
        <label className="sr-only" htmlFor="trade-question">Ask a question about your trade operations</label>
        <input id="trade-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about your trade operations…" />
        <button className="button button--primary trade-ask__send" aria-label="Ask" disabled={!question.trim()}><Send aria-hidden="true" /></button>
      </form>
      {answer ? <p className="trade-ask__answer" role="status">{answer}</p> : <p className="muted trade-ask__hint">For example: “Which invoices are overdue?” or “How is Bayside Metals doing?”</p>}
    </section>
  );
}
