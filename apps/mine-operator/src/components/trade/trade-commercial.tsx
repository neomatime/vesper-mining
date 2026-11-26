"use client";

/**
 * Enquiries and Agreements. An enquiry is qualified, quoted (after finance approves the quotation), negotiated and then won or lost.
 * A won enquiry becomes a draft agreement; an agreement is a set of fulfilment commitments (tonnes, due date, delivery point) and goes
 * live only once approved. Amendments wait for approval before they change anything.
 */
import { CalendarClock, CirclePlus, Download, FileText, Layers, Link2, Mail, Plus, RefreshCw, Target, Trash2, TriangleAlert, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { addDays, COMMODITIES, daysBetween, enquiryStageLabels, formatRand, formatTonnes } from "@/lib/trade-rules";
import { Dialog } from "../dialog";
import { Field } from "../form-field";
import { EmptyState } from "../query-state";
import { Select } from "../select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type AgreementRow, type EnquiryRow, type TradeView } from "../use-trade";
import { AgreementStatus, agreementState, DeliveryStatus, DocumentStatus, EnquiryStage, Readiness, SettlementStatus } from "./trade-status";
import { ActionMenu, CellMain, Crumbs, dateTimeLabel, dayLabel, exportCsv, KpiTiles, Money, Progress, RailCard, RailList, Register, TradeData, TradeHeader, ViewLink } from "./trade-ui";

// ---- Enquiries -------------------------------------------------------------------------------------------------------------

export function EnquiriesScreen() {
  return <TradeData label="Loading enquiries">{(data) => <Enquiries data={data} />}</TradeData>;
}

function Enquiries({ data }: { data: TradeView }) {
  const params = useSearchParams();
  const [creating, setCreating] = useState<string | null>(params.get("new"));
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const rows = data.enquiries;
  const live = rows.filter((item) => !["won", "lost"].includes(item.stage));
  const value = data.can.pricing ? live.reduce((total, item) => total + (item.value ?? 0), 0) : null;
  const stages = Object.keys(enquiryStageLabels) as (keyof typeof enquiryStageLabels)[];
  const viewing = rows.find((item) => item.id === open);
  const upcoming = live.filter((item) => item.nextActionDate).sort((a, b) => a.nextActionDate!.localeCompare(b.nextActionDate!)).slice(0, 4);
  const commodityLeader = COMMODITIES.map((name) => ({ name, tonnes: live.filter((item) => item.commodity === name).reduce((total, item) => total + item.tonnes, 0) })).sort((a, b) => b.tonnes - a.tonnes)[0];

  return (
    <div className="workspace-page trade-page">
      <TradeHeader title="Enquiries" description="Buyer enquiries, qualification, quotations and commercial follow-ups." icon={Mail}
        actions={<>
          <button className="button button--quiet" onClick={() => exportCsv("enquiries.csv", ["Enquiry", "Client", "Commodity", "Tonnes", "Window", "Stage", "Owner"], rows.map((item) => [item.number, item.clientName, item.commodity, item.tonnes, item.deliveryWindow, enquiryStageLabels[item.stage], item.owner]))}><Download /> Export</button>
          {data.can.manageEnquiries ? <button className="button button--primary" onClick={() => setCreating("")}><CirclePlus /> New enquiry</button> : null}
        </>} />
      <KpiTiles items={[
        { label: "Open enquiries", value: live.length, hint: `${live.filter((item) => item.stage === "new").length} new`, icon: Mail },
        { label: "Qualified", value: live.filter((item) => item.stage !== "new").length, hint: "Qualified or further", icon: Target },
        { label: "Quoted value (open)", value: <Money value={value} />, hint: "Quoted price × requested tonnes", icon: Wallet },
        { label: "Awaiting response", value: live.filter((item) => item.stage === "quotation_sent").length, hint: `${live.filter((item) => item.quotationPending).length} quotes awaiting approval`, icon: CalendarClock },
      ]} />
      <div className="trade-layout">
        <Register<EnquiryRow>
          title="Enquiry pipeline"
          noun="enquiries"
          rows={rows}
          searchLabel="Search enquiries, customers or commodities"
          search={(row) => [row.number, row.clientName, row.commodity, row.owner, row.deliveryWindow].join(" ")}
          chips={stages.map((stage) => ({ key: stage, label: enquiryStageLabels[stage], test: (row) => row.stage === stage }))}
          initialSort={{ key: "enquiry", direction: "desc" }}
          columns={[
            { key: "enquiry", label: "Enquiry", sort: (row) => row.number, render: (row) => <button className="row-link-text" onClick={() => setOpen(row.id)}>{row.number}</button> },
            { key: "customer", label: "Customer", sort: (row) => row.clientName, render: (row) => <Link className="row-link-text" href={`/trade/portfolio/${row.clientId}`}>{row.clientName}</Link> },
            { key: "commodity", label: "Commodity", sort: (row) => row.commodity, render: (row) => row.commodity },
            { key: "quantity", label: "Requested", sort: (row) => row.tonnes, render: (row) => formatTonnes(row.tonnes) },
            { key: "window", label: "Delivery window", render: (row) => row.deliveryWindow },
            { key: "stage", label: "Stage", sort: (row) => stages.indexOf(row.stage), render: (row) => <EnquiryStage enquiry={row} /> },
            { key: "owner", label: "Owner", sort: (row) => row.owner, render: (row) => row.owner },
          ]}
          actions={(row) => <button className="button button--quiet button--small" onClick={() => setOpen(row.id)} aria-label={`${nextStepLabel(row)} ${row.number}`}>{nextStepLabel(row)}</button>}
          empty={{ title: "No enquiries yet", body: "Log a buyer's enquiry to start the pipeline." }}
        />
        <aside className="trade-rail" aria-label="Enquiry insights">
          <RailCard title="Stage mix">
            <div className="trade-stack" role="img" aria-label={stages.map((stage) => `${enquiryStageLabels[stage]} ${rows.filter((item) => item.stage === stage).length}`).join(", ")}>
              {stages.map((stage) => { const count = rows.filter((item) => item.stage === stage).length; return count ? <span key={stage} className={`trade-stack__part trade-stack__part--${stage}`} style={{ flexGrow: count }} /> : null; })}
            </div>
            <ul className="trade-legend">{stages.map((stage) => <li key={stage}><span className={`trade-legend__dot trade-stack__part--${stage}`} aria-hidden="true" />{enquiryStageLabels[stage]}<strong>{rows.filter((item) => item.stage === stage).length}</strong></li>)}</ul>
          </RailCard>
          <RailCard title="Upcoming actions">
            <RailList empty="No follow-ups scheduled." items={upcoming.map((item) => ({ key: item.id, icon: CalendarClock, title: item.nextAction ?? "Follow up", detail: `${item.number} · ${item.clientName}`, aside: dayLabel(item.nextActionDate!), tone: item.nextActionDate! < data.today ? "critical" as const : undefined }))} />
          </RailCard>
          <RailCard title="Commercial notes">
            <p className="trade-note">{commodityLeader && commodityLeader.tonnes ? `${commodityLeader.name} accounts for the most requested tonnes in open enquiries (${formatTonnes(commodityLeader.tonnes)}).` : "No open enquiries."} {live.filter((item) => item.quotationPending).length ? `${live.filter((item) => item.quotationPending).length} quotation is waiting for finance approval.` : ""}</p>
          </RailCard>
        </aside>
      </div>
      {creating !== null ? <EnquiryDialog data={data} clientId={creating} onClose={() => setCreating(null)} /> : null}
      {viewing ? <EnquiryDetailDialog data={data} enquiry={viewing} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function nextStepLabel(enquiry: EnquiryRow) {
  if (enquiry.quotationPending) return "View";
  return ({ new: "Qualify", qualified: "Quote", quotation_sent: "Follow up", negotiation: "Update", won: "View", lost: "View outcome" } as const)[enquiry.stage];
}

function EnquiryDialog({ data, clientId, onClose }: { data: TradeView; clientId: string; onClose: () => void }) {
  const submission = useSubmissionId();
  const [form, setForm] = useState({ clientId: clientId || "", commodity: COMMODITIES[0] as string, tonnes: "", deliveryWindow: "", owner: data.actor.name, nextAction: "", nextActionDate: addDays(data.today, 2) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useTradeAction<Record<string, unknown>>({ path: "/trade/enquiries", success: () => ({ title: "Enquiry logged" }), onDone: onClose });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });
  const submit = () => {
    const next: Record<string, string> = {};
    if (!form.clientId) next.clientId = "Choose the client.";
    if (!(Number(form.tonnes) > 0)) next.tonnes = "Enter the requested tonnes.";
    if (form.deliveryWindow.trim().length < 3) next.deliveryWindow = "For example: Jun 2025 or Q3 2025.";
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate({ ...form, tonnes: Number(form.tonnes), submissionId: submission.id });
  };
  return (
    <Dialog title="New enquiry" description="A buyer asking for material. Prices are added when you quote." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Log enquiry"}</button></>}>
      <div className="form-grid">
        <Field label="Client" error={errors.clientId}><Select value={form.clientId} onChange={set("clientId")}><option value="">Choose a client</option>{data.clients.filter((item) => item.status !== "inactive").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Commodity"><Select value={form.commodity} onChange={set("commodity")}>{COMMODITIES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <Field label="Requested quantity (t)" error={errors.tonnes}><input inputMode="decimal" value={form.tonnes} onChange={set("tonnes")} /></Field>
        <Field label="Delivery window" error={errors.deliveryWindow}><input value={form.deliveryWindow} onChange={set("deliveryWindow")} placeholder="Jun 2025" /></Field>
        <Field label="Owner"><input value={form.owner} onChange={set("owner")} /></Field>
        <Field label="Follow up by"><input type="date" value={form.nextActionDate} onChange={set("nextActionDate")} /></Field>
        <Field label="Next action" wide><input value={form.nextAction} onChange={set("nextAction")} placeholder="Qualify volumes and credit" /></Field>
      </div>
    </Dialog>
  );
}

function EnquiryDetailDialog({ data, enquiry, onClose }: { data: TradeView; enquiry: EnquiryRow; onClose: () => void }) {
  const [price, setPrice] = useState(enquiry.pricePerTonne ? String(enquiry.pricePerTonne) : "");
  const [note, setNote] = useState("");
  const [lost, setLost] = useState(false);
  const move = useTradeAction<Record<string, unknown>, EnquiryRow>({ path: `/trade/enquiries/${enquiry.id}/stage`, success: (result) => ({ title: result.quotationApprovalId && result.stage !== "quotation_sent" ? "Quotation sent for approval" : "Enquiry updated" }), onDone: () => { setNote(""); setLost(false); } });
  const go = (stage: string, extra: Record<string, unknown> = {}) => move.mutate({ stage, note, version: enquiry.version, ...extra });
  const closed = enquiry.stage === "won" || enquiry.stage === "lost";
  const manage = data.can.manageEnquiries && !closed;
  return (
    <Dialog title={`${enquiry.number} · ${enquiry.clientName}`} description={`${formatTonnes(enquiry.tonnes)} ${enquiry.commodity.toLowerCase()} · ${enquiry.deliveryWindow}`} size="wide" onClose={onClose} locked={move.isPending}
      footer={<button className="button button--quiet" onClick={onClose}>Close</button>}>
      <div className="trade-dialog-grid">
        <dl className="trade-definitions">
          <div><dt>Stage</dt><dd><EnquiryStage enquiry={enquiry} /></dd></div>
          <div><dt>Owner</dt><dd>{enquiry.owner}</dd></div>
          <div><dt>Received</dt><dd>{dateTimeLabel(enquiry.receivedAt)}</dd></div>
          <div><dt>Quotation</dt><dd>{enquiry.quotationRef ?? "Not quoted yet"}</dd></div>
          <div><dt>Quoted price</dt><dd>{enquiry.pricePerTonne === null && !data.can.pricing ? <Money value={null} /> : enquiry.pricePerTonne ? `${formatRand(enquiry.pricePerTonne)}/t` : "—"}</dd></div>
          <div><dt>Next action</dt><dd>{enquiry.nextAction ?? "—"}{enquiry.nextActionDate ? ` (by ${dayLabel(enquiry.nextActionDate)})` : ""}</dd></div>
          {enquiry.lostReason ? <div><dt>Why it was lost</dt><dd>{enquiry.lostReason}</dd></div> : null}
          {enquiry.agreementNumber ? <div><dt>Agreement</dt><dd><Link className="row-link-text" href={`/trade/agreements/${enquiry.agreementId}`}>{enquiry.agreementNumber}</Link></dd></div> : null}
        </dl>
        <div>
          <h3 className="trade-subtitle">History</h3>
          <ol className="trade-history">{[...enquiry.history].reverse().map((item) => <li key={item.id}><strong>{item.summary}</strong><small>{item.actor} · {dateTimeLabel(item.at)}</small>{item.note ? <p>{item.note}</p> : null}</li>)}</ol>
        </div>
      </div>
      {enquiry.quotationPending ? <div className="note-bar" role="status"><span>Quotation {enquiry.quotationRef} is waiting for finance approval. It reaches the buyer only once approved.</span></div> : null}
      {manage && !enquiry.quotationPending ? (
        <section className="trade-dialog-actions" aria-label="Next step">
          <Field label="Note (optional, required when lost)"><input value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          {(enquiry.stage === "qualified" || enquiry.stage === "negotiation") && data.can.pricing ? <Field label="Price per tonne (R)" hint="The quotation goes to finance for approval first."><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></Field> : null}
          <div className="button-row">
            {enquiry.stage === "new" ? <button className="button button--primary" disabled={move.isPending} onClick={() => go("qualified")}>Mark qualified</button> : null}
            {(enquiry.stage === "qualified" || enquiry.stage === "negotiation") && data.can.pricing ? <button className="button button--primary" disabled={move.isPending || !(Number(price) > 0)} onClick={() => go("quotation_sent", { pricePerTonne: Number(price) })}>Send quotation for approval</button> : null}
            {enquiry.stage === "quotation_sent" ? <button className="button button--quiet" disabled={move.isPending} onClick={() => go("negotiation")}>Move to negotiation</button> : null}
            {(enquiry.stage === "quotation_sent" || enquiry.stage === "negotiation") ? <button className="button button--primary" disabled={move.isPending} onClick={() => go("won")}>Mark won</button> : null}
            {lost ? <button className="button button--danger" disabled={move.isPending || note.trim().length < 5} onClick={() => go("lost")}>Confirm lost</button> : <button className="button button--quiet" onClick={() => setLost(true)}>Mark lost…</button>}
          </div>
        </section>
      ) : null}
      {enquiry.stage === "won" && !enquiry.agreementId && data.can.manageAgreements ? <div className="button-row"><Link className="button button--primary" href={`/trade/agreements/new?enquiry=${enquiry.id}`}>Draft the agreement</Link></div> : null}
    </Dialog>
  );
}

// ---- Agreements ------------------------------------------------------------------------------------------------------------

export function AgreementsScreen() {
  return <TradeData label="Loading agreements">{(data) => <Agreements data={data} />}</TradeData>;
}

function Agreements({ data }: { data: TradeView }) {
  const params = useSearchParams();
  const [client, setClient] = useState(params.get("client") ?? "");
  const rows = data.agreements;
  const active = rows.filter((item) => item.status === "active");
  const committedDue = active.reduce((total, item) => total + item.commitments.filter((c) => c.dueDate < data.today).reduce((sum, c) => sum + c.tonnes, 0), 0);
  const acceptedDue = active.reduce((total, item) => total + item.commitments.filter((c) => c.dueDate < data.today).reduce((sum, c) => sum + c.accepted, 0), 0);
  const value = data.can.pricing ? active.reduce((total, item) => total + (item.contractValue ?? 0), 0) : null;
  const expiring = active.filter((item) => daysBetween(data.today, item.endDate) <= 90);
  const pending = rows.filter((item) => item.status === "pending_approval");
  const amendments = rows.filter((item) => item.amendments.some((a) => a.status === "pending"));

  return (
    <div className="workspace-page trade-page">
      <TradeHeader title="Agreements" description="Customer agreements, their fulfilment commitments, amendments and performance." icon={FileText}
        actions={<>
          <button className="button button--quiet" onClick={() => exportCsv("agreements.csv", ["Agreement", "Client", "Commodity", "Committed t", "Dispatched t", "Received t", "Accepted t", "Status", "End date"], rows.map((item) => [item.number, item.clientName, item.commodity, item.committed, item.dispatched, item.received, item.accepted, agreementState(item).label, item.endDate]))}><Download /> Export</button>
          {data.can.manageAgreements ? <Link className="button button--primary" href="/trade/agreements/new"><CirclePlus /> New agreement</Link> : null}
        </>} />
      <KpiTiles items={[
        { label: "Active agreements", value: active.length, hint: `${pending.length} awaiting approval`, icon: FileText },
        { label: "Committed volume", value: formatTonnes(active.reduce((total, item) => total + item.committed, 0)), hint: "Across active agreements", icon: Layers },
        { label: "Accepted to date", value: committedDue ? `${Math.round((acceptedDue / committedDue) * 100)}%` : "—", hint: "Of tonnes due so far", icon: Target, tone: committedDue && acceptedDue / committedDue < 0.85 ? "attention" : undefined },
        { label: "Contract value", value: <Money value={value} />, hint: "Committed tonnes × price", icon: Wallet },
      ]} />
      <div className="trade-layout">
        <Register<AgreementRow>
          title="Agreements portfolio"
          noun="agreements"
          rows={rows}
          searchLabel="Search agreements by reference, customer or commodity"
          search={(row) => [row.number, row.clientName, row.commodity, row.title].join(" ")}
          href={(row) => `/trade/agreements/${row.id}`}
          chips={[
            { key: "active", label: "Active", test: (row) => row.status === "active" },
            { key: "at_risk", label: "At risk", test: (row) => row.health === "at_risk" },
            { key: "expiring", label: "Expiring", test: (row) => row.status === "active" && daysBetween(data.today, row.endDate) <= 90 },
            { key: "draft", label: "Draft", test: (row) => row.status === "draft" || row.status === "pending_approval" },
            { key: "closed", label: "Closed", test: (row) => ["completed", "terminated", "suspended"].includes(row.status) },
          ]}
          extra={{
            controls: <label className="trade-select"><span className="sr-only">Client</span><Select value={client} onChange={(event) => setClient(event.target.value)}><option value="">All clients</option>{data.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>,
            test: (row) => !client || row.clientId === client,
            active: Boolean(client),
            clear: () => setClient(""),
          }}
          initialSort={{ key: "agreement", direction: "desc" }}
          columns={[
            { key: "agreement", label: "Agreement", sort: (row) => row.number, render: (row) => <CellMain title={row.number} detail={row.commodity} /> },
            { key: "customer", label: "Customer", sort: (row) => row.clientName, render: (row) => row.clientName },
            { key: "committed", label: "Committed", sort: (row) => row.committed, render: (row) => formatTonnes(row.committed) },
            { key: "accepted", label: "Accepted", sort: (row) => row.accepted, render: (row) => formatTonnes(row.accepted) },
            { key: "fulfilment", label: "Fulfilment", sort: (row) => row.share, render: (row) => <Progress share={row.share} tone={row.health === "at_risk" ? "warning" : row.status === "active" || row.status === "completed" ? "positive" : "warning"} /> },
            { key: "status", label: "Status", sort: (row) => agreementState(row).label, render: (row) => <AgreementStatus agreement={row} /> },
            { key: "end", label: "End date", sort: (row) => row.endDate, render: (row) => dayLabel(row.endDate) },
          ]}
          actions={(row) => <ViewLink href={`/trade/agreements/${row.id}`} name={row.number} />}
          empty={{ title: "No agreements yet", body: "Draft an agreement from a won enquiry, or start a new one." }}
        />
        <aside className="trade-rail" aria-label="Agreement insights">
          <RailCard title="Accepted by commodity">
            <ul className="trade-bars">
              {COMMODITIES.map((name) => {
                const own = active.filter((item) => item.commodity === name);
                const due = own.reduce((total, item) => total + item.commitments.filter((c) => c.dueDate < data.today).reduce((sum, c) => sum + c.tonnes, 0), 0);
                const done = own.reduce((total, item) => total + item.commitments.filter((c) => c.dueDate < data.today).reduce((sum, c) => sum + c.accepted, 0), 0);
                return <li key={name}><span>{name}</span><Progress share={due ? done / due : 0} label={`${name}: ${due ? Math.round((done / due) * 100) : 0}% of due tonnes accepted`} /></li>;
              })}
            </ul>
          </RailCard>
          <RailCard title="Key dates">
            <RailList empty="Nothing coming up." items={[
              { key: "exp", icon: CalendarClock, title: `${expiring.length} agreement${expiring.length === 1 ? "" : "s"} ending within 90 days`, detail: expiring.map((item) => item.number).join(", ") || "None" },
              { key: "pend", icon: CalendarClock, title: `${pending.length} awaiting approval`, detail: pending.map((item) => item.number).join(", ") || "None", href: pending.length ? "/trade/approvals" : undefined },
              { key: "amend", icon: CalendarClock, title: `${amendments.length} amendment${amendments.length === 1 ? "" : "s"} under review`, detail: amendments.map((item) => item.number).join(", ") || "None", href: amendments.length ? "/trade/approvals" : undefined },
            ]} />
          </RailCard>
          <RailCard title="Alerts">
            <RailList empty="No agreement needs attention." items={active.filter((item) => item.health === "at_risk" || daysBetween(data.today, item.endDate) <= 45).map((item) => ({ key: item.id, icon: TriangleAlert, tone: item.health === "at_risk" ? "critical" as const : "attention" as const, title: item.health === "at_risk" ? `${item.number} is ${Math.round((item.dueShare ?? 0) * 100)}% accepted of tonnes due` : `${item.number} ends in ${daysBetween(data.today, item.endDate)} days`, href: `/trade/agreements/${item.id}` }))} />
          </RailCard>
        </aside>
      </div>
    </div>
  );
}

// ---- Agreement detail ------------------------------------------------------------------------------------------------------

export function AgreementScreen({ id }: { id: string }) {
  return <TradeData label="Loading the agreement">{(data) => {
    const agreement = data.agreements.find((item) => item.id === id);
    if (!agreement) return <div className="workspace-page"><Crumbs items={[{ label: "Agreements", href: "/trade/agreements" }, { label: "Not found" }]} /><EmptyState title="This agreement could not be found" description="The link may be wrong." /></div>;
    return <AgreementDetail data={data} agreement={agreement} />;
  }}</TradeData>;
}

function AgreementDetail({ data, agreement }: { data: TradeView; agreement: AgreementRow }) {
  const [dialog, setDialog] = useState<null | "amend" | "submit" | { status: string }>(null);
  const deliveries = data.deliveries.filter((item) => item.agreementId === agreement.id);
  const settlements = data.settlements.filter((item) => item.agreementId === agreement.id);
  const documents = data.documents.filter((item) => item.reference === agreement.number);
  const links = data.links.filter((item) => item.agreementId === agreement.id);
  const manage = data.can.manageAgreements;

  return (
    <div className="workspace-page trade-page">
      <Crumbs items={[{ label: "Agreements", href: "/trade/agreements" }, { label: agreement.number }]} />
      <header className="trade-detail-head">
        <span className="trade-detail-head__mark" aria-hidden="true"><FileText /></span>
        <div className="trade-detail-head__copy">
          <h1>{agreement.number} <AgreementStatus agreement={agreement} /></h1>
          <p>{agreement.title} for <Link className="row-link-text" href={`/trade/portfolio/${agreement.clientId}`}>{agreement.clientName}</Link></p>
          <p className="trade-detail-head__meta"><span>{agreement.commodity}</span><span>{dayLabel(agreement.startDate)} – {dayLabel(agreement.endDate)}</span><span>{agreement.incoterm}</span><span>{agreement.paymentTermsDays} days to pay</span></p>
        </div>
        <dl className="trade-detail-head__figures">
          <div><dt>Committed</dt><dd>{formatTonnes(agreement.committed)}</dd></div>
          <div><dt>Accepted</dt><dd>{formatTonnes(agreement.accepted)}</dd></div>
          <div><dt>Price</dt><dd>{agreement.pricePerTonne === null ? <Money value={null} /> : `${formatRand(agreement.pricePerTonne)}/t`}</dd></div>
          <div><dt>Outstanding</dt><dd><Money value={agreement.outstanding} /></dd></div>
        </dl>
        <div className="header-actions">
          {manage && agreement.status === "draft" ? <button className="button button--primary" onClick={() => setDialog("submit")}>Send for approval</button> : null}
          {data.can.manageDeliveries && agreement.status === "active" ? <Link className="button button--primary" href={`/trade/deliveries?plan=${agreement.id}`}><Truck /> Plan delivery</Link> : null}
          <ActionMenu label={`Actions for ${agreement.number}`} actions={[
            { label: "Propose an amendment", onClick: () => setDialog("amend"), hidden: !manage || agreement.status !== "active" },
            { label: "Link to operations", href: `/trade/linked-operations?link=${agreement.id}`, hidden: !data.can.linkOperations || agreement.status !== "active" },
            { label: "Raise invoice", href: `/trade/settlements?invoice=${agreement.id}`, hidden: !data.can.manageSettlements },
            { label: "Suspend", onClick: () => setDialog({ status: "suspended" }), hidden: !manage || agreement.status !== "active" },
            { label: "Reactivate", onClick: () => setDialog({ status: "active" }), hidden: !manage || agreement.status !== "suspended" },
            { label: "Mark completed", onClick: () => setDialog({ status: "completed" }), hidden: !manage || agreement.status !== "active" },
            { label: "Terminate", onClick: () => setDialog({ status: "terminated" }), danger: true, hidden: !manage || !["active", "suspended", "draft"].includes(agreement.status) },
          ]} />
        </div>
      </header>
      {agreement.status === "pending_approval" ? <div className="note-bar" role="status"><span>This agreement is waiting for approval. No delivery can be planned against it until it is approved.</span></div> : null}

      <section className="card register-card" aria-labelledby="commitments-title">
        <header className="trade-register__header"><h2 id="commitments-title">Fulfilment commitments</h2><span className="muted">Dispatched and received come from Mining Operations; accepted is the customer&apos;s acceptance.</span></header>
        <div className="table-wrap">
          <table className="data-table data-table--register">
            <thead><tr><th scope="col">Commitment</th><th scope="col">Due</th><th scope="col">Delivery point</th><th scope="col">Committed</th><th scope="col">Planned</th><th scope="col">Dispatched</th><th scope="col">Received</th><th scope="col">Accepted</th><th scope="col">State</th></tr></thead>
            <tbody>
              {agreement.commitments.map((item) => (
                <tr key={item.id}>
                  <td data-label="Commitment"><strong>{item.label}</strong></td>
                  <td data-label="Due">{dayLabel(item.dueDate)}</td>
                  <td data-label="Delivery point">{item.deliveryPoint}</td>
                  <td data-label="Committed">{formatTonnes(item.tonnes)}</td>
                  <td data-label="Planned">{formatTonnes(item.planned)}</td>
                  <td data-label="Dispatched">{formatTonnes(item.dispatched)}</td>
                  <td data-label="Received">{formatTonnes(item.received)}</td>
                  <td data-label="Accepted"><Progress share={item.share} label={`${formatTonnes(item.accepted)} accepted, ${Math.round(item.share * 100)}%`} /></td>
                  <td data-label="State">{{ fulfilled: <span className="trade-tag trade-tag--done">Accepted in full</span>, overdue: <span className={`trade-tag ${item.share >= 0.85 ? "trade-tag--active" : "trade-tag--critical"}`}>Short by {formatTonnes(item.tonnes - item.accepted)}</span>, unplanned: <span className="trade-tag">Not planned</span>, in_progress: <span className="trade-tag trade-tag--active">In progress</span> }[item.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="trade-detail-grid">
        <RailCard title={`Deliveries (${deliveries.length})`} action={{ label: "View all", href: `/trade/deliveries?agreement=${agreement.id}` }}>
          <RailList empty="No deliveries yet." items={[...deliveries].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)).slice(0, 6).map((item) => ({ key: item.id, icon: Truck, title: `${item.number} · ${formatTonnes(item.tonnes)}`, detail: `${dayLabel(item.scheduledDate)} · ${item.commitmentLabel}`, aside: <DeliveryStatus delivery={item} />, href: `/trade/deliveries/${item.id}` }))} />
        </RailCard>
        <RailCard title="Amendments">
          <RailList empty="No amendments." items={agreement.amendments.map((item) => ({ key: item.id, icon: RefreshCw, title: item.summary, detail: `${item.actor} · ${dayLabel(item.at)}`, aside: <span className={`trade-tag ${item.status === "approved" ? "trade-tag--done" : item.status === "rejected" ? "trade-tag--critical" : ""}`}>{{ pending: "Awaiting approval", approved: "Approved", rejected: "Rejected" }[item.status]}</span> }))} />
        </RailCard>
        <RailCard title={`Settlements (${settlements.length})`} action={{ label: "View all", href: "/trade/settlements" }}>
          <RailList empty="No invoices yet." items={[...settlements].reverse().slice(0, 5).map((item) => ({ key: item.id, icon: Wallet, title: `${item.invoiceNumber} · ${formatTonnes(item.tonnes)}`, detail: <>Due {dayLabel(item.dueDate)} · <Money value={item.balance} /> outstanding</>, aside: <SettlementStatus settlement={item} />, href: `/trade/settlements?focus=${item.id}` }))} />
        </RailCard>
        <RailCard title="Linked operations" action={data.can.linkOperations && agreement.status === "active" ? { label: "Link", href: `/trade/linked-operations?link=${agreement.id}` } : undefined}>
          <RailList empty="Not linked to Mining Operations work yet." items={links.map((item) => ({ key: item.id, icon: Link2, title: `${item.number} · ${item.workstream}`, detail: `${item.area.name}${item.shift ? ` · ${item.shift.name}` : ""}`, aside: <Readiness link={item} />, href: "/trade/linked-operations" }))} />
        </RailCard>
        <RailCard title={`Documents (${documents.length})`} action={{ label: "Documents", href: "/trade/documents" }}>
          <RailList empty={data.can.pricing ? "No documents filed." : "No documents you can see. Agreement documents are confidential."} items={documents.map((item) => ({ key: item.id, icon: FileText, title: item.name, detail: item.kind, aside: <DocumentStatus document={item} /> }))} />
        </RailCard>
        <RailCard title="History">
          <ol className="trade-history">{[...agreement.history].reverse().slice(0, 8).map((item) => <li key={item.id}><strong>{item.summary}</strong><small>{item.actor} · {dateTimeLabel(item.at)}</small>{item.note ? <p>{item.note}</p> : null}</li>)}</ol>
        </RailCard>
      </div>

      {dialog === "amend" ? <AmendDialog agreement={agreement} today={data.today} onClose={() => setDialog(null)} /> : null}
      {dialog === "submit" ? <SubmitDialog agreement={agreement} onClose={() => setDialog(null)} /> : null}
      {dialog && typeof dialog === "object" ? <AgreementStatusDialog agreement={agreement} status={dialog.status} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function SubmitDialog({ agreement, onClose }: { agreement: AgreementRow; onClose: () => void }) {
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/agreements/${agreement.id}/submit`, success: () => ({ title: "Sent for approval", detail: "The Mine Manager has been notified." }), onDone: onClose });
  return (
    <Dialog title={`Send ${agreement.number} for approval?`} size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending} onClick={() => save.mutate({ version: agreement.version })}>{save.isPending ? "Sending…" : "Send for approval"}</button></>}>
      <p>{agreement.commitments.length} commitment{agreement.commitments.length === 1 ? "" : "s"} totalling {formatTonnes(agreement.committed)}. The agreement becomes active only when the Mine Manager approves it.</p>
    </Dialog>
  );
}

function AgreementStatusDialog({ agreement, status, onClose }: { agreement: AgreementRow; status: string; onClose: () => void }) {
  const [note, setNote] = useState("");
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/agreements/${agreement.id}/status`, success: () => ({ title: "Agreement updated" }), onDone: onClose });
  const needsReason = status === "suspended" || status === "terminated";
  const verb = { suspended: "Suspend", active: "Reactivate", completed: "Mark completed", terminated: "Terminate" }[status] ?? "Update";
  return (
    <Dialog title={`${verb} ${agreement.number}?`} size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className={`button ${status === "terminated" ? "button--danger" : "button--primary"}`} disabled={save.isPending || (needsReason && note.trim().length < 5)} onClick={() => save.mutate({ status, note, version: agreement.version })}>{save.isPending ? "Saving…" : verb}</button></>}>
      {status === "completed" ? <p>An agreement is complete only when the customer has accepted every commitment in full. Uploaded proof of delivery does not count as acceptance.</p> : null}
      <Field label={needsReason ? "Why? (required)" : "Note (optional)"}><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </Dialog>
  );
}

function AmendDialog({ agreement, today, onClose }: { agreement: AgreementRow; today: string; onClose: () => void }) {
  const submission = useSubmissionId();
  const [kind, setKind] = useState<"add_commitment" | "extend_end">("add_commitment");
  const [form, setForm] = useState({ label: "", tonnes: "", dueDate: addDays(today, 30), deliveryPoint: agreement.commitments.at(-1)?.deliveryPoint ?? "", endDate: addDays(agreement.endDate, 90), note: "" });
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/agreements/${agreement.id}/amendments`, success: () => ({ title: "Amendment sent for approval", detail: "Nothing changes until it is approved." }), onDone: onClose });
  const valid = kind === "extend_end" ? form.endDate > agreement.endDate : form.label.trim().length >= 2 && Number(form.tonnes) > 0 && form.deliveryPoint.trim().length >= 3;
  return (
    <Dialog title={`Amend ${agreement.number}`} description="An amendment goes to the Mine Manager for approval before it changes the agreement." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending || !valid} onClick={() => save.mutate({ kind, ...form, tonnes: Number(form.tonnes), version: agreement.version, submissionId: submission.id })}>{save.isPending ? "Sending…" : "Send for approval"}</button></>}>
      <fieldset className="segmented-fieldset">
        <legend>Change</legend>
        <label><input type="radio" name="kind" checked={kind === "add_commitment"} onChange={() => setKind("add_commitment")} /> Add a commitment</label>
        <label><input type="radio" name="kind" checked={kind === "extend_end"} onChange={() => setKind("extend_end")} /> Extend the end date</label>
      </fieldset>
      {kind === "add_commitment" ? (
        <div className="form-grid">
          <Field label="Commitment name"><input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="May 2025 extra" /></Field>
          <Field label="Quantity (t)"><input inputMode="decimal" value={form.tonnes} onChange={(event) => setForm({ ...form, tonnes: event.target.value })} /></Field>
          <Field label="Due date"><input type="date" min={today} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
          <Field label="Delivery point"><input value={form.deliveryPoint} onChange={(event) => setForm({ ...form, deliveryPoint: event.target.value })} /></Field>
        </div>
      ) : (
        <Field label="New end date"><input type="date" min={addDays(agreement.endDate, 1)} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
      )}
      <Field label="Reason (optional)"><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
    </Dialog>
  );
}

// ---- New agreement ---------------------------------------------------------------------------------------------------------

export function NewAgreementScreen() {
  return <TradeData label="Loading">{(data) => <NewAgreement data={data} />}</TradeData>;
}

type CommitmentDraft = { key: number; label: string; tonnes: string; dueDate: string; deliveryPoint: string };

function NewAgreement({ data }: { data: TradeView }) {
  const router = useRouter();
  const params = useSearchParams();
  const submission = useSubmissionId();
  const enquiry = data.enquiries.find((item) => item.id === params.get("enquiry") && item.stage === "won" && !item.agreementId);
  const [form, setForm] = useState({
    clientId: enquiry?.clientId ?? params.get("client") ?? "", enquiryId: enquiry?.id ?? "", commodity: (enquiry?.commodity ?? COMMODITIES[0]) as string,
    title: enquiry ? `${enquiry.commodity} supply` : "", startDate: addDays(data.today, 7), endDate: addDays(data.today, 372), pricePerTonne: enquiry?.pricePerTonne ? String(enquiry.pricePerTonne) : "",
    incoterm: "FCA Riverside Mine", paymentTermsDays: "30",
  });
  const [commitments, setCommitments] = useState<CommitmentDraft[]>([{ key: 1, label: "", tonnes: "", dueDate: addDays(data.today, 37), deliveryPoint: "Riverside Mine loading bay" }]);
  const [error, setError] = useState<string | null>(null);
  const save = useTradeAction<Record<string, unknown>, { id: string; number: string }>({ path: "/trade/agreements", success: (result) => ({ title: `${result.number} drafted`, detail: "Send it for approval when the terms are final." }), onDone: (result) => router.push(`/trade/agreements/${result.id}`) });
  const wonEnquiries = data.enquiries.filter((item) => item.stage === "won" && !item.agreementId);
  const total = commitments.reduce((sum, item) => sum + (Number(item.tonnes) || 0), 0);

  if (!data.can.manageAgreements) return <div className="workspace-page"><Crumbs items={[{ label: "Agreements", href: "/trade/agreements" }, { label: "New agreement" }]} /><EmptyState title="Agreements are drafted by the commercial team" description="The Mine Manager or the Commercial / Finance Officer can draft agreements." /></div>;

  const submit = () => {
    if (!form.clientId) return setError("Choose the client.");
    if (form.title.trim().length < 3) return setError("Give the agreement a title.");
    if (!(Number(form.pricePerTonne) > 0)) return setError("Enter the price per tonne.");
    if (form.endDate <= form.startDate) return setError("The end date must be after the start date.");
    const bad = commitments.findIndex((item) => item.label.trim().length < 2 || !(Number(item.tonnes) > 0) || item.deliveryPoint.trim().length < 3 || item.dueDate < form.startDate || item.dueDate > form.endDate);
    if (bad >= 0) return setError(`Commitment ${bad + 1} needs a name, a quantity, a delivery point and a due date within the agreement dates.`);
    setError(null);
    save.mutate({ ...form, enquiryId: form.enquiryId || undefined, pricePerTonne: Number(form.pricePerTonne), paymentTermsDays: Number(form.paymentTermsDays), commitments: commitments.map((item) => ({ ...item, tonnes: Number(item.tonnes) })), submissionId: submission.id });
  };
  const monthly = () => {
    const start = new Date(`${form.startDate}T12:00:00Z`);
    const drafts: CommitmentDraft[] = [];
    for (let index = 0; index < 12; index += 1) {
      const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index + 1, 0)).toISOString().slice(0, 10);
      if (due > form.endDate) break;
      drafts.push({ key: index + 1, label: `${new Date(`${due}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })} tranche`, tonnes: commitments[0]?.tonnes ?? "", dueDate: due, deliveryPoint: commitments[0]?.deliveryPoint ?? "" });
    }
    if (drafts.length) setCommitments(drafts);
  };

  return (
    <div className="workspace-page trade-page">
      <Crumbs items={[{ label: "Agreements", href: "/trade/agreements" }, { label: "New agreement" }]} />
      <TradeHeader title="New agreement" description="The terms and the fulfilment commitments: what will be delivered, when and where. It starts as a draft." icon={FileText} />
      {error ? <div className="note-bar note-bar--warn" role="alert"><span>{error}</span></div> : null}
      <section className="card trade-form-card">
        <div className="form-grid">
          <Field label="From a won enquiry" hint="Optional. Links the enquiry so it cannot produce a second agreement.">
            <Select value={form.enquiryId} onChange={(event) => { const picked = wonEnquiries.find((item) => item.id === event.target.value); setForm({ ...form, enquiryId: event.target.value, ...(picked ? { clientId: picked.clientId, commodity: picked.commodity, pricePerTonne: picked.pricePerTonne ? String(picked.pricePerTonne) : form.pricePerTonne } : {}) }); }}>
              <option value="">None</option>
              {wonEnquiries.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.clientName}</option>)}
            </Select>
          </Field>
          <Field label="Client"><Select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Choose a client</option>{data.clients.filter((item) => item.status !== "inactive").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="Commodity"><Select value={form.commodity} onChange={(event) => setForm({ ...form, commodity: event.target.value })}>{COMMODITIES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
          <Field label="Start date"><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          <Field label="End date"><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
          <Field label="Price per tonne (R)"><input inputMode="decimal" value={form.pricePerTonne} onChange={(event) => setForm({ ...form, pricePerTonne: event.target.value })} /></Field>
          <Field label="Delivery terms"><input value={form.incoterm} onChange={(event) => setForm({ ...form, incoterm: event.target.value })} /></Field>
          <Field label="Payment terms (days)"><input inputMode="numeric" value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })} /></Field>
        </div>
      </section>
      <section className="card trade-form-card" aria-labelledby="commitments-heading">
        <header className="trade-register__header"><h2 id="commitments-heading">Fulfilment commitments</h2><span className="muted">{commitments.length} · {formatTonnes(total)}{Number(form.pricePerTonne) > 0 ? ` · ${formatRand(total * Number(form.pricePerTonne))}` : ""}</span></header>
        <ol className="trade-commitment-rows">
          {commitments.map((item, index) => (
            <li key={item.key}>
              <Field label={`Commitment ${index + 1} name`}><input value={item.label} onChange={(event) => setCommitments(commitments.map((row) => (row.key === item.key ? { ...row, label: event.target.value } : row)))} placeholder="Jun 2025 tranche" /></Field>
              <Field label="Quantity (t)"><input inputMode="decimal" value={item.tonnes} onChange={(event) => setCommitments(commitments.map((row) => (row.key === item.key ? { ...row, tonnes: event.target.value } : row)))} /></Field>
              <Field label="Due date"><input type="date" value={item.dueDate} onChange={(event) => setCommitments(commitments.map((row) => (row.key === item.key ? { ...row, dueDate: event.target.value } : row)))} /></Field>
              <Field label="Delivery point"><input value={item.deliveryPoint} onChange={(event) => setCommitments(commitments.map((row) => (row.key === item.key ? { ...row, deliveryPoint: event.target.value } : row)))} /></Field>
              <button className="icon-button icon-button--light" aria-label={`Remove commitment ${index + 1}`} disabled={commitments.length === 1} onClick={() => setCommitments(commitments.filter((row) => row.key !== item.key))}><Trash2 /></button>
            </li>
          ))}
        </ol>
        <div className="button-row">
          <button className="button button--quiet" onClick={() => setCommitments([...commitments, { key: Math.max(...commitments.map((row) => row.key)) + 1, label: "", tonnes: "", dueDate: commitments.at(-1)?.dueDate ?? form.startDate, deliveryPoint: commitments.at(-1)?.deliveryPoint ?? "" }])}><Plus /> Add commitment</button>
          <button className="button button--quiet" onClick={monthly}>Make monthly tranches</button>
        </div>
      </section>
      <div className="button-row button-row--end">
        <Link className="button button--quiet" href="/trade/agreements">Cancel</Link>
        <button className="button button--primary" onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save draft"}</button>
      </div>
    </div>
  );
}
