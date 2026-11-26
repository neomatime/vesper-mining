"use client";

/**
 * Deliveries: commercial delivery commitments, planned against an agreement's commitment. Dispatched and received tonnes are read from
 * the linked Mining Operations shipment (Trade never records a dispatch); the customer's acceptance, any discrepancy and the invoice are
 * Trade's. Proof of delivery is evidence only.
 */
import { ArrowLeft, ArrowRight, Boxes, CalendarDays, CircleCheck, CircleDot, Circle, Download, FileText, Layers, Link2, PackageCheck, Target, TriangleAlert, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { addDays, deliveryStageLabels, formatTonnes } from "@/lib/trade-rules";
import { Dialog } from "../dialog";
import { Field } from "../form-field";
import { EmptyState } from "../query-state";
import { Select } from "../select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type DeliveryRow, type TradeView } from "../use-trade";
import { DeliveryStatus, DocumentStatus, SettlementStatus } from "./trade-status";
import { UploadDialog } from "./trade-upload";
import { ActionMenu, CellMain, Crumbs, dateTimeLabel, dayLabel, Donut, exportCsv, KpiTiles, Money, Progress, RailCard, RailList, Register, TabBar, TradeData, TradeHeader, ViewLink } from "./trade-ui";
import { Busy } from "../busy";

export function DeliveriesScreen() {
  return <TradeData label="Loading deliveries">{(data) => <Deliveries data={data} />}</TradeData>;
}

function onTime(item: DeliveryRow) {
  const received = item.shipment?.receivedAt ?? item.operations?.receivedAt ?? null;
  return received ? received.slice(0, 10) <= addDays(item.scheduledDate, 1) : null;
}

function Deliveries({ data }: { data: TradeView }) {
  const params = useSearchParams();
  const [planning, setPlanning] = useState<string | null>(params.get("plan"));
  const [agreement, setAgreement] = useState(params.get("agreement") ?? "");
  const rows = data.deliveries;
  const year = rows.filter((item) => item.scheduledDate.startsWith(data.today.slice(0, 4)) && item.stage !== "cancelled");
  const finished = rows.filter((item) => onTime(item) !== null);
  const punctual = finished.filter((item) => onTime(item)).length;
  const upcoming = rows.filter((item) => item.stage === "planned" && item.scheduledDate >= data.today).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 4);
  const alerts = rows.filter((item) => item.timing || item.stage === "disputed" || item.stage === "received");

  return (
    <div className="workspace-page trade-page">
      <TradeHeader title="Deliveries" description="Delivery commitments against agreements: schedule, progress, customer acceptance and discrepancies." icon={Truck}
        actions={<>
          <button className="button button--quiet" onClick={() => exportCsv("deliveries.csv", ["Delivery", "Agreement", "Client", "Commodity", "Planned t", "Dispatched t", "Received t", "Accepted t", "Status", "Scheduled"], rows.map((item) => [item.number, item.agreementNumber, data.clients.find((c) => c.id === item.clientId)?.name ?? "", item.commodity, item.tonnes, item.quantities.dispatched, item.quantities.received, item.quantities.accepted, deliveryStageLabels[item.stage], item.scheduledDate]))}><Download /> Export</button>
          {data.can.manageDeliveries ? <button className="button button--primary" onClick={() => setPlanning("")}><Truck /> New delivery</button> : null}
        </>} />
      <KpiTiles items={[
        { label: `Deliveries (${data.today.slice(0, 4)})`, value: year.length, hint: `${rows.filter((item) => item.stage === "planned").length} planned`, icon: Truck },
        { label: "Accepted volume", value: formatTonnes(year.reduce((total, item) => total + item.quantities.accepted, 0)), hint: "Customer-accepted this year", icon: Boxes },
        { label: "On-time delivery", value: finished.length ? `${Math.round((punctual / finished.length) * 100)}%` : "—", hint: "Received by the day after schedule", icon: Target },
        { label: "In transit", value: rows.filter((item) => item.stage === "in_transit").length, hint: "Dispatched, not received", icon: CalendarDays },
        { label: "Late or at risk", value: rows.filter((item) => item.timing).length, hint: `${rows.filter((item) => item.stage === "received").length} awaiting acceptance`, icon: TriangleAlert, tone: rows.some((item) => item.timing === "late") ? "critical" : undefined },
      ]} />
      <div className="trade-layout">
        <Register<DeliveryRow>
          title="Deliveries"
          noun="deliveries"
          rows={rows}
          searchLabel="Search deliveries by reference, agreement, customer or commodity"
          search={(row) => [row.number, row.agreementNumber, data.clients.find((c) => c.id === row.clientId)?.name, row.commodity, row.shipment?.number].join(" ")}
          href={(row) => `/trade/deliveries/${row.id}`}
          chips={[
            { key: "planned", label: "Planned", test: (row) => row.stage === "planned" },
            { key: "in_transit", label: "In transit", test: (row) => row.stage === "in_transit" },
            { key: "received", label: "Awaiting acceptance", test: (row) => row.stage === "received" },
            { key: "accepted", label: "Accepted", test: (row) => row.stage === "accepted" },
            { key: "risk", label: "Late or at risk", test: (row) => Boolean(row.timing) || row.stage === "disputed" },
            { key: "cancelled", label: "Cancelled", test: (row) => row.stage === "cancelled" },
          ]}
          extra={{
            controls: <label className="trade-select"><span className="sr-only">Agreement</span><Select value={agreement} onChange={(event) => setAgreement(event.target.value)}><option value="">All agreements</option>{data.agreements.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.clientName}</option>)}</Select></label>,
            test: (row) => !agreement || row.agreementId === agreement,
            active: Boolean(agreement),
            clear: () => setAgreement(""),
          }}
          initialSort={{ key: "date", direction: "desc" }}
          columns={[
            { key: "ref", label: "Delivery", sort: (row) => row.number, render: (row) => <CellMain title={row.number} detail={row.shipment ? `Shipment ${row.shipment.number}` : row.commitmentLabel} /> },
            { key: "agreement", label: "Agreement", sort: (row) => row.agreementNumber, render: (row) => <CellMain title={row.agreementNumber} detail={row.commodity} /> },
            { key: "customer", label: "Customer", sort: (row) => data.clients.find((c) => c.id === row.clientId)?.name ?? "", render: (row) => data.clients.find((c) => c.id === row.clientId)?.name },
            { key: "volume", label: "Planned", sort: (row) => row.tonnes, render: (row) => formatTonnes(row.tonnes) },
            { key: "status", label: "Status", sort: (row) => row.stage, render: (row) => <DeliveryStatus delivery={row} /> },
            { key: "date", label: "Scheduled", sort: (row) => row.scheduledDate, render: (row) => dayLabel(row.scheduledDate) },
            { key: "progress", label: "Accepted", sort: (row) => (row.tonnes ? row.quantities.accepted / row.tonnes : 0), render: (row) => (row.stage === "cancelled" ? <span className="muted">—</span> : <Progress share={row.tonnes ? row.quantities.accepted / row.tonnes : 0} label={`${formatTonnes(row.quantities.accepted)} of ${formatTonnes(row.tonnes)} accepted`} />) },
          ]}
          actions={(row) => <ViewLink href={`/trade/deliveries/${row.id}`} name={row.number} />}
          empty={{ title: "No deliveries yet", body: "Plan a delivery against an active agreement's commitment." }}
        />
        <aside className="trade-rail" aria-label="Delivery insights">
          <RailCard title="Delivery performance">
            <Donut label="Delivery performance" centre={finished.length ? `${Math.round((punctual / finished.length) * 100)}%` : "—"} caption="On time" segments={[
              { label: "On time", value: punctual, tone: "positive", display: finished.length ? `${Math.round((punctual / finished.length) * 100)}%` : "—" },
              { label: "Late", value: finished.length - punctual, tone: "warning", display: finished.length ? `${Math.round(((finished.length - punctual) / finished.length) * 100)}%` : "—" },
            ]} />
            <p className="muted trade-small">Of {finished.length} received deliveries. {rows.filter((item) => item.stage === "cancelled").length} cancelled before dispatch.</p>
          </RailCard>
          <RailCard title="Upcoming deliveries">
            <RailList empty="Nothing planned." items={upcoming.map((item) => ({ key: item.id, icon: CalendarDays, title: `${item.number} – ${formatTonnes(item.tonnes)} (${item.commodity})`, detail: dayLabel(item.scheduledDate), href: `/trade/deliveries/${item.id}` }))} />
          </RailCard>
          <RailCard title="Alerts">
            <RailList empty="No delivery needs attention." items={alerts.slice(0, 5).map((item) => ({ key: item.id, icon: TriangleAlert, tone: item.timing === "late" || item.stage === "disputed" ? "critical" as const : "attention" as const, title: item.timing === "late" ? `${item.number} is late` : item.stage === "disputed" ? `${item.number} has a discrepancy` : item.stage === "received" ? `${item.number} awaits customer acceptance` : `${item.number} is due within 2 days and not dispatched`, href: `/trade/deliveries/${item.id}` }))} />
          </RailCard>
        </aside>
      </div>
      {planning !== null ? <PlanDeliveryDialog data={data} agreementId={planning} onClose={() => setPlanning(null)} /> : null}
    </div>
  );
}

