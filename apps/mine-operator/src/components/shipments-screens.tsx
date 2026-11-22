"use client";

/**
 * The Shipments module: Overview, Mineral Inventory, Shipments, Logistics and History tabs, plus the task screens opened from them
 * (Create shipment, and Shipment readiness with its collection, dispatch and delivery stages).
 *
 * Plain words on purpose: "Waiting for transporter", "Collection confirmed", "Needs checking". The distinctions that matter stay
 * visible: a collection request is not a booking, a dispatch is not a delivery, and a quantity difference stays on screen until
 * someone has reviewed it. Collection requests are recorded in VESPER only; in this build nothing is sent to a real transporter.
 */
import type { CollectionRequest, Shipment, StockMovement, Transporter } from "@vesper/api-contracts";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Download, ExternalLink, Info, Lock, Package, Plus, Send, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { formatDemoDateTime } from "@/lib/demo-clock";
import {
  canActOnShipments,
  canCancel,
  checkLabels,
  conditionLabels,
  destinations,
  formatTonnes,
  nextStepLabel,
  readinessProblems,
  shipmentFigures,
  shipmentStage,
  shipmentStages,
  shipmentStateLabels,
  shipmentTone,
  shortDate,
} from "@/lib/shipment-rules";
import { useDemoContext } from "@/stores/demo-context";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { ShipmentTabs } from "./module-tabs";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { Select } from "./select";
import { StatusBadge } from "./status-badge";
import { useLogistics, useLogisticsAction, useSubmissionId, type Logistics } from "./use-logistics";
import { RegisterView, type Register } from "./workspace-screen";

const useActor = () => {
  const { context } = useDemoContext();
  return { name: context.persona, role: context.role };
};

const transporterOf = (data: Logistics, id: string) => data.transporters.find((item) => item.id === id);
const requestOf = (data: Logistics, shipment: Shipment) => data.requests.find((item) => item.id === shipment.requestId);
const isOpen = (shipment: Shipment) => shipment.state !== "delivered" && shipment.state !== "cancelled";

/** "26 Apr · Planned", "26 Apr · Requested" or "25 Apr · 08:00 · Confirmed": when collection is meant to happen and how sure that is. */
function collectionText(data: Logistics, shipment: Shipment) {
  const request = requestOf(data, shipment);
  if (shipment.state === "confirmed" && request?.collectionAt) return `${formatDemoDateTime(request.collectionAt)} · Confirmed`;
  if (shipment.state === "waiting") return `${shortDate(shipment.preferredDate)} · Requested`;
  if (shipment.state === "declined") return `${shortDate(shipment.preferredDate)} · Declined`;
  if (shipment.state === "dispatched" || shipment.state === "delivered") return `${shortDate(shipment.preferredDate)} · Collected`;
  return `${shortDate(shipment.preferredDate)} · Planned`;
}

/** A hook for the page every Shipments screen starts from: loading and error states, then the data. */
function useScreenData() {
  const query = useLogistics();
  return query;
}

// ---- Overview --------------------------------------------------------------------------------------------------------

