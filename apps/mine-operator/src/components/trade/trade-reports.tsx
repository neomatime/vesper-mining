"use client";

/**
 * Trade reports: agreement fulfilment, delivery variance, settlement ageing, logistics, operational exposure and a commercial summary,
 * each built from the current records when opened (never stored figures). Reports can be saved with a name and a frequency; a frequency
 * is a reminder of how often the team reviews it, not a background job.
 */
import { BarChart3, CalendarClock, CirclePlus, Download, FileBarChart, Printer, Share2, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDays, daysBetween, formatRand, formatTonnes, frequencyLabels, reportCategory, reportKindLabels, settlementStatusLabels, type ReportKind, type SavedReport } from "@/lib/trade-rules";
import { ConfirmDialog, Dialog } from "../dialog";
import { Field } from "../form-field";
import { EmptyState } from "../query-state";
import { Select } from "../select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type TradeView } from "../use-trade";
import { agreementState, readinessLabels } from "./trade-status";
import { ActionMenu, CellMain, Crumbs, dateTimeLabel, dayLabel, Donut, exportCsv, KpiTiles, Money, RailCard, RailList, Register, TradeData, TradeHeader } from "./trade-ui";

// ---- Building a report from the records -----------------------------------------------------------------------------------

type Table = { title: string; head: string[]; rows: (string | number)[][]; note?: string };

export function buildTradeReport(kind: ReportKind, data: TradeView): Table {
  const money = (value: number | null) => (value === null ? "Restricted" : formatRand(value));
  const client = (id: string) => data.clients.find((item) => item.id === id)?.name ?? "";
  switch (kind) {
    case "agreement_fulfilment":
      return {
        title: "Agreement fulfilment",
        head: ["Agreement", "Client", "Commodity", "Committed t", "Dispatched t", "Received t", "Accepted t", "Accepted %", "Status"],
        rows: data.agreements.filter((item) => item.status !== "draft").map((item) => [item.number, item.clientName, item.commodity, item.committed, item.dispatched, item.received, item.accepted, `${Math.round(item.share * 100)}%`, agreementState(item).label]),
        note: "Dispatched and received come from Mining Operations; accepted is the customer's acceptance.",
      };
    case "delivery_variance":
      return {
        title: "Delivery variance",
        head: ["Delivery", "Agreement", "Scheduled", "Planned t", "Received t", "Accepted t", "Variance t", "Reason"],
        rows: data.deliveries.filter((item) => item.stage !== "cancelled" && item.quantities.received > 0).map((item) => [item.number, item.agreementNumber, item.scheduledDate, item.tonnes, item.quantities.received, item.quantities.accepted, item.quantities.accepted - item.tonnes, item.discrepancy?.reason ?? (item.acceptance ? "" : "Awaiting acceptance")]),
        note: "Variance is accepted minus planned tonnes.",
      };
    case "settlement_ageing": {
      const band = (days: number) => (days <= 0 ? "Not yet due" : days <= 30 ? "1–30 days" : days <= 60 ? "31–60 days" : "60+ days");
      return {
        title: "Settlement ageing",
        head: ["Invoice", "Client", "Issued", "Due", "Balance", "Status", "Age band"],
        rows: data.settlements.filter((item) => item.status !== "settled").map((item) => [item.invoiceNumber, client(item.clientId), item.issuedAt, item.dueDate, money(item.balance), settlementStatusLabels[item.status], band(daysBetween(item.dueDate, data.today))]),
      };
    }
    case "logistics_performance": {
      const finished = data.deliveries.filter((item) => item.quantities.received > 0);
      return {
        title: "Logistics performance",
        head: ["Delivery", "Destination", "Scheduled", "Received", "On time", "Source"],
        rows: finished.map((item) => {
          const received = (item.shipment?.receivedAt ?? item.operations?.receivedAt ?? "").slice(0, 10);
          return [item.number, item.destination, item.scheduledDate, received || "—", received && received <= addDays(item.scheduledDate, 1) ? "Yes" : "No", item.quantities.source];
        }),
        note: "On time means received by the day after the scheduled date.",
      };
    }
    case "operational_exposure":
      return {
        title: "Operational exposure",
        head: ["Link", "Agreement", "Commitment", "Area", "Open issues", "Dispatched t", "Readiness"],
        rows: data.links.map((item) => [item.number, item.agreementNumber, item.commitment?.label ?? "", item.area.name, item.issues.map((issue) => issue.number).join(" ") || "None", item.dispatched, readinessLabels[item.readiness]]),
        note: "Read from Mining Operations areas, shifts, shipments and issues.",
      };
    default: {
      const active = data.agreements.filter((item) => item.status === "active");
      const invoiced = data.can.pricing ? data.settlements.reduce((total, item) => total + (item.amount ?? 0), 0) : null;
      const paid = data.can.pricing ? data.settlements.reduce((total, item) => total + (item.paid ?? 0), 0) : null;
      return {
        title: "Commercial performance summary",
        head: ["Measure", "Value"],
        rows: [
          ["Active agreements", active.length],
          ["Committed tonnes (active)", formatTonnes(active.reduce((total, item) => total + item.committed, 0))],
          ["Accepted tonnes (active)", formatTonnes(active.reduce((total, item) => total + item.accepted, 0))],
          ["Agreements at risk", active.filter((item) => item.health === "at_risk").length],
          ["Invoiced to date", money(invoiced)],
          ["Paid to date", money(paid)],
          ["Outstanding", money(invoiced === null || paid === null ? null : invoiced - paid)],
          ["Open enquiries", data.enquiries.filter((item) => !["won", "lost"].includes(item.stage)).length],
          ["Pending approvals", data.approvals.filter((item) => item.status === "pending").length],
        ],
      };
    }
  }
}