function PlanDeliveryDialog({ data, agreementId, onClose }: { data: TradeView; agreementId: string; onClose: () => void }) {
  const submission = useSubmissionId();
  const active = data.agreements.filter((item) => item.status === "active");
  const [form, setForm] = useState({ agreementId: active.some((item) => item.id === agreementId) ? agreementId : "", commitmentId: "", tonnes: "", scheduledDate: addDays(data.today, 3), shipmentId: "", destination: "" });
  const [error, setError] = useState<string | null>(null);
  const save = useTradeAction<Record<string, unknown>>({ path: "/trade/deliveries", success: () => ({ title: "Delivery planned", detail: "Mining Operations prepares and dispatches the load." }), onDone: onClose });
  const agreement = active.find((item) => item.id === form.agreementId);
  const open = agreement?.commitments.filter((item) => item.state !== "fulfilled") ?? [];
  const commitment = open.find((item) => item.id === form.commitmentId);
  const taken = new Set(data.deliveries.filter((item) => item.shipmentId && item.stage !== "cancelled").map((item) => item.shipmentId));
  const shipments = data.mining.shipments.filter((item) => !taken.has(item.id) && item.state !== "cancelled");
  const submit = () => {
    if (!agreement) return setError("Choose an active agreement.");
    if (!commitment) return setError("Choose the commitment this delivery fulfils.");
    if (!(Number(form.tonnes) > 0)) return setError("Enter the planned tonnes.");
    if (form.scheduledDate < data.today) return setError("Choose a date from today onwards.");
    setError(null);
    save.mutate({ ...form, tonnes: Number(form.tonnes), shipmentId: form.shipmentId || null, submissionId: submission.id });
  };
  return (
    <Dialog title="Plan a delivery" description="Against one commitment of an active agreement." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" onClick={submit} disabled={save.isPending}><Busy pending={save.isPending} label="Saving…">Plan delivery</Busy></button></>}>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="form-grid">
        <Field label="Agreement"><Select value={form.agreementId} onChange={(event) => setForm({ ...form, agreementId: event.target.value, commitmentId: "" })}><option value="">Choose an agreement</option>{active.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.clientName}</option>)}</Select></Field>
        <Field label="Commitment"><Select value={form.commitmentId} onChange={(event) => { const picked = open.find((item) => item.id === event.target.value); setForm({ ...form, commitmentId: event.target.value, tonnes: picked ? String(Math.max(0, picked.tonnes - picked.planned)) : form.tonnes, destination: picked?.deliveryPoint ?? "" }); }}><option value="">Choose a commitment</option>{open.map((item) => <option key={item.id} value={item.id}>{item.label} · {formatTonnes(item.tonnes - item.planned)} unplanned</option>)}</Select></Field>
        <Field label="Planned quantity (t)" hint={commitment ? `${formatTonnes(commitment.planned)} of ${formatTonnes(commitment.tonnes)} already planned` : undefined}><input inputMode="decimal" value={form.tonnes} onChange={(event) => setForm({ ...form, tonnes: event.target.value })} /></Field>
        <Field label="Scheduled date"><input type="date" min={data.today} value={form.scheduledDate} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value })} /></Field>
        <Field label="Destination"><input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} /></Field>
        <Field label="Mining Operations shipment" hint="Optional. Link the shipment that will carry this load."><Select value={form.shipmentId} onChange={(event) => setForm({ ...form, shipmentId: event.target.value })}><option value="">Not linked yet</option>{shipments.map((item) => <option key={item.id} value={item.id}>{item.number} · {formatTonnes(item.tonnes)} · {item.state}</option>)}</Select></Field>
      </div>
    </Dialog>
  );
}