export function ShipmentOverviewScreen() {
  const query = useScreenData();
  const actor = useActor();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const data = query.data;
  const open = data.shipments.filter(isOpen);
  const count = (state: Shipment["state"]) => data.shipments.filter((item) => item.state === state).length;
  const available = data.stockpiles.reduce((total, item) => total + item.available, 0);

  const detail = (shipment: Shipment) => {
    const tonnes = `${formatTonnes(shipment.tonnes)} ${shipment.mineral.toLowerCase()}`;
    const transporter = transporterOf(data, shipment.transporterId)?.name ?? "the transporter";
    const figures = shipmentFigures(shipment);
    switch (shipment.state) {
      case "preparing": {
        const missing = (Object.keys(checkLabels) as (keyof typeof checkLabels)[]).find((key) => !shipment.checks[key]);
        return `${tonnes} · ${missing ? `Complete the ${checkLabels[missing].toLowerCase().replace(" checked", "").replace(" approved", "").replace(" added", "").replace(" confirmed", "")} check` : "Ready to ask for collection"}`;
      }
      case "waiting":
        return `${tonnes} · Waiting for ${transporter}`;
      case "confirmed":
        return `${tonnes} · Collection: ${collectionText(data, shipment).replace(" · Confirmed", "")}`;
      case "declined":
        return `${tonnes} · ${transporter} declined`;
      default:
        return `${tonnes} · ${formatTonnes(figures.inTransit)} on its way`;
    }
  };

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Shipments"
        title="Shipment overview"
        description="See what needs attention before material leaves the mine."
        icon={Package}
        action={canActOnShipments("manage_shipments", actor).allowed ? <Link className="button button--primary" href="/shipments/new"><Plus /> Create shipment</Link> : undefined}
      />
      <ShipmentTabs active="overview" />
      <section className="kpi-row" aria-label="Summary">
        <article className="kpi"><span>Preparing</span><strong>{count("preparing") + count("declined")}</strong><small>Being made ready</small></article>
        <article className="kpi"><span>Waiting for transporter</span><strong>{count("waiting")}</strong><small>Request recorded, no reply yet</small></article>
        <article className="kpi"><span>Collection confirmed</span><strong>{count("confirmed")}</strong><small>The transporter has replied</small></article>
        <article className="kpi"><span>Available to reserve</span><strong>{formatTonnes(available)}</strong><small>Ready for shipment, not reserved</small></article>
      </section>
      <section className="card register-card">
        <div className="card__header"><div><h2>What needs attention</h2></div></div>
        {open.length === 0 ? (
          <div className="empty-inline empty-inline--centered"><strong>Nothing needs attention</strong><span>Every shipment is finished. Create a shipment when material is ready to go.</span></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Shipment</th><th scope="col">Details</th><th scope="col">Status</th><th scope="col">Next action</th></tr></thead>
              <tbody>
                {open.map((shipment) => (
                  <tr key={shipment.id}>
                    <td data-label="Shipment"><strong>{shipment.number}</strong></td>
                    <td data-label="Details">{detail(shipment)}</td>
                    <td data-label="Status"><StatusBadge value={shipmentTone[shipment.state]} label={shipmentStateLabels[shipment.state]} /></td>
                    <td data-label="Next action"><Link className="button button--quiet button--small" href={`/shipments/${shipment.id}`}>{nextStepLabel(shipment)}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="card__footnote">A request is not a booking until the transporter confirms.</p>
      </section>
    </div>
  );
}

// ---- Mineral inventory ------------------------------------------------------------------------------------------------

function movementText(move: StockMovement, data: Logistics) {
  const code = data.stockpiles.find((item) => item.id === move.stockpileId)?.code ?? "stock";
  const tonnes = formatTonnes(move.tonnes);
  switch (move.type) {
    case "receipt":
      return `${move.ref} · ${tonnes} received into ${code}`;
    case "reserve":
      return `${move.ref} · ${tonnes} reserved in ${code}`;
    case "release":
      return `${move.ref} · ${tonnes} released in ${code}`;
    case "dispatch":
      return `${move.ref} · ${tonnes} dispatched from ${code}`;
    default:
      return `${code} · Opening balance of ${tonnes}`;
  }
}

function movementLink(move: StockMovement, data: Logistics): string | null {
  if (move.ref.startsWith("PR-")) {
    const record = data.production.find((item) => item.number === move.ref);
    return record ? `/shipments/inventory/check/${record.id}` : null;
  }
  if (move.ref.startsWith("SHP-")) {
    const shipment = data.shipments.find((item) => item.number === move.ref);
    return shipment ? `/shipments/${shipment.id}` : null;
  }
  return null;
}

export function InventoryScreen() {
  const query = useScreenData();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const data = query.data;
  const total = (pick: (item: Logistics["stockpiles"][number]) => number) => data.stockpiles.reduce((sum, item) => sum + pick(item), 0);
  const needsProcessing = data.stockpiles.filter((item) => item.condition === "needs_processing").reduce((sum, item) => sum + item.onHand, 0);
  const waiting = data.production.filter((item) => item.state === "needs_checking").length;

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Shipments"
        title="Mineral inventory"
        description="See what is in stock, what is reserved, and what can be used."
        icon={Package}
        action={<Link className="button button--primary" href="/shifts/production?filter=needs">Review production{waiting ? ` (${waiting})` : ""}</Link>}
      />
      <ShipmentTabs active="inventory" />
      <section className="kpi-row" aria-label="Summary">
        <article className="kpi"><span>At the mine</span><strong>{formatTonnes(total((item) => item.onHand))}</strong><small>Physically on site</small></article>
        <article className="kpi"><span>Needs processing</span><strong>{formatTonnes(needsProcessing)}</strong><small>Cannot be reserved yet</small></article>
        <article className="kpi"><span>Reserved</span><strong>{formatTonnes(total((item) => item.reserved))}</strong><small>Promised to shipments</small></article>
        <article className="kpi"><span>Available to reserve</span><strong>{formatTonnes(total((item) => item.available))}</strong><small>Ready for shipment</small></article>
      </section>
      <section className="card register-card">
        <div className="card__header"><div><h2>Stock by location</h2></div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Stockpile</th><th scope="col">Mineral</th><th scope="col" className="number-cell">In stock</th><th scope="col">Condition</th><th scope="col" className="number-cell">Reserved</th><th scope="col" className="number-cell">Available</th></tr></thead>
            <tbody>
              {data.stockpiles.map((item) => (
                <tr key={item.id}>
                  <td data-label="Stockpile"><strong>{item.code}</strong> · {item.name}</td>
                  <td data-label="Mineral">{item.mineral}</td>
                  <td data-label="In stock" className="number-cell">{formatTonnes(item.onHand)}</td>
                  <td data-label="Condition">{conditionLabels[item.condition]}</td>
                  <td data-label="Reserved" className="number-cell">{formatTonnes(item.reserved)}</td>
                  <td data-label="Available" className="number-cell">{formatTonnes(item.available)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td data-label="Stockpile">Total</td><td /><td className="number-cell" data-label="In stock">{formatTonnes(total((item) => item.onHand))}</td><td />
                <td className="number-cell" data-label="Reserved">{formatTonnes(total((item) => item.reserved))}</td><td className="number-cell" data-label="Available">{formatTonnes(total((item) => item.available))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="card__footnote">Reserved material is still at the mine. Material needing processing cannot be reserved.</p>
      </section>
      <section className="card register-card">
        <div className="card__header"><div><h2>Recent movement</h2></div></div>
        {data.movements.length === 0 ? <p className="empty-line">Nothing has moved yet.</p> : (
          <ul className="timeline-list" style={{ padding: "4px 24px 8px" }}>
            {data.movements.slice(0, 6).map((move) => {
              const link = movementLink(move, data);
              return <li key={move.id}><strong>{movementText(move, data)}</strong><small>{move.actor} · {formatDemoDateTime(move.at)}{move.note ? ` · ${move.note}` : ""}{link ? <> · <Link className="row-link" href={link}>View record</Link></> : null}</small></li>;
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---- The Shipments tab ------------------------------------------------------------------------------------------------

export function ShipmentListScreen() {
  const query = useScreenData();
  const actor = useActor();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const data = query.data;
  const active = data.shipments.filter(isOpen);
  const reserved = active.reduce((total, item) => total + item.tonnes - shipmentFigures(item).dispatched, 0);

  const register: Register<Shipment> = {
    icon: Truck,
    tiles: [],
    columns: [
      { key: "shipment", label: "Shipment", render: (item) => item.number },
      { key: "material", label: "Material", render: (item) => `${item.mineral} · ${data.stockpiles.find((sp) => sp.id === item.stockpileId)?.code ?? ""}` },
      { key: "amount", label: "Amount", render: (item) => formatTonnes(item.tonnes) },
      { key: "destination", label: "Destination", render: (item) => item.destination },
      { key: "collection", label: "Collection", render: (item) => collectionText(data, item) },
      { key: "status", label: "Status", render: (item) => <StatusBadge value={shipmentTone[item.state]} label={shipmentStateLabels[item.state]} /> },
      { key: "next", label: "Next step", render: (item) => <span className="row-link-text">{nextStepLabel(item)}</span> },
    ],
    filters: [
      { key: "all", label: "All", test: isOpen },
      { key: "preparing", label: "Preparing", test: (item) => item.state === "preparing" || item.state === "declined" },
      { key: "waiting", label: "Waiting", test: (item) => item.state === "waiting" },
      { key: "confirmed", label: "Confirmed", test: (item) => item.state === "confirmed" },
      { key: "dispatched", label: "On its way", test: (item) => item.state === "dispatched" },
    ],
    href: (item) => `/shipments/${item.id}`,
    text: (item) => [item.number, item.mineral, item.destination, item.orderRef, shipmentStateLabels[item.state]].join(" "),
    rows: data.shipments,
    action: canActOnShipments("manage_shipments", actor).allowed ? { label: "Create shipment", href: "/shipments/new", plus: true } : undefined,
    emptyTitle: "No shipments yet",
    emptyBody: "Create a shipment from stock that is ready to ship.",
    footnote: `${active.length} active ${active.length === 1 ? "shipment" : "shipments"} · ${formatTonnes(reserved)} reserved. Open a shipment to see its checks, transport request and activity.`,
  };
  return <RegisterView initialFilter={null} header={{ eyebrow: "Shipments", title: "Shipments", description: "Prepare each shipment and follow it through to delivery." }} register={register} tabs={<ShipmentTabs active="shipments" />} />;
}

// ---- Logistics --------------------------------------------------------------------------------------------------------

export function LogisticsScreen() {
  const query = useScreenData();
  const actor = useActor();
  const [managing, setManaging] = useState(false);
  const remind = useLogisticsAction<{ id: string }, CollectionRequest>({ path: (input) => `/collection-requests/${input.id}/reminder`, success: (request) => ({ title: "Reminder recorded", detail: `${request.number}: in this demo nothing is sent. Open the reply page to answer as the transporter.` }) });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const data = query.data;
  const canManage = canActOnShipments("manage_shipments", actor).allowed;

  const register: Register<CollectionRequest> = {
    icon: Truck,
    tiles: [],
    columns: [
      { key: "request", label: "Request", render: (item) => item.number },
      { key: "shipment", label: "Shipment", render: (item) => { const s = data.shipments.find((x) => x.id === item.shipmentId); return s ? `${s.number} · ${formatTonnes(s.tonnes)}` : "—"; } },
      { key: "transporter", label: "Transporter", render: (item) => transporterOf(data, item.transporterId)?.name ?? "—" },
      { key: "collection", label: "Collection", render: (item) => (item.collectionAt ? formatDemoDateTime(item.collectionAt) : (() => { const s = data.shipments.find((x) => x.id === item.shipmentId); return s ? shortDate(s.preferredDate) : "—"; })()) },
      { key: "response", label: "Response", render: (item) => <StatusBadge value={item.state === "sent" ? "needs_confirmation" : item.state === "confirmed" ? "confirmed" : item.state === "declined" ? "at_risk" : "cancelled"} label={item.state === "sent" ? "Waiting for reply" : item.state === "confirmed" ? "Confirmed" : item.state === "declined" ? "Declined" : "Cancelled"} /> },
      {
        key: "next",
        label: "Next step",
        render: (item) =>
          item.state === "sent" ? (
            <span className="row-actions">
              {canManage ? <button className="link-button" disabled={remind.isPending} onClick={() => remind.mutate({ id: item.id })}>Send reminder</button> : null}
              {canManage ? " · " : null}<Link className="row-link-text" href={`/transport/respond/${item.token}`} target="_blank">Open reply page (demo)</Link>
            </span>
          ) : <Link className="row-link-text" href={`/shipments/${item.shipmentId}`}>{item.state === "confirmed" ? "View confirmation" : "View shipment"}</Link>,
      },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "waiting", label: "Waiting for reply", test: (item) => item.state === "sent" },
      { key: "confirmed", label: "Confirmed", test: (item) => item.state === "confirmed" },
    ],
    href: (item) => `/shipments/${item.shipmentId}`,
    text: (item) => [item.number, transporterOf(data, item.transporterId)?.name, data.shipments.find((x) => x.id === item.shipmentId)?.number].join(" "),
    rows: data.requests,
    action: canManage ? { label: "Manage providers", onClick: () => setManaging(true), quiet: true } : undefined,
    emptyTitle: "No collection requests yet",
    emptyBody: "Requests appear here when a shipment is marked ready.",
    footnote: "Demo: requests are recorded here and nothing is sent to a real transporter. A request is not a booking until the transporter confirms.",
  };

  return (
    <>
      <RegisterView
        initialFilter={null}
        header={{ eyebrow: "Shipments", title: "Logistics", description: "Follow collection requests and transporter replies." }}
        register={register}
        tabs={<ShipmentTabs active="logistics" />}
      />
      <section className="card register-card" style={{ maxWidth: 1500, margin: "14px auto 0" }}>
        <div className="card__header"><div><h2>Approved providers</h2></div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Provider</th><th scope="col">Type</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {data.transporters.map((item) => (
                <tr key={item.id}><td data-label="Provider"><strong>{item.name}</strong></td><td data-label="Type">{item.mode}</td><td data-label="Status"><StatusBadge value={item.active ? "confirmed" : "cancelled"} label={item.active ? "Approved" : "Switched off"} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {canManage ? <p className="card__footnote"><button className="link-button" onClick={() => setManaging(true)}>+ Add provider</button></p> : null}
      </section>
      {managing ? <ProvidersDialog transporters={data.transporters} onClose={() => setManaging(false)} /> : null}
    </>
  );
}

function ProvidersDialog({ transporters, onClose }: { transporters: Transporter[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState("Road transport");
  const submission = useSubmissionId();
  const add = useLogisticsAction<Record<string, unknown>, Transporter>({ path: "/transporters", success: (item) => ({ title: "Provider added", detail: `${item.name} can now be chosen for shipments.` }), onDone: () => { setName(""); submission.renew(); } });
  const toggle = useLogisticsAction<{ id: string; active: boolean }, Transporter>({ path: (input) => `/transporters/${input.id}`, method: "PATCH", success: (item) => ({ title: item.active ? "Provider switched on" : "Provider switched off" }) });
  return (
    <Dialog title="Manage providers" description="Providers you can ask to collect a shipment." onClose={onClose} locked={add.isPending} footer={<button className="button button--quiet" onClick={onClose}>Done</button>}>
      <div className="dialog__stack">
        <ul className="timeline-list" aria-label="Providers">
          {transporters.map((item) => (
            <li key={item.id}><strong>{item.name}</strong><small>{item.mode} · {item.active ? "Approved" : "Switched off"} · <button className="link-button" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: item.id, active: !item.active })}>{item.active ? "Switch off" : "Switch on"}</button></small></li>
          ))}
        </ul>
        <form className="task-grid task-grid--two" onSubmit={(event) => { event.preventDefault(); add.mutate({ name, mode, submissionId: submission.id }); }}>
          <Field label="Company name"><input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Type of transport"><input value={mode} onChange={(event) => setMode(event.target.value)} /></Field>
          <div><button className="button button--primary" disabled={add.isPending || name.trim().length < 3}>{add.isPending ? "Adding…" : "Add provider"}</button></div>
        </form>
      </div>
    </Dialog>
  );
}

// ---- History ----------------------------------------------------------------------------------------------------------

export function HistoryScreen() {
  const query = useScreenData();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const data = query.data;
  const finished = data.shipments.filter((item) => !isOpen(item));
  const latest = finished.find((item) => item.state === "delivered") ?? finished[0];

  const finishedAt = (item: Shipment) => (item.state === "cancelled" ? item.events[item.events.length - 1]?.occurredAt : item.deliveries[item.deliveries.length - 1]?.at);
  const register: Register<Shipment> = {
    icon: Truck,
    tiles: [],
    columns: [
      { key: "shipment", label: "Shipment", render: (item) => item.number },
      { key: "material", label: "Material", render: (item) => item.mineral },
      { key: "sent", label: "Sent", render: (item) => (item.dispatches.length ? formatTonnes(shipmentFigures(item).dispatched) : "—") },
      { key: "received", label: "Received", render: (item) => (item.deliveries.length ? formatTonnes(shipmentFigures(item).received) : "—") },
      { key: "finished", label: "Finished", render: (item) => { const at = finishedAt(item); return at ? formatDemoDateTime(at).split(" · ")[0] : "—"; } },
      { key: "outcome", label: "Outcome", render: (item) => (item.state === "cancelled" ? <StatusBadge value="cancelled" label="Cancelled before dispatch" /> : <StatusBadge value={shipmentFigures(item).unreviewed.length ? "needs_confirmation" : "confirmed"} label={shipmentFigures(item).unreviewed.length ? "Delivered · Difference to review" : "Delivered · Checked"} />) },
      { key: "details", label: "Details", render: () => <span className="row-link-text">View</span> },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "delivered", label: "Delivered", test: (item) => item.state === "delivered" },
      { key: "cancelled", label: "Cancelled", test: (item) => item.state === "cancelled" },
    ],
    href: (item) => `/shipments/${item.id}`,
    text: (item) => [item.number, item.mineral, item.destination, item.orderRef].join(" "),
    rows: finished,
    action: { label: "Download list", onClick: () => download(), quiet: true, icon: Download },
    emptyTitle: "No finished shipments yet",
    emptyBody: "Delivered and cancelled shipments are kept here.",
    footnote: finished.some((item) => item.state === "cancelled") ? "A cancelled shipment released its reserved stock." : "Delivered shipments are kept with their evidence.",
  };

  const download = () =>
    downloadCsv("shipment-history.csv", [
      ["Shipment", "Material", "Order reference", "Destination", "Sent (t)", "Received (t)", "Outcome"],
      ...finished.map((item) => [item.number, item.mineral, item.orderRef, item.destination, shipmentFigures(item).dispatched, shipmentFigures(item).received, shipmentStateLabels[item.state]]),
    ]);

  return (
    <>
      <RegisterView
        initialFilter={null}
        header={{ eyebrow: "Shipments", title: "Shipment history", description: "Find finished shipments and see what happened." }}
        register={register}
        tabs={<ShipmentTabs active="history" />}
      />
      {latest ? (
        <section className="card register-card" style={{ maxWidth: 1500, margin: "14px auto 0" }}>
          <div className="card__header"><div><h2>{latest.number} activity</h2></div></div>
          <ul className="timeline-list" style={{ padding: "4px 24px 12px" }}>
            {latest.events.map((entry) => <li key={entry.id}><strong>{entry.summary}</strong><small>{formatDemoDateTime(entry.occurredAt)} · {entry.actor}{entry.note ? ` · ${entry.note}` : ""}</small></li>)}
          </ul>
        </section>
      ) : null}
    </>
  );
}

// ---- Create shipment --------------------------------------------------------------------------------------------------

export function CreateShipmentScreen() {
  const query = useScreenData();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <CreateForm data={query.data} />;
}

function CreateForm({ data }: { data: Logistics }) {
  const router = useRouter();
  const actor = useActor();
  const permission = canActOnShipments("manage_shipments", actor);
  const submission = useSubmissionId();
  const eligible = data.stockpiles.filter((item) => item.condition === "ready_for_shipment");
  const transporters = data.transporters.filter((item) => item.active);
  const [stockpileId, setStockpileId] = useState(eligible[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [destination, setDestination] = useState(destinations[0]);
  const [date, setDate] = useState("");
  const [transporterId, setTransporterId] = useState(transporters[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const stockpile = eligible.find((item) => item.id === stockpileId);
  const tonnes = Number(amount);
  const entered = amount.trim() !== "" && Number.isFinite(tonnes) && tonnes > 0;
  const over = Boolean(stockpile && entered && tonnes > stockpile.available);
  const nextNumber = `SHP-${String(48 + data.shipments.filter((item) => Number(item.number.slice(4)) > 48).length + 1).padStart(4, "0")}`;

  const create = useLogisticsAction<Record<string, unknown>, Shipment>({
    path: "/shipments",
    success: (shipment) => ({ title: "Shipment created", detail: `${shipment.number} reserves ${formatTonnes(shipment.tonnes)}. Complete the readiness checks next.` }),
    onDone: (shipment) => router.push(`/shipments/${shipment.id}`),
  });

  if (!permission.allowed) {
    return (
      <div className="task-page">
        <Link href="/shipments/list" className="back-link"><ArrowLeft /> Back to Shipments</Link>
        <section className="card detail-card restricted"><Lock aria-hidden="true" /><h2>This step is for the Inventory Controller</h2><p>{permission.reason}</p></section>
      </div>
    );
  }

  const submit = () => {
    if (!stockpile) return setError("There is no stock that is ready to ship.");
    if (!entered) return setError("Enter how many tonnes to reserve.");
    if (over) return setError(`Only ${formatTonnes(stockpile.available)} is available in ${stockpile.code}.`);
    if (orderRef.trim().length < 3) return setError("Enter the customer or order reference.");
    if (!date) return setError("Choose the preferred collection date.");
    if (!transporterId) return setError("Choose an approved transporter.");
    setError("");
    create.mutate({ submissionId: submission.id, stockpileId, tonnes, orderRef, destination, preferredDate: date, transporterId, note });
  };

  return (
    <div className="task-page">
      <Link href="/shipments/list" className="back-link"><ArrowLeft /> Back to Shipments</Link>
      <PageHeader eyebrow="Shipments" title="Create shipment" description="Choose the material to send and where it needs to go." icon={Truck} />
      <form className="card task-card" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
        <section className="task-section">
          <h2>1 · Material</h2>
          <div className="task-grid">
            <Field label="Mineral"><Select value="Manganese" disabled onChange={() => {}}><option>Manganese</option></Select></Field>
            <Field label="Stockpile" hint="Only material that is ready to ship is listed.">
              <Select value={stockpileId} onChange={(event) => setStockpileId(event.target.value)}>{eligible.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select>
            </Field>
            <Field label="Amount to reserve (t)"><input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={over} /></Field>
          </div>
          {stockpile ? (
            over ? <div className="note-bar note-bar--bad" role="alert"><AlertTriangle /> <span>Only {formatTonnes(stockpile.available)} is available. Reduce the amount.</span></div>
              : <div className="note-bar note-bar--good" role="status"><CheckCircle2 /> <span>{formatTonnes(stockpile.available)} available{entered ? ` · ${formatTonnes(tonnes)} for this shipment · ${formatTonnes(stockpile.available - tonnes)} left` : ""}</span></div>
          ) : <div className="note-bar note-bar--warn"><AlertTriangle /> <span>No stock is ready to ship. Check production first, or process the raw material.</span></div>}
        </section>
        <section className="task-section">
          <h2>2 · Delivery</h2>
          <div className="task-grid task-grid--two">
            <Field label="Customer or order reference"><input value={orderRef} placeholder="For example PO-2049" onChange={(event) => setOrderRef(event.target.value)} /></Field>
            <Field label="Destination"><Select value={destination} onChange={(event) => setDestination(event.target.value)}>{destinations.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
          </div>
        </section>
        <section className="task-section">
          <h2>3 · Collection</h2>
          <div className="task-grid task-grid--two">
            <Field label="Preferred collection date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
            <Field label="Approved transporter" hint={transporterId ? `${data.transporters.find((item) => item.id === transporterId)?.name} is not asked until you mark the shipment ready.` : undefined}>
              <Select value={transporterId} onChange={(event) => setTransporterId(event.target.value)}>{transporters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            </Field>
          </div>
        </section>
        <details className="task-section"><summary>Notes (optional)</summary><Field label="Note" wide><textarea rows={3} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></Field></details>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        <div className="task-footer">
          <p>Creates {nextNumber} and reserves {entered ? formatTonnes(tonnes) : "the amount"}. Complete the readiness checks next.</p>
          <div className="button-row">
            <Link className="button button--quiet" href="/shipments/list">Cancel</Link>
            <button className="button button--primary" disabled={create.isPending || !stockpile}>{create.isPending ? "Creating…" : "Create shipment"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---- One shipment: readiness, collection, dispatch, delivery ----------------------------------------------------------

export function ShipmentScreen({ id }: { id: string }) {
  const query = useScreenData();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const shipment = query.data.shipments.find((item) => item.id === id);
  if (!shipment) return <ErrorState message="This shipment could not be found." onRetry={() => query.refetch()} />;
  return <ShipmentView data={query.data} shipment={shipment} />;
}

function Stages({ shipment }: { shipment: Shipment }) {
  const at = shipmentStage(shipment);
  return (
    <ol className="stages" aria-label="Shipment stages">
      {shipmentStages.map((label, index) => (
        <li key={label} className={`stage ${index < at ? "stage--done" : index === at ? "stage--now" : ""}`} aria-current={index === at ? "step" : undefined}>
          <span className="stage__dot">{index < at ? <Check size={15} aria-hidden="true" /> : index + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}

function ShipmentView({ data, shipment }: { data: Logistics; shipment: Shipment }) {
  const router = useRouter();
  const actor = useActor();
  const canManage = canActOnShipments("manage_shipments", actor);
  const transporter = transporterOf(data, shipment.transporterId);
  const request = requestOf(data, shipment);
  const figures = shipmentFigures(shipment);
  const [checks, setChecks] = useState(shipment.checks);
  const [transporterId, setTransporterId] = useState(shipment.transporterId);
  const [cancelling, setCancelling] = useState(false);
  const preparing = shipment.state === "preparing" || shipment.state === "declined";
  const chosen = data.transporters.find((item) => item.id === transporterId);
  const problems = readinessProblems({ ...shipment, checks }, chosen);
  const changed = JSON.stringify(checks) !== JSON.stringify(shipment.checks) || transporterId !== shipment.transporterId;

  const save = useLogisticsAction<Record<string, unknown>, Shipment>({ path: `/shipments/${shipment.id}`, method: "PATCH", success: () => ({ title: "Saved", detail: "Your checks are saved. You can finish them later." }) });
  const ready = useLogisticsAction<{ version: number }, { shipment: Shipment; request: CollectionRequest }>({
    path: `/shipments/${shipment.id}/ready`,
    success: (result) => ({ title: "Collection request recorded", detail: `${result.request.number} is waiting for ${chosen?.name ?? "the transporter"} to reply. Demo: no message is sent.` }),
  });
  const remind = useLogisticsAction<{ id: string }, CollectionRequest>({ path: (input) => `/collection-requests/${input.id}/reminder`, success: (item) => ({ title: "Reminder recorded", detail: `${item.number}: in this demo nothing is sent.` }) });
  const review = useLogisticsAction<{ deliveryId: string }, Shipment>({ path: (input) => `/shipments/${shipment.id}/deliveries/${input.deliveryId}/review`, success: () => ({ title: "Difference reviewed" }) });
  const cancel = useLogisticsAction<{ reason: string; version: number }, Shipment>({
    path: `/shipments/${shipment.id}/cancel`,
    success: (item) => ({ title: "Shipment cancelled", detail: `${formatTonnes(item.tonnes)} was released back to stock.` }),
    onDone: () => router.push("/shipments/list"),
  });

  const stockpile = data.stockpiles.find((item) => item.id === shipment.stockpileId);

  return (
    <div className="task-page">
      <Link href="/shipments/list" className="back-link"><ArrowLeft /> Back to Shipments</Link>
      <PageHeader eyebrow="Shipments" title={shipment.state === "preparing" || shipment.state === "declined" ? "Shipment readiness" : shipment.number} description={shipment.state === "preparing" || shipment.state === "declined" ? "Check the shipment before asking the transporter to collect it." : `${shipmentStateLabels[shipment.state]}. ${shipment.destination}.`} icon={Truck} />

      <section className="card task-card" aria-label="Shipment">
        <div className="fact-row">
          <div className="fact"><span>Shipment</span><strong>{shipment.number} · {shipment.mineral} · {formatTonnes(shipment.tonnes)} · {stockpile?.code}</strong></div>
          <div className="fact"><span>Destination</span><strong>{shipment.destination}</strong></div>
          <div className="fact"><span>Preferred collection</span><strong>{shortDate(shipment.preferredDate)}</strong></div>
          <div className="fact"><span>Order</span><strong>{shipment.orderRef}</strong></div>
          <StatusBadge value={shipmentTone[shipment.state]} label={shipmentStateLabels[shipment.state]} />
        </div>
        {shipment.state !== "cancelled" ? <Stages shipment={shipment} /> : <div className="note-bar"><Info /> <span><strong>Cancelled:</strong> {shipment.cancelledReason} {formatTonnes(shipment.tonnes)} was released back to stock.</span></div>}

        {shipment.state === "declined" ? <div className="note-bar note-bar--warn" role="status"><AlertTriangle /> <span><strong>{transporter?.name} declined.</strong> {request?.reply} Choose a transporter again and send a new request.</span></div> : null}

        {preparing ? (
          <div className="split">
            <section className="task-section" style={{ borderTop: 0, paddingTop: 0 }}>
              <h2>Ready for collection?</h2>
              <ul className="check-list">
                <li><span className="check-list__fixed" aria-hidden="true"><Check /></span> {formatTonnes(shipment.tonnes)} reserved</li>
                {(Object.keys(checkLabels) as (keyof typeof checkLabels)[]).map((key) => (
                  <li key={key}><label style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}><input type="checkbox" checked={checks[key]} disabled={!canManage.allowed} onChange={(event) => setChecks({ ...checks, [key]: event.target.checked })} />{checkLabels[key]}</label></li>
                ))}
              </ul>
            </section>
            <section className="task-section" style={{ borderTop: 0, paddingTop: 0 }}>
              <h2>Transporter</h2>
              <Field label="Approved transporter"><Select value={transporterId} disabled={!canManage.allowed} onChange={(event) => setTransporterId(event.target.value)}>{data.transporters.filter((item) => item.active || item.id === transporterId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
              <div className="fact-row"><div className="fact"><span>Collection request</span><strong>Not sent</strong></div><div className="fact"><span>Collection confirmation</span><strong>Not confirmed</strong></div></div>
            </section>
          </div>
        ) : null}

        {preparing && !canManage.allowed ? <div className="note-bar"><Lock /> <span>{canManage.reason}</span></div> : null}
        {preparing && canManage.allowed ? (
          <>
            {problems.length > 0 ? <div className="note-bar" role="status"><Info /> <span>{problems[0]}{problems.length > 1 ? ` (${problems.length} things to finish)` : ""}</span></div> : null}
            <div className="task-footer">
              <p>This sends a collection request. {chosen?.name ?? "The transporter"} must still confirm. Demo: no message is sent.</p>
              <div className="button-row">
                <button className="button button--quiet" disabled={save.isPending || !changed} onClick={() => save.mutate({ checks, transporterId, version: shipment.version })}>Save and finish later</button>
                <button
                  className="button button--primary"
                  disabled={ready.isPending || save.isPending}
                  onClick={() => (problems.length > 0 ? save.mutate({ checks, transporterId, version: shipment.version }) : (changed ? save.mutateAsync({ checks, transporterId, version: shipment.version }).then(() => ready.mutate({ version: shipment.version + 1 })) : ready.mutate({ version: shipment.version })))}
                >
                  <Send /> {ready.isPending ? "Recording…" : "Mark ready & notify transporter"}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {shipment.state === "waiting" && request ? (
          <section className="task-section">
            <h2>Waiting for {transporter?.name}</h2>
            <div className="fact-row"><div className="fact"><span>Request</span><strong>{request.number}</strong></div><div className="fact"><span>Sent</span><strong>{formatDemoDateTime(request.sentAt)}</strong></div><div className="fact"><span>Reminders</span><strong>{request.reminders}</strong></div></div>
            <div className="note-bar"><Info /> <span>A request is not a booking. The transporter must confirm a collection time. Demo: nothing was sent, so open the reply page to answer as the transporter.</span></div>
            <div className="button-row">
              <Link className="button button--quiet" target="_blank" href={`/transport/respond/${request.token}`}><ExternalLink /> Open reply page (demo)</Link>
              {canManage.allowed ? <button className="button button--quiet" disabled={remind.isPending} onClick={() => remind.mutate({ id: request.id })}>Send reminder</button> : null}
            </div>
          </section>
        ) : null}

        {(shipment.state === "confirmed" || shipment.state === "dispatched") && request?.collectionAt ? (
          <div className="note-bar note-bar--good"><CheckCircle2 /> <span><strong>Collection confirmed:</strong> {transporter?.name} will collect on {formatDemoDateTime(request.collectionAt)}.{request.reply ? ` “${request.reply}”` : ""}</span></div>
        ) : null}

        {shipment.state === "confirmed" || shipment.state === "dispatched" ? (
          <section className="task-section">
            <h2>Dispatch</h2>
            <div className="fact-row">
              <div className="fact"><span>Still at the mine</span><strong>{formatTonnes(figures.remaining)}</strong></div>
              <div className="fact"><span>Dispatched</span><strong>{formatTonnes(figures.dispatched)}</strong></div>
              <div className="fact"><span>On its way</span><strong>{formatTonnes(figures.inTransit)}</strong></div>
              <div className="fact"><span>Received</span><strong>{formatTonnes(figures.received)}</strong></div>
            </div>
            {canManage.allowed && figures.remaining > 0 ? <DispatchForm key={figures.remaining} shipment={shipment} remaining={figures.remaining} /> : null}
          </section>
        ) : null}

        {shipment.state === "dispatched" && figures.inTransit > 0 && canManage.allowed ? (
          <section className="task-section"><h2>Delivery</h2><DeliveryForm key={figures.inTransit} shipment={shipment} inTransit={figures.inTransit} /></section>
        ) : null}

        {shipment.dispatches.length > 0 || shipment.deliveries.length > 0 ? (
          <section className="task-section">
            <h2>Loads and deliveries</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col" className="number-cell">Amount</th><th scope="col">Detail</th></tr></thead>
                <tbody>
                  {shipment.dispatches.map((item) => <tr key={item.id}><td data-label="When">{formatDemoDateTime(item.at)}</td><td data-label="What">Dispatched</td><td data-label="Amount" className="number-cell">{formatTonnes(item.tonnes)}</td><td data-label="Detail">{item.by}{item.reference ? ` · ${item.reference}` : ""}</td></tr>)}
                  {shipment.deliveries.map((item) => (
                    <tr key={item.id}>
                      <td data-label="When">{formatDemoDateTime(item.at)}</td><td data-label="What">Received</td><td data-label="Amount" className="number-cell">{formatTonnes(item.tonnes)}</td>
                      <td data-label="Detail">
                        {item.evidence}{item.settles !== item.tonnes ? ` · ${formatTonnes(Math.abs(item.settles - item.tonnes))} ${item.tonnes < item.settles ? "short" : "over"}: ${item.reason}` : ""}
                        {!item.reviewed ? <> · <StatusBadge value="needs_confirmation" label="Difference to review" /> {canManage.allowed ? <button className="link-button" disabled={review.isPending} onClick={() => review.mutate({ deliveryId: item.id })}>Mark reviewed</button> : null}</> : item.reviewedBy ? ` · Reviewed by ${item.reviewedBy}` : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {canManage.allowed && canCancel(shipment) ? <div className="button-row"><button className="button button--quiet" onClick={() => setCancelling(true)}>Cancel shipment</button></div> : null}

        <details className="task-section">
          <summary>Activity · prepared by {shipment.preparedBy}</summary>
          <ul className="timeline-list" style={{ marginTop: 12 }}>{shipment.events.map((entry) => <li key={entry.id}><strong>{entry.summary}</strong><small>{formatDemoDateTime(entry.occurredAt)} · {entry.actor}{entry.note ? ` · ${entry.note}` : ""}</small></li>)}</ul>
        </details>
      </section>
      <p className="field-hint">Next: {shipment.state === "preparing" || shipment.state === "declined" ? "ask the transporter to collect, then wait for their confirmation." : shipment.state === "waiting" ? "wait for the transporter to confirm a collection time." : shipment.state === "confirmed" ? "record dispatch when the material leaves the mine." : shipment.state === "dispatched" ? "record what was received, with the delivery evidence." : "nothing more to do."}</p>
      {cancelling ? <CancelDialog shipment={shipment} pending={cancel.isPending} onClose={() => setCancelling(false)} onCancel={(reason) => cancel.mutate({ reason, version: shipment.version })} /> : null}
    </div>
  );
}

function DispatchForm({ shipment, remaining }: { shipment: Shipment; remaining: number }) {
  const [tonnes, setTonnes] = useState(String(remaining));
  const [reference, setReference] = useState("");
  const submission = useSubmissionId();
  const dispatch = useLogisticsAction<Record<string, unknown>, Shipment>({ path: `/shipments/${shipment.id}/dispatch`, success: (item) => ({ title: "Dispatch recorded", detail: `${formatTonnes(shipmentFigures(item).dispatched)} of ${formatTonnes(item.tonnes)} has left the mine.` }), onDone: () => submission.renew() });
  const value = Number(tonnes);
  return (
    <form className="task-grid task-grid--two" onSubmit={(event) => { event.preventDefault(); dispatch.mutate({ submissionId: submission.id, tonnes: value, reference, version: shipment.version }); }}>
      <Field label="Amount leaving the mine (t)" hint="Enter part of the shipment if it goes in more than one load."><input type="number" inputMode="decimal" min="0" step="any" value={tonnes} onChange={(event) => setTonnes(event.target.value)} /></Field>
      <Field label="Load reference (optional)"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Truck or weighbridge slip" /></Field>
      <div><button className="button button--primary" disabled={dispatch.isPending || !(value > 0)}><Truck /> {dispatch.isPending ? "Recording…" : "Record dispatch"}</button></div>
    </form>
  );
}

function DeliveryForm({ shipment, inTransit }: { shipment: Shipment; inTransit: number }) {
  const [received, setReceived] = useState(String(inTransit));
  const [settles, setSettles] = useState(String(inTransit));
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const submission = useSubmissionId();
  const deliver = useLogisticsAction<Record<string, unknown>, Shipment>({ path: `/shipments/${shipment.id}/delivery`, success: (item) => ({ title: item.state === "delivered" ? "Delivery recorded" : "Part delivery recorded", detail: `${formatTonnes(shipmentFigures(item).received)} received so far.` }), onDone: () => submission.renew() });
  const got = Number(received);
  const covers = Number(settles);
  const difference = Number.isFinite(got) && Number.isFinite(covers) ? Math.round((got - covers) * 100) / 100 : 0;
  return (
    <form className="task-grid task-grid--two" onSubmit={(event) => { event.preventDefault(); deliver.mutate({ submissionId: submission.id, tonnes: got, settles: covers, evidence, reason, version: shipment.version }); }}>
      <Field label="Amount received (t)"><input type="number" inputMode="decimal" min="0" step="any" value={received} onChange={(event) => setReceived(event.target.value)} /></Field>
      <Field label="Dispatched amount this settles (t)" hint={`${formatTonnes(inTransit)} is on its way.`}><input type="number" inputMode="decimal" min="0" step="any" value={settles} onChange={(event) => setSettles(event.target.value)} /></Field>
      <Field label="Delivery evidence" hint="For example the signed delivery note."><input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="DN-0048.pdf" /></Field>
      {difference !== 0 ? <Field label="Reason for the difference"><input value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : <div />}
      {difference !== 0 ? <div className="note-bar note-bar--warn" style={{ gridColumn: "1 / -1" }}><AlertTriangle /> <span>{formatTonnes(Math.abs(difference))} {difference < 0 ? "less" : "more"} arrived than was dispatched. It stays on screen until someone reviews it.</span></div> : null}
      <div><button className="button button--primary" disabled={deliver.isPending || evidence.trim().length < 3}><Check /> {deliver.isPending ? "Recording…" : "Record delivery"}</button></div>
    </form>
  );
}

function CancelDialog({ shipment, pending, onClose, onCancel }: { shipment: Shipment; pending: boolean; onClose: () => void; onCancel: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      title={`Cancel ${shipment.number}`}
      description={`${formatTonnes(shipment.tonnes)} will go back to available stock. This cannot be undone.`}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={<><button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Keep shipment</button><button className="button button--primary" disabled={pending || reason.trim().length < 8} onClick={() => onCancel(reason.trim())}>{pending ? "Cancelling…" : "Cancel shipment"}</button></>}
    >
      <Field label="Why is it being cancelled?" hint="At least eight characters."><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    </Dialog>
  );
}