/** Monthly invoiced value and the share of it collected, for the last six months that have invoices. */
function monthly(data: TradeView) {
  const months = [...new Set(data.settlements.map((item) => item.issuedAt.slice(0, 7)))].sort().slice(-6);
  return months.map((month) => {
    const items = data.settlements.filter((item) => item.issuedAt.startsWith(month));
    const amount = items.reduce((total, item) => total + (item.amount ?? 0), 0);
    const paid = items.reduce((total, item) => total + (item.paid ?? 0), 0);
    return { month, label: new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }), amount, tonnes: items.reduce((total, item) => total + item.tonnes, 0), collected: amount ? paid / amount : 0 };
  });
}

// ---- Reports library -------------------------------------------------------------------------------------------------------

export function TradeReportsScreen() {
  return <TradeData label="Loading reports">{(data) => <Reports data={data} />}</TradeData>;
}

function Reports({ data }: { data: TradeView }) {
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const remove = useTradeAction<{ id: string }>({ path: (input) => `/trade/reports/${input.id}`, method: "DELETE", success: () => ({ title: "Report deleted" }), onDone: () => setDeleting(null) });
  const rows = data.reports;
  const series = monthly(data);
  const maxAmount = Math.max(1, ...series.map((item) => (data.can.pricing ? item.amount : item.tonnes)));
  const kinds = Object.keys(reportKindLabels) as ReportKind[];
  const atRisk = data.agreements.filter((item) => item.health === "at_risk");
  const overdue = data.settlements.filter((item) => item.status === "overdue");
  const next = (report: SavedReport) => (report.frequency === "on_demand" || !report.lastRunAt ? null : addDays(report.lastRunAt, report.frequency === "weekly" ? 7 : 30));

  return (
    <div className="workspace-page trade-page">
      <TradeHeader eyebrow="Intelligence · Trade" title="Reports" description="Commercial performance, fulfilment, settlements, logistics and operational exposure, built from the current records." icon={BarChart3}
        actions={data.can.manageReports ? <button className="button button--primary" onClick={() => setCreating(true)}><CirclePlus /> Create report</button> : undefined} />
      <KpiTiles items={[
        { label: "Reports", value: rows.length, hint: `${rows.filter((item) => !item.standard).length} saved by the team`, icon: FileBarChart },
        { label: "Reviewed on a schedule", value: rows.filter((item) => item.frequency !== "on_demand").length, hint: "Weekly or monthly", icon: CalendarClock },
        { label: "Run this month", value: rows.filter((item) => item.lastRunAt?.slice(0, 7) === data.today.slice(0, 7)).length, hint: "Opened or exported", icon: BarChart3 },
        { label: "At-risk agreements covered", value: atRisk.length, hint: "In fulfilment and exposure reports", icon: TriangleAlert, tone: atRisk.length ? "attention" : undefined },
      ]} />
      <div className="trade-layout">
        <div className="trade-stack-main">
          <Register<SavedReport>
            title="Report library"
            noun="reports"
            rows={rows}
            pageSize={6}
            searchLabel="Search reports or owners"
            search={(row) => [row.name, reportKindLabels[row.kind], reportCategory[row.kind], row.owner].join(" ")}
            href={(row) => `/trade/reports/${row.id}`}
            chips={[...new Set(Object.values(reportCategory))].map((category) => ({ key: category, label: category, test: (row) => reportCategory[row.kind] === category }))}
            columns={[
              { key: "name", label: "Report", sort: (row) => row.name, render: (row) => <CellMain title={row.name} detail={row.standard ? "Standard" : `Saved by ${row.owner}`} /> },
              { key: "category", label: "Category", sort: (row) => reportCategory[row.kind], render: (row) => reportCategory[row.kind] },
              { key: "frequency", label: "Review", sort: (row) => row.frequency, render: (row) => frequencyLabels[row.frequency] },
              { key: "last", label: "Last run", sort: (row) => row.lastRunAt ?? "", render: (row) => (row.lastRunAt ? dateTimeLabel(row.lastRunAt) : <span className="muted">Not run yet</span>) },
              { key: "owner", label: "Owner", sort: (row) => row.owner, render: (row) => row.owner },
            ]}
            actions={(row) => <ActionMenu label={`Actions for ${row.name}`} actions={[{ label: "View report", href: `/trade/reports/${row.id}` }, { label: "Delete", onClick: () => setDeleting(row), danger: true, hidden: row.standard || !data.can.manageReports }]} />}
            empty={{ title: "No reports", body: "Create a report from one of the standard types." }}
          />
          <section className="card trade-chart" aria-labelledby="trend-title">
            <header className="trade-register__header"><h2 id="trend-title">Performance trends</h2><span className="muted">{data.can.pricing ? "Invoiced value by month and the share collected" : "Invoiced tonnes by month (values restricted)"}</span></header>
            {series.length === 0 ? <p className="muted">No invoices yet.</p> : (
              <div className="trade-bars-chart" role="img" aria-label={series.map((item) => `${item.label}: ${data.can.pricing ? formatRand(item.amount) : formatTonnes(item.tonnes)}${data.can.pricing ? `, ${Math.round(item.collected * 100)}% collected` : ""}`).join("; ")}>
                {series.map((item) => {
                  const value = data.can.pricing ? item.amount : item.tonnes;
                  return (
                    <div key={item.month} className="trade-bars-chart__col">
                      <span className="trade-bars-chart__value">{data.can.pricing ? formatRand(item.amount) : formatTonnes(item.tonnes)}</span>
                      <span className="trade-bars-chart__bar" style={{ height: `${Math.max(4, (value / maxAmount) * 100)}%` }} />
                      {data.can.pricing ? <span className="trade-bars-chart__rate">{Math.round(item.collected * 100)}% collected</span> : null}
                      <span className="trade-bars-chart__label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <aside className="trade-rail" aria-label="Report insights">
          <RailCard title="Report mix">
            <Donut label="Report mix" centre={String(rows.length)} caption="Reports" segments={kinds.map((kind, index) => ({ label: reportCategory[kind], value: rows.filter((item) => item.kind === kind).length, tone: (["positive", "info", "warning", "danger", "neutral", "positive"] as const)[index], display: String(rows.filter((item) => item.kind === kind).length) }))} />
          </RailCard>
          <RailCard title="Due for review">
            <RailList empty="Nothing scheduled." items={rows.filter((item) => next(item)).sort((a, b) => next(a)!.localeCompare(next(b)!)).slice(0, 4).map((item) => ({ key: item.id, icon: CalendarClock, title: item.name, detail: dayLabel(next(item)!), href: `/trade/reports/${item.id}`, tone: next(item)! < data.today ? "attention" as const : undefined }))} />
          </RailCard>
          <RailCard title="Recent insights">
            <RailList empty="Nothing to note." items={[
              { key: "risk", icon: Sparkles, title: `${atRisk.length} agreement${atRisk.length === 1 ? " is" : "s are"} behind on accepted tonnes`, detail: atRisk.map((item) => item.number).join(", ") || "None", href: "/trade/agreements" },
              { key: "overdue", icon: Sparkles, title: <>{overdue.length} invoice{overdue.length === 1 ? " is" : "s are"} overdue (<Money value={data.can.pricing ? overdue.reduce((total, item) => total + (item.balance ?? 0), 0) : null} />)</>, detail: overdue.map((item) => item.invoiceNumber).join(", ") || "None", href: "/trade/settlements" },
            ]} />
          </RailCard>
        </aside>
      </div>
      {creating ? <CreateReportDialog onClose={() => setCreating(false)} /> : null}
      {deleting ? <ConfirmDialog title={`Delete ${deleting.name}?`} body="The saved report is removed. The records it reads are not affected." confirmLabel="Delete report" tone="danger" pending={remove.isPending} onConfirm={() => remove.mutate({ id: deleting.id })} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}

function CreateReportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const submission = useSubmissionId();
  const [form, setForm] = useState({ name: "", kind: "agreement_fulfilment" as ReportKind, frequency: "weekly" });
  const save = useTradeAction<Record<string, unknown>, SavedReport>({ path: "/trade/reports", success: () => ({ title: "Report created" }), onDone: (result) => router.push(`/trade/reports/${result.id}`) });
  return (
    <Dialog title="Create report" size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending || form.name.trim().length < 3} onClick={() => save.mutate({ ...form, submissionId: submission.id })}>{save.isPending ? "Saving…" : "Create report"}</button></>}>
      <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-autofocus placeholder="Bayside Metals monthly review" /></Field>
      <Field label="Report type"><Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ReportKind })}>{(Object.keys(reportKindLabels) as ReportKind[]).map((key) => <option key={key} value={key}>{reportKindLabels[key]}</option>)}</Select></Field>
      <Field label="Review" hint="How often the team reviews it."><Select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>{Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
    </Dialog>
  );
}

// ---- One report ------------------------------------------------------------------------------------------------------------

export function TradeReportScreen({ id }: { id: string }) {
  return <TradeData label="Building the report">{(data) => {
    const report = data.reports.find((item) => item.id === id);
    if (!report) return <div className="workspace-page"><Crumbs items={[{ label: "Reports", href: "/trade/reports" }, { label: "Not found" }]} /><EmptyState title="This report could not be found" description="It may have been deleted." /></div>;
    return <ReportView data={data} report={report} />;
  }}</TradeData>;
}

function ReportView({ data, report }: { data: TradeView; report: SavedReport }) {
  const table = buildTradeReport(report.kind, data);
  const run = useTradeAction<Record<string, never>>({ path: `/trade/reports/${report.id}/run`, success: () => ({ title: "Report refreshed", detail: "Built from the current records." }) });
  const [copied, setCopied] = useState(false);
  return (
    <div className="workspace-page trade-page">
      <Crumbs items={[{ label: "Reports", href: "/trade/reports" }, { label: report.name }]} />
      <TradeHeader eyebrow={`${reportCategory[report.kind]} · ${frequencyLabels[report.frequency]}`} title={report.name} description={`${table.title}, built from the records as they are now (${dateTimeLabel(data.now)}).`} icon={FileBarChart}
        actions={<>
          <button className="button button--quiet" onClick={() => run.mutate({})} disabled={run.isPending}>Refresh</button>
          <button className="button button--quiet" onClick={() => { exportCsv(`${report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, table.head, table.rows); run.mutate({}); }}><Download /> Export CSV</button>
          <button className="button button--quiet" onClick={() => window.print()}><Printer /> Print</button>
          <button className="button button--quiet" onClick={() => { void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true)); }}><Share2 /> {copied ? "Link copied" : "Copy link"}</button>
        </>} />
      {!data.can.pricing ? <div className="note-bar" role="status"><span>Values are restricted for your role and show as “Restricted”.</span></div> : null}
      <section className="card register-card" aria-label={table.title}>
        {table.rows.length === 0 ? <p className="muted trade-mini-empty">Nothing to report yet.</p> : (
          <div className="table-wrap">
            <table className="data-table data-table--register">
              <thead><tr>{table.head.map((item) => <th key={item} scope="col">{item}</th>)}</tr></thead>
              <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={table.head[column]} data-label={table.head[column]}>{typeof cell === "number" ? cell.toLocaleString("en-GB") : cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {table.note ? <p className="card__footnote">{table.note}</p> : null}
      </section>
      <p className="muted trade-small">Last run {report.lastRunAt ? dateTimeLabel(report.lastRunAt) : "never"} · owner {report.owner}. <Link className="row-link-text" href="/trade/reports">Back to all reports</Link></p>
    </div>
  );
}