// ---- Delivery detail -------------------------------------------------------------------------------------------------------

type DeliveryTab = "overview" | "evidence" | "operations" | "financials" | "history";

export function DeliveryScreen({ id }: { id: string }) {
  return <TradeData label="Loading the delivery" variant="detail">{(data) => {
    const delivery = data.deliveries.find((item) => item.id === id);
    if (!delivery) return <div className="workspace-page"><Crumbs items={[{ label: "Deliveries", href: "/trade/deliveries" }, { label: "Not found" }]} /><EmptyState title="This delivery could not be found" description="The link may be wrong." /></div>;
    return <DeliveryDetail data={data} delivery={delivery} />;
  }}</TradeData>;
}

function DeliveryDetail({ data, delivery }: { data: TradeView; delivery: DeliveryRow }) {
  const [tab, setTab] = useState<DeliveryTab>("overview");
  const [dialog, setDialog] = useState<null | "accept" | "discrepancy" | "resolve" | "reschedule" | "cancel" | "link" | "upload">(null);
  const agreement = data.agreements.find((item) => item.id === delivery.agreementId)!;
  const client = data.clients.find((item) => item.id === delivery.clientId);
  const ordered = [...data.deliveries].sort((a, b) => a.number.localeCompare(b.number));
  const index = ordered.findIndex((item) => item.id === delivery.id);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  const settlement = data.settlements.find((item) => item.deliveryIds.includes(delivery.id));
  const q = delivery.quantities;
  const closed = delivery.stage === "cancelled";
  const milestones = [
    { label: "Planned", done: true, when: delivery.history[0]?.at ?? null },
    { label: "Dispatched", done: q.dispatched > 0, when: delivery.shipment?.dispatchedAt ?? delivery.operations?.dispatchedAt ?? null },
    { label: "Received", done: q.received > 0, when: delivery.shipment?.receivedAt ?? delivery.operations?.receivedAt ?? null },
    { label: "Accepted", done: Boolean(delivery.acceptance), when: delivery.acceptance?.at ?? null },
    { label: "Invoiced", done: Boolean(settlement), when: settlement ? `${settlement.issuedAt}T12:00:00+02:00` : null },
  ];

  return (
    <div className="workspace-page trade-page">
      <Crumbs items={[{ label: "Deliveries", href: "/trade/deliveries" }, { label: delivery.number }]} />
      <header className="trade-detail-head">
        <span className="trade-detail-head__mark" aria-hidden="true"><Truck /></span>
        <div className="trade-detail-head__copy">
          <h1>{delivery.number} <DeliveryStatus delivery={delivery} /></h1>
          <p>{delivery.commodity} for {client?.name} ({agreement.number}) · {delivery.commitmentLabel}</p>
        </div>
        <div className="header-actions">
          {previous ? <Link className="icon-button icon-button--light" href={`/trade/deliveries/${previous.id}`} aria-label={`Previous delivery ${previous.number}`}><ArrowLeft /></Link> : null}
          {next ? <Link className="icon-button icon-button--light" href={`/trade/deliveries/${next.id}`} aria-label={`Next delivery ${next.number}`}><ArrowRight /></Link> : null}
          {data.can.recordAcceptance && !closed && !delivery.acceptance && q.received > 0 ? <button className="button button--primary" onClick={() => setDialog("accept")}><PackageCheck /> Record acceptance</button> : null}
          <ActionMenu label={`Actions for ${delivery.number}`} actions={[
            { label: "Upload evidence", onClick: () => setDialog("upload"), hidden: !data.can.uploadDocuments || closed },
            { label: "Reschedule", onClick: () => setDialog("reschedule"), hidden: !data.can.manageDeliveries || closed || Boolean(delivery.acceptance) },
            { label: "Link Mining Operations shipment", onClick: () => setDialog("link"), hidden: !data.can.manageDeliveries || closed || Boolean(delivery.shipmentId) },
            { label: "Raise discrepancy", onClick: () => setDialog("discrepancy"), hidden: !data.can.manageDeliveries || closed || Boolean(delivery.discrepancy && !delivery.discrepancy.resolution) },
            { label: "Resolve discrepancy", onClick: () => setDialog("resolve"), hidden: !data.can.recordAcceptance || !delivery.discrepancy || Boolean(delivery.discrepancy.resolution) },
            { label: "Cancel delivery", onClick: () => setDialog("cancel"), danger: true, hidden: !data.can.manageDeliveries || closed || q.dispatched > 0 },
          ]} />
        </div>
      </header>

      <section className="trade-fact-strip" aria-label="Delivery summary">
        <div><FileText aria-hidden="true" /><span>Agreement</span><Link className="row-link-text" href={`/trade/agreements/${agreement.id}`}>{agreement.number}</Link></div>
        <div><Layers aria-hidden="true" /><span>Customer</span><strong>{client?.name}</strong></div>
        <div><Boxes aria-hidden="true" /><span>Commodity</span><strong>{delivery.commodity}</strong></div>
        <div><Truck aria-hidden="true" /><span>Planned</span><strong>{formatTonnes(delivery.tonnes)}</strong></div>
        <div><Wallet aria-hidden="true" /><span>Value</span><strong><Money value={delivery.value} /></strong></div>
      </section>
      {delivery.cancelled ? <div className="note-bar" role="status"><span>Cancelled: {delivery.cancelled.reason}</span></div> : null}
      {delivery.discrepancy && !delivery.discrepancy.resolution ? <div className="note-bar note-bar--warn" role="status"><span>Discrepancy: {delivery.discrepancy.reason} ({formatTonnes(delivery.discrepancy.tonnes)})</span></div> : null}

      <TabBar<DeliveryTab> label="Delivery sections" active={tab} onChange={setTab} tabs={[
        { key: "overview", label: "Overview" },
        { key: "evidence", label: "Documents", count: delivery.documents.length },
        { key: "operations", label: "Operational references" },
        { key: "financials", label: "Financials" },
        { key: "history", label: "Updates", count: delivery.history.length },
      ]} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" ? (
          <div className="trade-detail-grid">
            <RailCard title="Delivery progress">
              <ol className="trade-milestones">
                {milestones.map((item, position) => {
                  const current = !item.done && (position === 0 || milestones[position - 1].done);
                  return (
                    <li key={item.label} className={item.done ? "is-done" : current && !closed ? "is-current" : ""}>
                      {item.done ? <CircleCheck aria-hidden="true" /> : current && !closed ? <CircleDot aria-hidden="true" /> : <Circle aria-hidden="true" />}
                      <strong>{item.label}</strong>
                      <small>{item.when ? dayLabel(item.when) : item.done ? "" : "Not yet"}</small>
                    </li>
                  );
                })}
              </ol>
            </RailCard>
            <RailCard title="Quantity reconciliation">
              <p className="muted trade-small">Each quantity comes from its own record. Accepted is what the customer accepted; only accepted tonnes are invoiced.</p>
              <dl className="trade-reconcile">
                <div><dt>Planned</dt><dd>{formatTonnes(q.planned)}</dd><small>Trade plan</small></div>
                <div><dt>Dispatched</dt><dd>{formatTonnes(q.dispatched)}</dd><small>{q.source}</small></div>
                <div><dt>Received</dt><dd>{formatTonnes(q.received)}</dd><small>{q.source}</small></div>
                <div><dt>Accepted</dt><dd>{formatTonnes(q.accepted)}</dd><small>{delivery.acceptance ? `${delivery.acceptance.by}, ${dayLabel(delivery.acceptance.at)}` : "Not recorded"}</small></div>
                <div><dt>Invoiced</dt><dd>{settlement ? formatTonnes(settlement.tonnes) : "0 t"}</dd><small>{settlement ? settlement.invoiceNumber : "Not invoiced"}</small></div>
              </dl>
              {q.received > q.accepted && delivery.acceptance ? <p className="trade-small">Difference received – accepted: {formatTonnes(q.received - q.accepted)}.</p> : null}
            </RailCard>
            <RailCard title="Delivery details">
              <dl className="trade-definitions">
                <div><dt>Delivery reference</dt><dd>{delivery.number}</dd></div>
                <div><dt>Commitment</dt><dd>{delivery.commitmentLabel}</dd></div>
                <div><dt>Scheduled date</dt><dd>{dayLabel(delivery.scheduledDate)}</dd></div>
                <div><dt>Destination</dt><dd>{delivery.destination}</dd></div>
                <div><dt>Transport</dt><dd>{delivery.shipment?.transporter ?? "Arranged by Mining Operations"}</dd></div>
                <div><dt>Status</dt><dd><DeliveryStatus delivery={delivery} /></dd></div>
              </dl>
            </RailCard>
          </div>
        ) : null}
        {tab === "evidence" ? (
          <RailCard title="Delivery evidence" action={data.can.uploadDocuments && !closed ? { label: "Upload evidence", onClick: () => setDialog("upload") } : undefined}>
            <p className="muted trade-small">Proof of delivery, weighbridge tickets and quality certificates are evidence. Uploading them does not record acceptance or fulfil the agreement.</p>
            <RailList empty="No documents yet." items={delivery.documents.map((item) => {
              const full = data.documents.find((doc) => doc.id === item.id);
              return { key: item.id, icon: FileText, title: item.name, detail: full ? `${item.kind} · ${full.uploadedBy} · ${dayLabel(full.uploadedAt)}` : item.kind, aside: full ? <DocumentStatus document={full} /> : undefined };
            })} />
          </RailCard>
        ) : null}
        {tab === "operations" ? (
          <RailCard title="Mining Operations shipment" action={!delivery.shipmentId && data.can.manageDeliveries && !closed ? { label: "Link shipment", onClick: () => setDialog("link") } : undefined}>
            {delivery.shipment ? (
              <dl className="trade-definitions">
                <div><dt>Shipment</dt><dd><Link className="row-link-text" href={`/shipments/${delivery.shipment.id}`}>{delivery.shipment.number} <Link2 aria-hidden="true" /></Link></dd></div>
                <div><dt>State in Mining Operations</dt><dd>{delivery.shipment.state.replace("_", " ")}</dd></div>
                <div><dt>Allocated</dt><dd>{formatTonnes(delivery.shipment.tonnes)}</dd></div>
                <div><dt>Dispatched</dt><dd>{formatTonnes(delivery.shipment.dispatched)}{delivery.shipment.dispatchedAt ? ` · ${dateTimeLabel(delivery.shipment.dispatchedAt)}` : ""}</dd></div>
                <div><dt>Received</dt><dd>{formatTonnes(delivery.shipment.received)}{delivery.shipment.receivedAt ? ` · ${dateTimeLabel(delivery.shipment.receivedAt)}` : ""}</dd></div>
                <div><dt>Transport</dt><dd>{delivery.shipment.transporter ?? "Not arranged"}</dd></div>
              </dl>
            ) : delivery.operations ? (
              <p>{delivery.operations.source}: {formatTonnes(delivery.operations.dispatched)} dispatched{delivery.operations.received ? `, ${formatTonnes(delivery.operations.received)} received` : ""}.</p>
            ) : <p className="muted">Not linked to a Mining Operations shipment yet. Dispatch and receipt appear here once it is.</p>}
            <p className="muted trade-small">Opening the shipment takes you to Mining Operations, which owns loading and dispatch.</p>
          </RailCard>
        ) : null}
        {tab === "financials" ? (
          <RailCard title="Financials">
            <dl className="trade-definitions">
              <div><dt>Delivery value (planned)</dt><dd><Money value={delivery.value} /></dd></div>
              <div><dt>Invoice</dt><dd>{settlement ? <Link className="row-link-text" href={`/trade/settlements?focus=${settlement.id}`}>{settlement.invoiceNumber}</Link> : delivery.acceptance ? "Ready to invoice" : "Invoiced after acceptance"}</dd></div>
              <div><dt>Invoiced amount</dt><dd>{settlement ? <Money value={settlement.amount} /> : "—"}</dd></div>
              <div><dt>Settlement</dt><dd>{settlement ? <SettlementStatus settlement={settlement} /> : "—"}</dd></div>
            </dl>
          </RailCard>
        ) : null}
        {tab === "history" ? (
          <RailCard title="Updates">
            <ol className="trade-history">{[...delivery.history].reverse().map((item) => <li key={item.id}><strong>{item.summary}</strong><small>{item.actor} · {dateTimeLabel(item.at)}</small>{item.note ? <p>{item.note}</p> : null}</li>)}</ol>
          </RailCard>
        ) : null}
      </div>

      {dialog === "accept" ? <AcceptanceDialog delivery={delivery} onClose={() => setDialog(null)} /> : null}
      {dialog === "discrepancy" ? <ReasonDialog title={`Raise a discrepancy on ${delivery.number}`} path={`/trade/deliveries/${delivery.id}/discrepancy`} field="reason" withTonnes label="What is wrong?" confirm="Raise discrepancy" success="Discrepancy raised" onClose={() => setDialog(null)} /> : null}
      {dialog === "resolve" ? <ReasonDialog title="Resolve the discrepancy" path={`/trade/deliveries/${delivery.id}/discrepancy/resolve`} field="resolution" label="How was it resolved?" confirm="Resolve" success="Discrepancy resolved" onClose={() => setDialog(null)} /> : null}
      {dialog === "cancel" ? <ReasonDialog title={`Cancel ${delivery.number}?`} path={`/trade/deliveries/${delivery.id}/cancel`} field="note" label="Why? (required)" confirm="Cancel delivery" danger success="Delivery cancelled" version={delivery.version} onClose={() => setDialog(null)} /> : null}
      {dialog === "reschedule" ? <RescheduleDialog delivery={delivery} today={data.today} onClose={() => setDialog(null)} /> : null}
      {dialog === "link" ? <LinkShipmentDialog data={data} delivery={delivery} onClose={() => setDialog(null)} /> : null}
      {dialog === "upload" ? <UploadDialog data={data} onClose={() => setDialog(null)} preset={{ folder: "deliveries", kind: "Proof of delivery", reference: delivery.number, clientId: delivery.clientId, lockReference: true }} /> : null}
    </div>
  );
}

