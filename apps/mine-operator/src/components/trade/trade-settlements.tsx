"use client";

/**
 * Settlements: invoices raised on customer-accepted tonnes, payments against them, disputes and credits. A credit reduces an invoice,
 * so it goes to the Mine Manager for approval first. Amounts are visible only to pricing roles.
 */
import { BadgeCheck, CalendarDays, CirclePlus, Database, Download, Hourglass, Scale, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { daysBetween, formatRand, formatTonnes, settlementStatusLabels } from "@core/lib/trade-rules";
import { Dialog } from "@core/components/dialog";
import { Field } from "@core/components/form-field";
import { Select } from "@core/components/select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type SettlementRow, type TradeView } from "../use-trade";
import { SettlementStatus } from "./trade-status";
import { CellMain, dateTimeLabel, dayLabel, Donut, exportCsv, KpiTiles, Money, RailCard, RailList, Register, TradeData, TradeHeader } from "./trade-ui";
import { Busy } from "@core/components/busy";

export function SettlementsScreen() {
  return <TradeData label="Loading settlements">{(data) => <Settlements data={data} />}</TradeData>;
}

function Settlements({ data }: { data: TradeView }) {
  const params = useSearchParams();
  const [viewing, setViewing] = useState<string | null>(params.get("focus"));
  const [invoicing, setInvoicing] = useState<string | null>(params.get("invoice"));
  const rows = data.settlements;
  const year = rows.filter((item) => item.issuedAt.startsWith(data.today.slice(0, 4)));
  const sum = (items: SettlementRow[], pick: (item: SettlementRow) => number | null) => (data.can.pricing ? items.reduce((total, item) => total + (pick(item) ?? 0), 0) : null);
  const settled = rows.filter((item) => item.status === "settled");
  const days = settled.map((item) => daysBetween(item.issuedAt, item.payments.at(-1)?.at ?? item.dueDate)).filter((value) => value >= 0);
  const invoiced = sum(rows, (item) => item.amount);
  const paid = sum(rows, (item) => item.paid);
  const disputed = sum(rows.filter((item) => item.status === "disputed"), (item) => item.balance);
  const outstanding = sum(rows, (item) => item.balance);
  const selected = rows.find((item) => item.id === viewing);
  const upcoming = rows.filter((item) => (item.status === "pending" || item.status === "partial") && item.dueDate >= data.today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
  const clientName = (id: string) => data.clients.find((item) => item.id === id)?.name ?? "";

  return (
    <div className="workspace-page trade-page">
      <TradeHeader title="Settlements" description="Invoices on accepted tonnes, payments, reconciliation and disputes." icon={Database}
        actions={<>
          <button className="button button--quiet" onClick={() => exportCsv("settlements.csv", ["Settlement", "Invoice", "Agreement", "Client", "Tonnes", "Invoiced", "Paid", "Balance", "Status", "Due"], rows.map((item) => [item.number, item.invoiceNumber, item.agreementNumber, clientName(item.clientId), item.tonnes, item.amount, item.paid, item.balance, settlementStatusLabels[item.status], item.dueDate]))}><Download /> Export</button>
          {data.can.manageSettlements ? <button className="button button--primary" onClick={() => setInvoicing("")}><CirclePlus /> Create invoice</button> : null}
        </>} />
      {!data.can.pricing ? <div className="note-bar" role="status"><span>Amounts are restricted to the Mine Manager and the Commercial / Finance Officer. You can see which invoices exist and their status.</span></div> : null}
      <KpiTiles items={[
        { label: `Invoiced (${data.today.slice(0, 4)})`, value: <Money value={sum(year, (item) => item.amount)} />, hint: `${year.length} invoices`, icon: Database },
        { label: `Settled (${data.today.slice(0, 4)})`, value: <Money value={sum(year, (item) => item.paid)} />, hint: "Payments received", icon: BadgeCheck },
        { label: "Outstanding", value: <Money value={outstanding} />, hint: `${rows.filter((item) => item.status === "overdue").length} overdue`, icon: Hourglass, tone: rows.some((item) => item.status === "overdue") ? "attention" : undefined },
        { label: "Average time to settle", value: days.length ? `${Math.round(days.reduce((a, b) => a + b, 0) / days.length)} days` : "—", hint: "Issue to final payment", icon: CalendarDays },
        { label: "Settlement rate", value: invoiced && paid !== null ? `${Math.round((paid / invoiced) * 100)}%` : data.can.pricing ? "—" : <Money value={null} />, hint: "Paid of invoiced", icon: Scale },
      ]} />
      <div className="trade-layout">
        <Register<SettlementRow>
          title="Settlements"
          noun="settlements"
          rows={rows}
          searchLabel="Search by invoice, agreement, customer or commodity"
          search={(row) => [row.number, row.invoiceNumber, row.agreementNumber, clientName(row.clientId), row.commodity].join(" ")}
          chips={(["pending", "overdue", "partial", "settled", "disputed"] as const).map((status) => ({ key: status, label: settlementStatusLabels[status], test: (row) => row.status === status }))}
          initialSort={{ key: "due", direction: "desc" }}
          columns={[
            { key: "ref", label: "Invoice", sort: (row) => row.invoiceNumber, render: (row) => <CellMain title={row.invoiceNumber} detail={`${row.number} · ${row.agreementNumber}`} /> },
            { key: "customer", label: "Customer", sort: (row) => clientName(row.clientId), render: (row) => clientName(row.clientId) },
            { key: "tonnes", label: "Accepted t", sort: (row) => row.tonnes, render: (row) => formatTonnes(row.tonnes) },
            { key: "amount", label: "Invoiced", sort: (row) => row.amount ?? 0, align: "end", render: (row) => <Money value={row.amount} /> },
            { key: "balance", label: "Balance", sort: (row) => row.balance ?? 0, align: "end", render: (row) => <Money value={row.balance} /> },
            { key: "status", label: "Status", sort: (row) => row.status, render: (row) => <SettlementStatus settlement={row} /> },
            { key: "due", label: "Due", sort: (row) => row.dueDate, render: (row) => dayLabel(row.dueDate) },
          ]}
          actions={(row) => <button className="button button--quiet button--small" onClick={() => setViewing(row.id)} aria-label={`View ${row.invoiceNumber}`}>View</button>}
          empty={{ title: "No invoices yet", body: "Invoices are raised on deliveries the customer has accepted." }}
        />
        <aside className="trade-rail" aria-label="Settlement insights">
          <RailCard title="Settlement summary">
            {data.can.pricing ? (
              <Donut label="Settlement summary" centre={invoiced ? `${Math.round(((paid ?? 0) / invoiced) * 100)}%` : "—"} caption="Settled" segments={[
                { label: "Settled", value: paid ?? 0, tone: "positive", display: formatRand(paid ?? 0) },
                { label: "Outstanding", value: Math.max(0, (outstanding ?? 0) - (disputed ?? 0)), tone: "warning", display: formatRand(Math.max(0, (outstanding ?? 0) - (disputed ?? 0))) },
                { label: "Disputed", value: disputed ?? 0, tone: "danger", display: formatRand(disputed ?? 0) },
              ]} />
            ) : <p className="muted trade-rail-empty">Amounts are restricted.</p>}
          </RailCard>
          <RailCard title="Upcoming settlements">
            <RailList empty="Nothing due." items={upcoming.map((item) => ({ key: item.id, icon: CalendarDays, title: <>{item.invoiceNumber} · <Money value={item.balance} /></>, detail: `${clientName(item.clientId)} · due ${dayLabel(item.dueDate)}` }))} />
          </RailCard>
          <RailCard title="Exceptions">
            <RailList empty="No overdue, partial or disputed invoices." items={rows.filter((item) => ["overdue", "disputed", "partial"].includes(item.status)).map((item) => ({ key: item.id, icon: TriangleAlert, tone: item.status === "partial" ? "attention" as const : "critical" as const, title: <>{item.invoiceNumber} – {settlementStatusLabels[item.status].toLowerCase()} (<Money value={item.balance} />)</>, detail: item.status === "overdue" ? `${item.daysOverdue} days overdue` : item.dispute?.reason ?? clientName(item.clientId) }))} />
          </RailCard>
        </aside>
      </div>
      {selected ? <SettlementDialog data={data} settlement={selected} onClose={() => setViewing(null)} /> : null}
      {invoicing !== null ? <InvoiceDialog data={data} agreementId={invoicing} onClose={() => setInvoicing(null)} /> : null}
    </div>
  );
}

function SettlementDialog({ data, settlement, onClose }: { data: TradeView; settlement: SettlementRow; onClose: () => void }) {
  const [mode, setMode] = useState<null | "pay" | "dispute" | "resolve">(null);
  const [form, setForm] = useState({ amount: settlement.balance ? String(settlement.balance) : "", reference: "", date: data.today, reason: "", resolution: "", credit: "0" });
  const pay = useTradeAction<Record<string, unknown>>({ path: `/trade/settlements/${settlement.id}/payments`, success: () => ({ title: "Payment recorded" }), onDone: () => setMode(null) });
  const dispute = useTradeAction<Record<string, unknown>>({ path: `/trade/settlements/${settlement.id}/dispute`, success: () => ({ title: "Dispute recorded" }), onDone: () => setMode(null) });
  const resolve = useTradeAction<Record<string, unknown>>({ path: `/trade/settlements/${settlement.id}/resolve`, success: () => ({ title: Number(form.credit) > 0 ? "Credit sent for approval" : "Dispute resolved" }), onDone: () => setMode(null) });
  const manage = data.can.manageSettlements;
  const openDispute = settlement.dispute && !settlement.dispute.resolved;
  const pending = pay.isPending || dispute.isPending || resolve.isPending;
  return (
    <Dialog title={`${settlement.invoiceNumber} · ${data.clients.find((item) => item.id === settlement.clientId)?.name}`} description={`${settlement.number} · ${settlement.agreementNumber} · ${settlement.commodity}`} size="wide" onClose={onClose} locked={pending}
      footer={<button className="button button--quiet" onClick={onClose}>Close</button>}>
      <div className="trade-dialog-grid">
        <dl className="trade-definitions">
          <div><dt>Status</dt><dd><SettlementStatus settlement={settlement} /></dd></div>
          <div><dt>Accepted tonnes invoiced</dt><dd>{formatTonnes(settlement.tonnes)}</dd></div>
          <div><dt>Deliveries</dt><dd>{settlement.deliveryIds.map((id, index) => <Link key={id} className="row-link-text" href={`/trade/deliveries/${id}`}>{settlement.deliveryNumbers[index]}{index < settlement.deliveryIds.length - 1 ? ", " : ""}</Link>)}</dd></div>
          <div><dt>Issued</dt><dd>{dayLabel(settlement.issuedAt)}</dd></div>
          <div><dt>Due</dt><dd>{dayLabel(settlement.dueDate)}{settlement.status === "overdue" ? ` (${settlement.daysOverdue} days overdue)` : ""}</dd></div>
          <div><dt>Invoiced</dt><dd><Money value={settlement.amount} exact /></dd></div>
          <div><dt>Paid</dt><dd><Money value={settlement.paid} exact /></dd></div>
          <div><dt>Balance</dt><dd><Money value={settlement.balance} exact /></dd></div>
          {settlement.dispute ? <div><dt>Dispute</dt><dd>{settlement.dispute.reason}{settlement.dispute.resolution ? ` — ${settlement.dispute.resolution}` : ""}</dd></div> : null}
        </dl>
        <div>
          <h3 className="trade-subtitle">Payments</h3>
          {settlement.payments.length === 0 ? <p className="muted">{data.can.pricing ? "No payments recorded." : "Payments are restricted."}</p> : <ul className="trade-payments">{settlement.payments.map((item) => <li key={item.id}><strong>{formatRand(item.amount)}</strong><small>{item.reference} · {dayLabel(item.at)} · {item.by}</small></li>)}</ul>}
          <h3 className="trade-subtitle">History</h3>
          <ol className="trade-history">{[...settlement.history].reverse().map((item) => <li key={item.id}><strong>{item.summary}</strong><small>{item.actor} · {dateTimeLabel(item.at)}</small>{item.note ? <p>{item.note}</p> : null}</li>)}</ol>
        </div>
      </div>
      {manage ? (
        <section className="trade-dialog-actions" aria-label="Settlement actions">
          {mode === null ? (
            <div className="button-row">
              {settlement.status !== "settled" && !openDispute ? <button className="button button--primary" onClick={() => setMode("pay")}><Wallet /> Record payment</button> : null}
              {!openDispute && settlement.status !== "settled" ? <button className="button button--quiet" onClick={() => setMode("dispute")}>Record dispute</button> : null}
              {openDispute ? <button className="button button--primary" onClick={() => setMode("resolve")}>Resolve dispute</button> : null}
            </div>
          ) : null}
          {mode === "pay" ? (
            <div className="form-grid">
              <Field label="Amount (R)"><input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
              <Field label="Payment reference"><input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="EFT 0042" /></Field>
              <Field label="Date received"><input type="date" max={data.today} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
              <div className="button-row"><button className="button button--quiet" onClick={() => setMode(null)}>Cancel</button><button className="button button--primary" disabled={pay.isPending || !(Number(form.amount) > 0) || form.reference.trim().length < 3} onClick={() => pay.mutate({ amount: Number(form.amount), reference: form.reference, date: form.date, version: settlement.version })}><Busy pending={pay.isPending} label="Saving…">Save payment</Busy></button></div>
            </div>
          ) : null}
          {mode === "dispute" ? (
            <div className="form-grid">
              <Field label="Disputed amount (R)" hint="Optional"><input inputMode="decimal" value={form.credit} onChange={(event) => setForm({ ...form, credit: event.target.value })} /></Field>
              <Field label="What does the customer dispute?" wide><textarea rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field>
              <div className="button-row"><button className="button button--quiet" onClick={() => setMode(null)}>Cancel</button><button className="button button--primary" disabled={dispute.isPending || form.reason.trim().length < 5} onClick={() => dispute.mutate({ reason: form.reason, amount: Number(form.credit) > 0 ? Number(form.credit) : null })}><Busy pending={dispute.isPending} label="Saving…">Record dispute</Busy></button></div>
            </div>
          ) : null}
          {mode === "resolve" ? (
            <div className="form-grid">
              <Field label="Credit to issue (R)" hint="0 to resolve without a credit. A credit needs Mine Manager approval."><input inputMode="decimal" value={form.credit} onChange={(event) => setForm({ ...form, credit: event.target.value })} /></Field>
              <Field label="Resolution" wide><textarea rows={2} value={form.resolution} onChange={(event) => setForm({ ...form, resolution: event.target.value })} /></Field>
              <div className="button-row"><button className="button button--quiet" onClick={() => setMode(null)}>Cancel</button><button className="button button--primary" disabled={resolve.isPending || form.resolution.trim().length < 5} onClick={() => resolve.mutate({ resolution: form.resolution, credit: Number(form.credit) || 0 })}><Busy pending={resolve.isPending} label="Saving…">{Number(form.credit) > 0 ? "Send credit for approval" : "Resolve"}</Busy></button></div>
            </div>
          ) : null}
        </section>
      ) : null}
    </Dialog>
  );
}

function InvoiceDialog({ data, agreementId, onClose }: { data: TradeView; agreementId: string; onClose: () => void }) {
  const submission = useSubmissionId();
  const invoiced = new Set(data.settlements.flatMap((item) => item.deliveryIds));
  const ready = data.deliveries.filter((item) => item.acceptance && !invoiced.has(item.id));
  const agreements = data.agreements.filter((item) => ready.some((delivery) => delivery.agreementId === item.id));
  const [agreement, setAgreement] = useState(agreements.some((item) => item.id === agreementId) ? agreementId : agreements[0]?.id ?? "");
  const options = ready.filter((item) => item.agreementId === agreement);
  const [chosen, setChosen] = useState<string[]>(options.map((item) => item.id));
  const price = data.agreements.find((item) => item.id === agreement)?.pricePerTonne ?? null;
  const tonnes = options.filter((item) => chosen.includes(item.id)).reduce((total, item) => total + item.quantities.accepted, 0);
  const save = useTradeAction<Record<string, unknown>>({ path: "/trade/settlements", success: () => ({ title: "Invoice created" }), onDone: onClose });
  return (
    <Dialog title="Create invoice" description="Invoices cover customer-accepted tonnes that are not yet invoiced." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending || chosen.length === 0} onClick={() => save.mutate({ agreementId: agreement, deliveryIds: chosen, submissionId: submission.id })}><Busy pending={save.isPending} label="Saving…">Create invoice</Busy></button></>}>
      {agreements.length === 0 ? <p className="muted">No accepted deliveries are waiting to be invoiced. Record customer acceptance on a delivery first.</p> : (
        <>
          <Field label="Agreement"><Select value={agreement} onChange={(event) => { setAgreement(event.target.value); setChosen(ready.filter((item) => item.agreementId === event.target.value).map((item) => item.id)); }}>{agreements.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.clientName}</option>)}</Select></Field>
          <fieldset className="trade-checklist">
            <legend>Accepted deliveries</legend>
            {options.map((item) => (
              <label key={item.id} className="checkbox-row"><input type="checkbox" checked={chosen.includes(item.id)} onChange={(event) => setChosen(event.target.checked ? [...chosen, item.id] : chosen.filter((id) => id !== item.id))} /> <span>{item.number} · {formatTonnes(item.quantities.accepted)} accepted on {dayLabel(item.acceptance!.at)}</span></label>
            ))}
          </fieldset>
          <p className="trade-small"><strong>{formatTonnes(tonnes)}</strong> × {price === null ? "restricted price" : `${formatRand(price)}/t`} = <strong><Money value={price === null ? null : tonnes * price} /></strong></p>
        </>
      )}
    </Dialog>
  );
}
