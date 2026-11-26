"use client";

/**
 * Logistics: the transport side of customer deliveries, in three tabs. It shows the same service providers, transport agreements and
 * transport (quote) requests that Mining Operations' Shipments uses, so there is one record of each; their detail and create pages
 * open here under /trade/logistics with the Trade navigation. Collections and dispatch stay with Mining Operations.
 */
import { CalendarClock, CirclePlus, Clock, Download, FileText, Network, Truck, BadgeCheck, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { agreementStatus, agreementStatusWords, approvalLabels, type Agreement, type QuoteRequest } from "@/lib/transport-rules";
import type { Transporter } from "@vesper/api-contracts";
import { ErrorState, LoadingState } from "../query-state";
import { Select } from "../select";
import { priceOf } from "../transport-agreement-screens";
import { AddProviderDialog } from "../transport-screens";
import { useLogistics } from "../use-logistics";
import { useTransport } from "../use-transport";
import { CellMain, dayLabel, exportCsv, KpiTiles, RailCard, RailList, Register, Status, TabBar, TradeHeader, ViewLink } from "./trade-ui";

type Tab = "providers" | "agreements" | "requests";

export function LogisticsScreen() {
  const transport = useTransport();
  const logistics = useLogistics();
  if (transport.isPending || logistics.isPending) return <LoadingState label="Loading logistics" />;
  if (transport.isError || !transport.data || logistics.isError || !logistics.data) return <ErrorState message="Logistics could not be loaded." onRetry={() => { void transport.refetch(); void logistics.refetch(); }} />;
  return <Logistics transport={transport.data} shipments={logistics.data.shipments} />;
}

type TransportData = NonNullable<ReturnType<typeof useTransport>["data"]>;
type ShipmentList = NonNullable<ReturnType<typeof useLogistics>["data"]>["shipments"];

function Logistics({ transport, shipments }: { transport: TransportData; shipments: ShipmentList }) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(initial === "agreements" || initial === "requests" ? initial : "providers");
  const [adding, setAdding] = useState(false);
  const [approvalFilter, setApprovalFilter] = useState("");
  const today = transport.today;
  const terms = transport.terms;
  const agreements = terms?.agreements ?? [];
  const requests = terms?.requests ?? [];
  const activeAgreements = agreements.filter((item) => agreementStatus(item, today) === "active");
  const inTransit = shipments.filter((item) => item.state === "dispatched");
  const delivered = shipments.filter((item) => item.deliveries.length > 0);
  const turnaround = delivered.map((item) => (Date.parse(item.deliveries.at(-1)!.at) - Date.parse(item.dispatches[0]?.at ?? item.deliveries[0].at)) / 86_400_000).filter((value) => value >= 0);
  const openRequests = requests.filter((item) => item.status === "sent" || item.status === "draft");
  const name = (id: string) => transport.providers.find((item) => item.id === id)?.name ?? "Provider";
  const change = (next: Tab) => { setTab(next); router.replace(`/trade/logistics${next === "providers" ? "" : `?tab=${next}`}`, { scroll: false }); };

  return (
    <div className="workspace-page trade-page">
      <TradeHeader title="Logistics" description="Transport providers, transport agreements and transport requests for customer deliveries." icon={Network}
        actions={<>
          <button className="button button--quiet" onClick={() => exportCsv("logistics-providers.csv", ["Provider", "Service", "Areas", "Contact", "Approval", "Approved until"], transport.providers.map((item) => [item.name, item.mode, item.areasServed.join("; "), item.contactPerson, approvalLabels[item.approval], item.approvedUntil]))}><Download /> Export</button>
          {transport.can.record ? <Link className="button button--primary" href="/trade/logistics/quotes/new"><CirclePlus /> Create transport request</Link> : null}
        </>} />
      <KpiTiles items={[
        { label: "Logistics providers", value: transport.providers.length, hint: `${transport.providers.filter((item) => item.approval === "approved").length} approved`, icon: Truck },
        { label: "Active agreements", value: terms ? activeAgreements.length : "—", hint: terms ? `${agreements.length} in total` : "Terms restricted", icon: FileText },
        { label: "Transport requests", value: terms ? requests.length : "—", hint: terms ? `${openRequests.length} open` : "Terms restricted", icon: Send },
        { label: "In transit", value: inTransit.length, hint: "Dispatched by Mining Operations", icon: Truck },
        { label: "Delivered", value: delivered.length, hint: "Shipments with a recorded delivery", icon: BadgeCheck },
        { label: "Average turnaround", value: turnaround.length ? `${(turnaround.reduce((a, b) => a + b, 0) / turnaround.length).toFixed(1)} days` : "—", hint: "Dispatch to delivery", icon: Clock },
      ]} />
      <TabBar<Tab> label="Logistics sections" active={tab} onChange={change} tabs={[
        { key: "providers", label: "Service Providers", icon: Truck, count: transport.providers.length },
        { key: "agreements", label: "Transport Agreements", icon: FileText, count: terms ? agreements.length : undefined },
        { key: "requests", label: "Transport Requests", icon: CalendarClock, count: terms ? requests.length : undefined },
      ]} />
      <div className="trade-layout" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "providers" ? (
          <Register<Transporter>
            title={`Service providers (${transport.providers.length})`}
            noun="providers"
            rows={transport.providers}
            searchLabel="Search providers by name, area or service"
            search={(row) => [row.name, row.mode, row.serviceNote, row.areasServed.join(" "), row.contactPerson].join(" ")}
            href={(row) => `/trade/logistics/${row.id}`}
            extra={{
              controls: <label className="trade-select"><span className="sr-only">Approval</span><Select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)}><option value="">All statuses</option>{Object.entries(approvalLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>,
              test: (row) => !approvalFilter || row.approval === approvalFilter,
              active: Boolean(approvalFilter),
              clear: () => setApprovalFilter(""),
            }}
            initialSort={{ key: "name", direction: "asc" }}
            columns={[
              { key: "name", label: "Provider", sort: (row) => row.name, render: (row) => <CellMain title={row.name} detail={row.contactPerson || row.email} /> },
              { key: "service", label: "Service", sort: (row) => row.mode, render: (row) => <span className="trade-tags"><span className="trade-tag">{row.mode}</span>{row.serviceNote ? <span className="trade-tag">{row.serviceNote}</span> : null}</span> },
              { key: "areas", label: "Areas served", render: (row) => row.areasServed.join(", ") || <span className="muted">Not recorded</span> },
              { key: "agreements", label: "Agreements", sort: (row) => activeAgreements.filter((item) => item.providerId === row.id).length, render: (row) => (terms ? activeAgreements.filter((item) => item.providerId === row.id).length : "—") },
              { key: "status", label: "Status", sort: (row) => row.approval, render: (row) => <span className="cell-main"><Status family={row.approval === "approved" ? "done" : row.approval === "needs_review" ? "attention" : "unknown"} label={approvalLabels[row.approval]} />{row.approvedUntil ? <small>Until {dayLabel(row.approvedUntil)}</small> : null}</span> },
            ]}
            actions={(row) => <ViewLink href={`/trade/logistics/${row.id}`} name={row.name} />}
            toolbarEnd={transport.can.manage ? <button className="button button--quiet button--small" onClick={() => setAdding(true)}><CirclePlus /> Add provider</button> : undefined}
            empty={{ title: "No transport providers", body: "Add the companies that carry the mine's material." }}
          />
        ) : null}
        {tab === "agreements" ? (
          terms ? (
            <Register<Agreement>
              title="Transport agreements"
              noun="agreements"
              rows={agreements}
              searchLabel="Search transport agreements"
              search={(row) => [row.number, row.reference, name(row.providerId), row.material, row.from, row.to].join(" ")}
              href={(row) => `/trade/logistics/agreements/${row.id}`}
              chips={(Object.keys(agreementStatusWords) as (keyof typeof agreementStatusWords)[]).map((key) => ({ key, label: agreementStatusWords[key], test: (row) => agreementStatus(row, today) === key }))}
              initialSort={{ key: "number", direction: "desc" }}
              columns={[
                { key: "number", label: "Agreement", sort: (row) => row.number, render: (row) => <CellMain title={row.number} detail={row.reference} /> },
                { key: "provider", label: "Provider", sort: (row) => name(row.providerId), render: (row) => name(row.providerId) },
                { key: "route", label: "Route", render: (row) => `${row.from} → ${row.to}` },
                { key: "material", label: "Material", render: (row) => row.material },
                { key: "rate", label: "Agreed rate", render: (row) => priceOf(row) },
                { key: "term", label: "Term", sort: (row) => row.endDate, render: (row) => `${dayLabel(row.startDate)} – ${dayLabel(row.endDate)}` },
                { key: "status", label: "Status", sort: (row) => agreementStatus(row, today), render: (row) => { const status = agreementStatus(row, today); return <Status family={status === "active" ? "done" : status === "expired" ? "attention" : status === "ended" ? "unknown" : "waiting"} label={agreementStatusWords[status]} />; } },
              ]}
              actions={(row) => <ViewLink href={`/trade/logistics/agreements/${row.id}`} name={row.number} />}
              toolbarEnd={transport.can.record ? <Link className="button button--quiet button--small" href="/trade/logistics/agreements/new"><CirclePlus /> New agreement</Link> : undefined}
              empty={{ title: "No transport agreements", body: "Record a transport contract after a provider's quote is accepted." }}
            />
          ) : <section className="card trade-mini-empty"><p className="muted">Transport rates and terms are shown to the Mine Manager, the Commercial / Finance Officer and the Inventory Controller.</p></section>
        ) : null}
        {tab === "requests" ? (
          terms ? (
            <Register<QuoteRequest>
              title="Transport requests"
              noun="requests"
              rows={requests}
              searchLabel="Search transport requests"
              search={(row) => [row.number, row.material, row.from, row.to, ...row.providerIds.map(name)].join(" ")}
              href={(row) => `/trade/logistics/quotes/${row.id}`}
              chips={[
                { key: "open", label: "Open", test: (row) => row.status === "draft" || row.status === "sent" },
                { key: "decided", label: "Decided", test: (row) => row.status === "decision_recorded" },
                { key: "closed", label: "Closed", test: (row) => row.status === "closed" },
              ]}
              initialSort={{ key: "number", direction: "desc" }}
              columns={[
                { key: "number", label: "Request", sort: (row) => row.number, render: (row) => <CellMain title={row.number} detail={row.kind === "shipment" ? "Shipment quote" : "Agreement quote"} /> },
                { key: "route", label: "Route", render: (row) => `${row.from} → ${row.to}` },
                { key: "material", label: "Material", render: (row) => row.material },
                { key: "quantity", label: "Quantity", sort: (row) => row.quantityTonnes ?? row.expectedVolume ?? 0, render: (row) => (row.quantityTonnes ? `${row.quantityTonnes.toLocaleString("en-GB")} t` : row.expectedVolume ? `${row.expectedVolume.toLocaleString("en-GB")} t expected` : "—") },
                { key: "providers", label: "Providers asked", render: (row) => row.providerIds.map(name).join(", ") },
                { key: "replies", label: "Quotes", sort: (row) => row.quotes.filter((item) => item.status !== "waiting").length, render: (row) => `${row.quotes.filter((item) => item.status !== "waiting").length} of ${row.quotes.length}` },
                { key: "status", label: "Status", sort: (row) => row.status, render: (row) => <Status family={row.status === "sent" ? "active" : row.status === "decision_recorded" ? "done" : row.status === "draft" ? "waiting" : "unknown"} label={{ draft: "Draft", sent: "Request sent", decision_recorded: "Decision recorded", closed: "Closed" }[row.status]} /> },
              ]}
              actions={(row) => <ViewLink href={`/trade/logistics/quotes/${row.id}`} name={row.number} />}
              empty={{ title: "No transport requests", body: "Ask approved providers to quote for a delivery or a transport agreement." }}
            />
          ) : <section className="card trade-mini-empty"><p className="muted">Transport requests and quotes are shown to the Mine Manager, the Commercial / Finance Officer and the Inventory Controller.</p></section>
        ) : null}
        <aside className="trade-rail" aria-label="Logistics activity">
          <RailCard title={`Active transport requests (${openRequests.length})`} action={terms ? { label: "View all", onClick: () => change("requests") } : undefined}>
            <RailList empty={terms ? "No open requests." : "Restricted."} items={openRequests.slice(0, 5).map((item) => ({ key: item.id, icon: Truck, title: item.number, detail: `${item.from} → ${item.to}`, aside: item.status === "draft" ? "Draft" : `${item.quotes.filter((quote) => quote.status !== "waiting").length}/${item.quotes.length} quotes`, href: `/trade/logistics/quotes/${item.id}` }))} />
          </RailCard>
          <RailCard title="On the road">
            <RailList empty="Nothing in transit." items={inTransit.map((item) => ({ key: item.id, icon: Truck, title: `${item.number} · ${item.tonnes.toLocaleString("en-GB")} t`, detail: item.destination, href: `/shipments/${item.id}` }))} />
            <p className="muted trade-small">Collections and dispatch are run by Mining Operations.</p>
          </RailCard>
        </aside>
      </div>
      {adding ? <AddProviderDialog onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