function AcceptanceDialog({ delivery, onClose }: { delivery: DeliveryRow; onClose: () => void }) {
  const [tonnes, setTonnes] = useState(String(delivery.quantities.received));
  const [note, setNote] = useState("");
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/deliveries/${delivery.id}/acceptance`, success: () => ({ title: "Customer acceptance recorded" }), onDone: onClose });
  const value = Number(tonnes);
  const short = delivery.quantities.received - value;
  const invalid = !(value >= 0) || value > delivery.quantities.received || (short > 0 && note.trim().length < 5);
  return (
    <Dialog title={`Record acceptance for ${delivery.number}`} description={`${formatTonnes(delivery.quantities.received)} received (${delivery.quantities.source}).`} size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending || invalid} onClick={() => save.mutate({ tonnes: value, note, version: delivery.version })}><Busy pending={save.isPending} label="Saving…">Record acceptance</Busy></button></>}>
      <Field label="Accepted by the customer (t)" error={value > delivery.quantities.received ? "Cannot be more than was received." : undefined}><input inputMode="decimal" value={tonnes} onChange={(event) => setTonnes(event.target.value)} data-autofocus /></Field>
      <Field label={short > 0 ? `Why were ${formatTonnes(short)} not accepted? (required)` : "Note (optional)"}><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </Dialog>
  );
}

function ReasonDialog({ title, path, field, label, confirm, success, withTonnes, danger, version, onClose }: { title: string; path: string; field: string; label: string; confirm: string; success: string; withTonnes?: boolean; danger?: boolean; version?: number; onClose: () => void }) {
  const [text, setText] = useState("");
  const [tonnes, setTonnes] = useState("0");
  const save = useTradeAction<Record<string, unknown>>({ path, success: () => ({ title: success }), onDone: onClose });
  return (
    <Dialog title={title} size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Keep as is</button><button className={`button ${danger ? "button--danger" : "button--primary"}`} disabled={save.isPending || text.trim().length < 5} onClick={() => save.mutate({ [field]: text, tonnes: Number(tonnes), version })}><Busy pending={save.isPending} label="Saving…">{confirm}</Busy></button></>}>
      {withTonnes ? <Field label="Tonnes in question"><input inputMode="decimal" value={tonnes} onChange={(event) => setTonnes(event.target.value)} /></Field> : null}
      <Field label={label}><textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} data-autofocus /></Field>
    </Dialog>
  );
}

function RescheduleDialog({ delivery, today, onClose }: { delivery: DeliveryRow; today: string; onClose: () => void }) {
  const [date, setDate] = useState(delivery.scheduledDate < today ? today : delivery.scheduledDate);
  const [note, setNote] = useState("");
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/deliveries/${delivery.id}/reschedule`, success: () => ({ title: "Delivery rescheduled" }), onDone: onClose });
  return (
    <Dialog title={`Reschedule ${delivery.number}`} description="A date after the commitment's due date needs the Mine Manager's approval." size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending || note.trim().length < 5 || date === delivery.scheduledDate} onClick={() => save.mutate({ scheduledDate: date, note, version: delivery.version })}><Busy pending={save.isPending} label="Saving…">Reschedule</Busy></button></>}>
      <Field label="New date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      <Field label="Reason (required)"><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </Dialog>
  );
}

function LinkShipmentDialog({ data, delivery, onClose }: { data: TradeView; delivery: DeliveryRow; onClose: () => void }) {
  const taken = new Set(data.deliveries.filter((item) => item.shipmentId && item.stage !== "cancelled").map((item) => item.shipmentId));
  const options = data.mining.shipments.filter((item) => !taken.has(item.id) && item.state !== "cancelled");
  const [shipmentId, setShipmentId] = useState(options[0]?.id ?? "");
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/deliveries/${delivery.id}/shipment`, success: () => ({ title: "Shipment linked", detail: "Dispatch and receipt now come from Mining Operations." }), onDone: onClose });
  return (
    <Dialog title="Link a Mining Operations shipment" size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending || !shipmentId} onClick={() => save.mutate({ shipmentId })}><Busy pending={save.isPending} label="Linking…">Link shipment</Busy></button></>}>
      {options.length === 0 ? <p className="muted">Every open shipment already carries a delivery.</p> : (
        <Field label="Shipment"><Select value={shipmentId} onChange={(event) => setShipmentId(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.number} · {formatTonnes(item.tonnes)} · {item.state}</option>)}</Select></Field>
      )}
    </Dialog>
  );
}
