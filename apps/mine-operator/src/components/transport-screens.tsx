"use client";

/**
 * Service providers: the providers a mine can use for transport, the quotations asked for and recorded, and the ongoing transport
 * agreements. Opened from Shipments > Logistics > Manage providers, with three tabs: Providers, Transport quotes and Transport
 * agreements. The agreement screens live in transport-agreement-screens.tsx.
 *
 * Everything here is manual record-keeping with fictional data. VESPER does not send a request, receive a quote or place a booking:
 * a person sends the request by their own means, then records what happened here. Quotes, rates and agreement terms are commercial
 * information and are only sent to roles allowed to see them (see lib/transport-rules.ts).
 */
import type { Transporter } from "@vesper/api-contracts";
import { ArrowLeft, Check, Copy, Download, FileText, Info, Lock, Send, Truck, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTransportBase } from "./use-transport-base";
import { downloadText } from "@/lib/csv";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { formatTonnes, shortDate } from "@/lib/shipment-rules";
import {
  TRANSPORT_DEMO_DATE,
  agreementPricingMethods,
  agreementStatus,
  agreementStatusWords,
  allowancePeriodWords,
  approvalLabels,
  approvalTone,
  billingWords,
  dayLabel,
  feeEquivalents,
  formatRand,
  periodWords,
  quoteStatusNow,
  quoteStatusWords,
  quoteTone,
  quoteTotal,
  rangeLabel,
  rateLabel,
  shipmentPricingMethods,
  vatWords,
  type Approval,
  type Attachment,
  type Quote,
  type QuoteRequest,
} from "@/lib/transport-rules";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { Select } from "./select";
import { StatusBadge } from "./status-badge";
import { useToast } from "./toast-provider";
import { useLogistics, useSubmissionId } from "./use-logistics";
import { useTransport, useTransportAction, type Transport } from "./use-transport";
import { RegisterView, type Register } from "./workspace-screen";
import { Busy } from "./busy";

// ---- Shared pieces ------------------------------------------------------------------------------------------------------

export const providerName = (data: Transport, id: string) => data.providers.find((item) => item.id === id)?.name ?? "Provider";

/** The three tabs of the Service providers pages, with a way back to Logistics. */
export function ProviderTabs({ active }: { active: "providers" | "quotes" | "agreements" }) {
  const base = useTransportBase();
  const tabs = [
    { key: "providers", label: "Providers", href: `${base}` },
    { key: "quotes", label: "Transport quotes", href: `${base}/quotes` },
    { key: "agreements", label: "Transport agreements", href: `${base}/agreements` },
  ] as const;
  return (
    <>
      <Link href="/shipments" className="back-link"><ArrowLeft /> Back to Shipments</Link>
      <nav className="tabs module-tabs" aria-label="Service provider sections">
        {tabs.map((tab) => (
          <Link key={tab.key} href={tab.href} className={`tab ${tab.key === active ? "tab--active" : ""}`} aria-current={tab.key === active ? "page" : undefined}>{tab.label}</Link>
        ))}
      </nav>
    </>
  );
}

/** Says plainly that the figures are a simulated period, so nobody reads the demonstration dates as today's. */
export function DemoPeriodNote() {
  return <div className="note-bar"><Info /> <span><strong>Demo period: April 2026.</strong> Providers, quotes and agreements are simulated records for this demonstration. Nothing is sent to a provider, and prices exclude VAT unless a record says otherwise.</span></div>;
}

function LockedTerms() {
  return <div className="note-bar"><Lock /> <span>Quotes, rates and agreement terms are commercial information. They are shown to the Mine Manager, the Commercial / Finance Officer and the Inventory Controller.</span></div>;
}

/** Picks files to remember by name. Nothing is uploaded in this prototype: the name and size are kept with the record. */
function AttachmentInput({ value, onChange, label = "Attachments" }: { value: Attachment[]; onChange: (next: Attachment[]) => void; label?: string }) {
  return (
    <Field label={label} wide hint="Optional. Only the file names are kept in this prototype.">
      <input
        type="file"
        multiple
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []).map((file) => ({ name: file.name, sizeLabel: file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB` }));
          onChange([...value, ...picked].slice(0, 8));
          event.target.value = "";
        }}
      />
      {value.length > 0 ? (
        <span className="chip-row">
          {value.map((file, index) => (
            <span className="chip" key={`${file.name}-${index}`}><FileText size={13} aria-hidden="true" /> {file.name} <small>{file.sizeLabel}</small> <button type="button" className="link-button" aria-label={`Remove ${file.name}`} onClick={() => onChange(value.filter((_, at) => at !== index))}><X size={12} /></button></span>
          ))}
        </span>
      ) : null}
    </Field>
  );
}

function History({ lines }: { lines: { id: string; at: string; actor: string; summary: string; note: string | null }[] }) {
  if (lines.length === 0) return <p className="muted">Nothing recorded yet.</p>;
  return (
    <ul className="timeline-list" aria-label="History">
      {[...lines].reverse().map((line) => (
        <li key={line.id}><strong>{line.summary}</strong><small>{formatDemoDateTime(line.at)} · {line.actor}{line.note ? ` · “${line.note}”` : ""}</small></li>
      ))}
    </ul>
  );
}

/** Wraps a screen's loading and error states so each screen only deals with data it has. */
function WithTransport({ children }: { children: (data: Transport) => React.ReactNode }) {
  const query = useTransport();
  if (query.isPending) return <LoadingState />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  return <>{children(query.data)}</>;
}

// ---- Providers ----------------------------------------------------------------------------------------------------------

type ProviderForm = { name: string; mode: string; areasServed: string; contactPerson: string; email: string; phone: string; notes: string; attachments: Attachment[] };
const blankProvider: ProviderForm = { name: "", mode: "Road transport", areasServed: "", contactPerson: "", email: "", phone: "", notes: "", attachments: [] };

function providerFormOf(provider: Transporter): ProviderForm {
  return { name: provider.name, mode: provider.mode, areasServed: provider.areasServed.join(", "), contactPerson: provider.contactPerson, email: provider.email, phone: provider.phone, notes: provider.notes, attachments: provider.attachments };
}

function ProviderFields({ form, setForm, disabled = false }: { form: ProviderForm; setForm: (next: ProviderForm) => void; disabled?: boolean }) {
  const set = (key: keyof ProviderForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value });
  return (
    <div className="task-grid task-grid--two">
      <Field label="Company name"><input value={form.name} disabled={disabled} onChange={set("name")} /></Field>
      <Field label="Service type"><input value={form.mode} disabled={disabled} onChange={set("mode")} placeholder="Road transport" /></Field>
      <Field label="Areas served" hint="Separate areas with commas."><input value={form.areasServed} disabled={disabled} onChange={set("areasServed")} placeholder="North West, Gauteng" /></Field>
      <Field label="Contact person"><input value={form.contactPerson} disabled={disabled} onChange={set("contactPerson")} /></Field>
      <Field label="Email"><input type="email" value={form.email} disabled={disabled} onChange={set("email")} /></Field>
      <Field label="Phone"><input value={form.phone} disabled={disabled} onChange={set("phone")} /></Field>
      <Field label="Notes" wide><textarea rows={3} maxLength={600} value={form.notes} disabled={disabled} onChange={set("notes")} /></Field>
      {disabled ? null : <AttachmentInput value={form.attachments} onChange={(attachments) => setForm({ ...form, attachments })} label="Documents (insurance, licences)" />}
    </div>
  );
}

export function ProvidersScreen() {
  return <WithTransport>{(data) => <ProvidersView data={data} />}</WithTransport>;
}

function ProvidersView({ data }: { data: Transport }) {
  const base = useTransportBase();
  const [adding, setAdding] = useState(false);
  const counts = (approval: Approval) => data.providers.filter((item) => item.approval === approval).length;
  const quotesOf = (id: string) => data.terms?.requests.filter((request) => request.providerIds.includes(id)).length ?? null;
  const agreementsOf = (id: string) => data.terms?.agreements.filter((item) => item.providerId === id).length ?? null;

  const register: Register<Transporter> = {
    icon: Truck,
    tiles: [
      { label: "Approved", value: counts("approved"), hint: "Can be used for new shipments" },
      { label: "Needs review", value: counts("needs_review"), hint: "Waiting for the mine's approval", attention: counts("needs_review") > 0 },
      { label: "Inactive", value: counts("inactive"), hint: "Kept with their history" },
    ],
    columns: [
      { key: "name", label: "Provider", render: (item) => <span className="cell-main"><strong>{item.name}</strong><small>{item.contactPerson || "No contact person yet"}</small></span> },
      { key: "type", label: "Service type", render: (item) => item.mode },
      { key: "areas", label: "Areas served", render: (item) => (item.areasServed.length > 0 ? item.areasServed.join(", ") : <span className="muted">Not recorded</span>) },
      { key: "approval", label: "Mine approval", render: (item) => <StatusBadge value={approvalTone[item.approval]} label={approvalLabels[item.approval]} /> },
      { key: "linked", label: "Quotes · Agreements", render: (item) => (data.terms ? `${quotesOf(item.id)} · ${agreementsOf(item.id)}` : <span className="muted">Not shown</span>) },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "approved", label: "Approved", test: (item) => item.approval === "approved" },
      { key: "needs_review", label: "Needs review", test: (item) => item.approval === "needs_review" },
      { key: "inactive", label: "Inactive", test: (item) => item.approval === "inactive" },
    ],
    href: (item) => `${base}/${item.id}`,
    text: (item) => [item.name, item.mode, item.contactPerson, item.areasServed.join(" "), approvalLabels[item.approval]].join(" "),
    rows: data.providers,
    action: data.can.manage ? { label: "Add provider", onClick: () => setAdding(true), plus: true } : undefined,
    emptyTitle: "No providers yet",
    emptyBody: "Add a transport provider to ask it for quotes.",
    footnote: "Only approved providers can be chosen for a new shipment or asked for a quote. Inactive providers stay here with their history.",
  };

  return (
    <>
      <RegisterView initialFilter={null} header={{ eyebrow: "Shipments · Logistics", title: "Service providers", description: "Providers you can use for transport, the quotes they give and the agreements you hold." }} register={register} tabs={<ProviderTabs active="providers" />} />
      {adding ? <AddProviderDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}

export function AddProviderDialog({ onClose }: { onClose: () => void }) {
  const base = useTransportBase();
  const router = useRouter();
  const [form, setForm] = useState<ProviderForm>(blankProvider);
  const submission = useSubmissionId();
  const add = useTransportAction<Record<string, unknown>, Transporter>({
    path: "/transport-providers",
    success: (item) => ({ title: "Provider added", detail: `${item.name} needs the Mine Manager's approval before it can be asked for a quote or used for a shipment.` }),
    onDone: (item) => { onClose(); router.push(`${base}/${item.id}`); },
  });
  return (
    <Dialog title="Add provider" description="New providers start as Needs review." size="wide" onClose={onClose} locked={add.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={add.isPending}>Cancel</button><button className="button button--primary" disabled={add.isPending || form.name.trim().length < 3} onClick={() => add.mutate({ ...form, submissionId: submission.id })}><Busy pending={add.isPending} label="Adding…">Add provider</Busy></button></>}>
      <ProviderFields form={form} setForm={setForm} />
    </Dialog>
  );
}

export function ProviderScreen({ id }: { id: string }) {
  return <WithTransport>{(data) => <ProviderView data={data} provider={data.providers.find((item) => item.id === id)} />}</WithTransport>;
}

function ProviderView({ data, provider }: { data: Transport; provider: Transporter | undefined }) {
  const base = useTransportBase();
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState<Approval | null>(null);
  if (!provider) return <ErrorState message="This provider could not be found." />;
  const requests = data.terms?.requests.filter((item) => item.providerIds.includes(provider.id)) ?? [];
  const agreements = data.terms?.agreements.filter((item) => item.providerId === provider.id) ?? [];

  return (
    <div className="task-page">
      <Link href={`${base}`} className="back-link"><ArrowLeft /> Back to Service providers</Link>
      <PageHeader eyebrow="Service providers" title={provider.name} description={`${provider.mode}. ${provider.areasServed.length > 0 ? `Serves ${provider.areasServed.join(", ")}.` : "No areas recorded yet."}`} icon={Truck}
        action={data.can.manage ? <button className="button button--quiet" onClick={() => setEditing(true)}>Edit details</button> : undefined} />
      <section className="card task-card" aria-label="Provider">
        <div className="fact-row">
          <div className="fact"><span>Mine approval</span><strong><StatusBadge value={approvalTone[provider.approval]} label={approvalLabels[provider.approval]} /></strong></div>
          <div className="fact"><span>Contact</span><strong>{provider.contactPerson || "Not recorded"}</strong></div>
          <div className="fact"><span>Email</span><strong>{provider.email || "Not recorded"}</strong></div>
          <div className="fact"><span>Phone</span><strong>{provider.phone || "Not recorded"}</strong></div>
        </div>
        {provider.notes ? <p>{provider.notes}</p> : null}
        {provider.attachments.length > 0 ? <p className="muted">Documents: {provider.attachments.map((file) => file.name).join(", ")}</p> : null}
        {provider.approval !== "approved" ? <div className="note-bar"><Info /> <span>{provider.approval === "needs_review" ? "This provider is waiting for the Mine Manager's approval. Until then it cannot be asked for a quote or chosen for a shipment." : "This provider is inactive. It cannot be used for new work, and its records and history are kept."}</span></div> : null}
        {data.can.approve ? (
          <div className="button-row button-row--end">
            {provider.approval !== "approved" ? <button className="button button--primary" onClick={() => setApproving("approved")}><Check /> Approve provider</button> : null}
            {provider.approval !== "inactive" ? <button className="button button--quiet" onClick={() => setApproving("inactive")}>Make inactive</button> : null}
          </div>
        ) : null}
      </section>

      <section className="card task-card" aria-label="Quotes and agreements">
        <h2>Quotes and agreements</h2>
        {!data.terms ? <LockedTerms /> : requests.length === 0 && agreements.length === 0 ? <p className="muted">No quote requests or agreements yet.</p> : (
          <ul className="timeline-list">
            {requests.map((item) => <li key={item.id}><Link className="row-link-text" href={`${base}/quotes/${item.id}`}>{item.number}</Link><small>{item.kind === "shipment" ? "Shipment quote" : "Transport agreement quote"} · {item.material} · {requestStatusText(item)}</small></li>)}
            {agreements.map((item) => <li key={item.id}><Link className="row-link-text" href={`${base}/agreements/${item.id}`}>{item.number}</Link><small>{item.material} · {item.from} to {item.to} · {agreementStatusWords[agreementStatus(item, TRANSPORT_DEMO_DATE)]}</small></li>)}
          </ul>
        )}
        {data.can.record && provider.approval === "approved" ? <div className="button-row button-row--end"><Link className="button button--quiet" href={`${base}/quotes/new?provider=${provider.id}`}>Request a quote</Link></div> : null}
      </section>

      <section className="card task-card" aria-label="History"><h2>History</h2><History lines={provider.history} /></section>

      {editing ? <EditProviderDialog provider={provider} onClose={() => setEditing(false)} /> : null}
      {approving ? <ApprovalDialog provider={provider} approval={approving} onClose={() => setApproving(null)} /> : null}
    </div>
  );
}

function EditProviderDialog({ provider, onClose }: { provider: Transporter; onClose: () => void }) {
  const [form, setForm] = useState<ProviderForm>(providerFormOf(provider));
  const save = useTransportAction<Record<string, unknown>, Transporter>({ path: `/transport-providers/${provider.id}`, method: "PATCH", success: () => ({ title: "Provider updated" }), onDone: onClose });
  return (
    <Dialog title="Edit provider" size="wide" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || form.name.trim().length < 3} onClick={() => save.mutate({ ...form })}><Busy pending={save.isPending} label="Saving…">Save changes</Busy></button></>}>
      <ProviderFields form={form} setForm={setForm} />
    </Dialog>
  );
}

function ApprovalDialog({ provider, approval, onClose }: { provider: Transporter; approval: Approval; onClose: () => void }) {
  const [note, setNote] = useState("");
  const save = useTransportAction<Record<string, unknown>, Transporter>({
    path: `/transport-providers/${provider.id}`, method: "PATCH",
    success: (item) => ({ title: item.approval === "approved" ? "Provider approved" : "Provider made inactive", detail: item.approval === "approved" ? `${item.name} can now be asked for quotes and used for shipments.` : `${item.name} is kept with its history but cannot be used for new work.` }),
    onDone: onClose,
  });
  const needsReason = approval === "inactive";
  return (
    <Dialog title={approval === "approved" ? `Approve ${provider.name}?` : `Make ${provider.name} inactive?`} description={approval === "approved" ? "The mine confirms it is happy to use this provider." : "Its quotes, agreements and history are kept."} onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || (needsReason && note.trim().length < 5)} onClick={() => save.mutate({ approval, note })}><Busy pending={save.isPending} label="Saving…">{approval === "approved" ? "Approve" : "Make inactive"}</Busy></button></>}>
      <Field label={needsReason ? "Why? (required)" : "Note (optional)"}><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </Dialog>
  );
}

// ---- Quotes -------------------------------------------------------------------------------------------------------------

const requestStatusText = (request: QuoteRequest) => {
  if (request.status === "draft") return "Draft";
  const replies = request.quotes.filter((item) => item.status !== "waiting").length;
  if (request.status === "sent") return `Request sent · ${replies} of ${request.quotes.length} replies`;
  return request.status === "decision_recorded" ? "Decision recorded" : "Closed";
};

export function QuotesScreen() {
  return <WithTransport>{(data) => (data.terms ? <QuotesView data={data} requests={data.terms.requests} /> : <div className="workspace-page"><PageHeader eyebrow="Shipments · Logistics" title="Transport quotes" description="Quotes for moving material." icon={Truck} /><ProviderTabs active="quotes" /><LockedTerms /></div>)}</WithTransport>;
}

function QuotesView({ data, requests }: { data: Transport; requests: QuoteRequest[] }) {
  const base = useTransportBase();
  const logistics = useLogistics();
  const numberOf = (request: QuoteRequest) => logistics.data?.shipments.find((item) => item.id === request.shipmentId)?.number ?? "Shipment";
  const register: Register<QuoteRequest> = {
    icon: Truck,
    tiles: [
      { label: "Drafts", value: requests.filter((item) => item.status === "draft").length, hint: "Saved, not yet recorded as sent" },
      { label: "Waiting for quotes", value: requests.filter((item) => item.status === "sent" && item.quotes.some((quote) => quote.status === "waiting")).length, hint: "At least one reply still to come" },
      { label: "To review", value: requests.filter((item) => item.quotes.some((quote) => quote.status === "to_review")).length, hint: "Quotes waiting for a decision", attention: requests.some((item) => item.quotes.some((quote) => quote.status === "to_review")) },
      { label: "Decided", value: requests.filter((item) => item.status === "decision_recorded").length, hint: "A quote was accepted" },
    ],
    columns: [
      { key: "number", label: "Request", render: (item) => <span className="cell-main"><strong>{item.number}</strong><small>{item.kind === "shipment" ? "One shipment" : "Transport agreement"}</small></span> },
      { key: "subject", label: "For", render: (item) => (item.kind === "agreement" ? `${item.material} · ${item.from} to ${item.to}` : `${numberOf(item)} · ${item.quantityTonnes !== null ? formatTonnes(item.quantityTonnes) : ""} · ${item.material}`) },
      { key: "providers", label: "Providers", render: (item) => item.providerIds.map((id) => providerName(data, id)).join(", ") },
      { key: "status", label: "Status", render: (item) => requestStatusText(item) },
      { key: "reply", label: "Reply by", render: (item) => formatDemoDateTime(item.replyBy) },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "shipment", label: "One shipment", test: (item) => item.kind === "shipment" },
      { key: "agreement", label: "Transport agreement", test: (item) => item.kind === "agreement" },
      { key: "review", label: "To review", test: (item) => item.quotes.some((quote) => quote.status === "to_review") },
    ],
    href: (item) => `${base}/quotes/${item.id}`,
    text: (item) => [item.number, item.material, item.to, item.providerIds.map((id) => providerName(data, id)).join(" ")].join(" "),
    rows: requests,
    action: data.can.record ? { label: "New quote request", href: `${base}/quotes/new`, plus: true } : undefined,
    emptyTitle: "No quote requests yet",
    emptyBody: "Ask approved providers to quote for one shipment or for an ongoing agreement.",
    footnote: "Demo: requests are not sent from VESPER. Send the request yourself, then record that it was sent and enter each reply.",
  };
  return <RegisterView initialFilter={null} header={{ eyebrow: "Shipments · Logistics", title: "Transport quotes", description: "Ask providers for prices, record their replies and decide." }} register={register} tabs={<ProviderTabs active="quotes" />} />;
}

/** The text a person sends to a provider. Built from the request, so what is asked is the same as what is recorded. */
export function requestText(data: Transport, request: QuoteRequest, shipmentNumber: string | null): string {
  const lines = [
    `Request for a transport quote ${request.number}`,
    "",
    request.kind === "shipment" ? `One shipment${shipmentNumber ? ` (${shipmentNumber})` : ""}` : "Ongoing transport agreement",
    `Material: ${request.material}`,
    `Route: ${request.from} to ${request.to}`,
    `Service: ${request.service}`,
  ];
  if (request.kind === "shipment") {
    lines.push(`Quantity: ${request.quantityTonnes !== null ? formatTonnes(request.quantityTonnes) : "to be confirmed"}`);
    if (request.collectionWindow) lines.push(`Collection window: ${request.collectionWindow}`);
    if (request.requiredBy) lines.push(`Required by: ${request.requiredBy}`);
  } else {
    lines.push(`Agreement dates: ${request.startDate && request.endDate ? rangeLabel(request.startDate, request.endDate) : "to be agreed"}`);
    lines.push(`Expected quantity (a planning estimate, not a commitment): ${request.expectedVolume !== null ? `${new Intl.NumberFormat("en-GB").format(request.expectedVolume)} t per ${request.volumePeriod === "agreement" ? "agreement" : "calendar month"}` : "to be agreed"}`);
    lines.push(`Preferred billing: ${request.preferredBilling ? billingWords[request.preferredBilling] : "to be agreed"}`);
  }
  if (request.requirements) lines.push(`Requirements: ${request.requirements}`);
  lines.push(`Please reply by: ${formatDemoDateTime(request.replyBy)}`);
  lines.push(`Asked: ${request.providerIds.map((id) => providerName(data, id)).join(", ")}`);
  lines.push("", "Please state your prices and whether VAT is included, what the price covers, any fuel or other charges, and how long the quote is valid.");
  return lines.join("\n");
}

export function QuoteRequestScreen({ id }: { id: string }) {
  return <WithTransport>{(data) => (data.terms ? <QuoteRequestView data={data} request={data.terms.requests.find((item) => item.id === id)} /> : <div className="task-page"><ProviderTabs active="quotes" /><LockedTerms /></div>)}</WithTransport>;
}

function QuoteRequestView({ data, request }: { data: Transport; request: QuoteRequest | undefined }) {
  const base = useTransportBase();
  const logistics = useLogistics();
  const { push: toast } = useToast();
  const [recording, setRecording] = useState<Quote | null>(null);
  const [deciding, setDeciding] = useState<{ quote: Quote; decision: "accept" | "not_selected" } | null>(null);
  const sent = useTransportAction<Record<string, never>, QuoteRequest>({ path: `/quote-requests/${request?.id}/sent`, success: () => ({ title: "Recorded as sent", detail: "Demo: nothing was sent from VESPER. Enter each reply as it arrives." }) });
  if (!request) return <ErrorState message="This quote request could not be found." />;
  const shipment = logistics.data?.shipments.find((item) => item.id === request.shipmentId) ?? null;
  const text = requestText(data, request, shipment?.number ?? null);
  const today = TRANSPORT_DEMO_DATE;
  const canDecide = data.can.decide && request.status !== "draft";

  return (
    <div className="task-page">
      <Link href={`${base}/quotes`} className="back-link"><ArrowLeft /> Back to Transport quotes</Link>
      <PageHeader eyebrow="Transport quotes" title={request.number} description={request.kind === "shipment" ? `Quotes for ${shipment?.number ?? "one shipment"}: ${request.material}, ${request.quantityTonnes !== null ? formatTonnes(request.quantityTonnes) : ""}.` : `Quotes for an ongoing transport agreement: ${request.material}.`} icon={Truck} />
      <DemoPeriodNote />

      <section className="card task-card" aria-label="Request">
        <div className="fact-row">
          <div className="fact"><span>Type</span><strong>{request.kind === "shipment" ? "One shipment" : "Transport agreement"}</strong></div>
          <div className="fact"><span>Route</span><strong>{request.from} to {request.to}</strong></div>
          <div className="fact"><span>Service</span><strong>{request.service}</strong></div>
          {request.kind === "shipment" ? <div className="fact"><span>Quantity</span><strong>{request.quantityTonnes !== null ? formatTonnes(request.quantityTonnes) : "—"}</strong></div> : <div className="fact"><span>Agreement dates</span><strong>{request.startDate && request.endDate ? rangeLabel(request.startDate, request.endDate) : "—"}</strong></div>}
          {request.kind === "agreement" ? <div className="fact"><span>Expected quantity (planning estimate)</span><strong>{request.expectedVolume !== null ? `${new Intl.NumberFormat("en-GB").format(request.expectedVolume)} t per ${request.volumePeriod === "agreement" ? "agreement" : "calendar month"}` : "—"}</strong></div> : null}
          <div className="fact"><span>Reply by</span><strong>{formatDemoDateTime(request.replyBy)}</strong></div>
          <div className="fact"><span>Status</span><strong>{requestStatusText(request)}</strong></div>
        </div>
        {request.requirements ? <p><strong>Requirements:</strong> {request.requirements}</p> : null}
        {shipment ? <p className="muted">Shipment <Link className="row-link-text" href={`/shipments/${shipment.id}`}>{shipment.number}</Link>. Collection is still unconfirmed until the provider confirms a time; a quote is not a booking.</p> : null}

        {request.status === "draft" ? (
          <div className="task-section">
            <h2>Send the request</h2>
            <p className="muted">VESPER does not send it. Copy or download the text, send it to each provider yourself, then record that it was sent.</p>
            <pre className="request-text" aria-label="Request text" style={{ whiteSpace: "pre-wrap", background: "#fbfcfb", border: "1px solid #d4dfd8", borderRadius: 10, padding: 14, fontSize: 13 }}>{text}</pre>
            <div className="button-row button-row--end">
              <button className="button button--quiet" onClick={() => { void navigator.clipboard?.writeText(text).then(() => toast({ title: "Request text copied" }), () => toast({ tone: "error", title: "Could not copy", detail: "Select the text and copy it by hand." })); }}><Copy /> Copy text</button>
              <button className="button button--quiet" onClick={() => downloadText(`${request.number}-request.txt`, text)}><Download /> Download</button>
              {data.can.record ? <button className="button button--primary" disabled={sent.isPending} onClick={() => sent.mutate({})}><Send /> <Busy pending={sent.isPending} label="Recording…">Record request sent</Busy></button> : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="card task-card" aria-label="Quotes">
        <h2>Quotes</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Provider</th><th scope="col">Status</th><th scope="col">Price</th><th scope="col">{request.kind === "shipment" ? "Total for this shipment" : "Same footing"}</th><th scope="col">Valid until</th><th scope="col">Next step</th></tr></thead>
            <tbody>
              {request.quotes.map((quote) => {
                const status = quoteStatusNow(quote, today);
                const total = request.kind === "shipment" ? quoteTotal(quote) : null;
                const equivalents = request.kind === "agreement" && quote.method === "fixed_fee" && quote.feePeriod && quote.amount !== null ? feeEquivalents(quote.amount, quote.feePeriod) : null;
                return (
                  <tr key={quote.id}>
                    <td data-label="Provider"><span className="cell-main"><strong>{providerName(data, quote.providerId)}</strong><small>{quote.reference ?? "No reply recorded"}</small></span></td>
                    <td data-label="Status"><StatusBadge value={quoteTone[status]} label={quoteStatusWords[status]} /></td>
                    <td data-label="Price">{quote.amount === null ? <span className="muted">—</span> : <span className="cell-main"><strong>{rateLabel(quote)}</strong><small>{quote.method ? (shipmentPricingMethods as Record<string, string>)[quote.method] ?? (agreementPricingMethods as Record<string, string>)[quote.method] : ""} · {vatWords[quote.vat]}</small></span>}</td>
                    <td data-label="Total">
                      {request.kind === "shipment" ? (total === null ? <span className="muted">{quote.amount === null ? "—" : "Needs the number of loads"}</span> : <strong>{formatRand(total)}</strong>)
                        : equivalents && equivalents.perMonth !== null ? <span className="cell-main"><strong>{formatRand(equivalents.perMonth)} / month</strong><small>{formatRand(equivalents.perYear ?? 0)} / year, plain arithmetic</small></span> : <span className="muted">{quote.amount === null ? "—" : "Not comparable by fee alone"}</span>}
                    </td>
                    <td data-label="Valid until">{quote.validUntil ? dayLabel(quote.validUntil) : "—"}</td>
                    <td data-label="Next step">
                      <span className="row-actions">
                        {data.can.record && request.status !== "draft" && status !== "accepted" && status !== "not_selected" ? <button className="link-button" onClick={() => setRecording(quote)}>{quote.status === "waiting" || quote.status === "unavailable" ? "Record quote" : "Edit quote"}</button> : null}
                        {canDecide && quote.status === "to_review" ? <> · <button className="link-button" onClick={() => setDeciding({ quote, decision: "accept" })}>Record acceptance</button> · <button className="link-button" onClick={() => setDeciding({ quote, decision: "not_selected" })}>Mark not selected</button></> : null}
                        {quote.status === "accepted" && request.kind === "agreement" && data.can.record ? <Link className="row-link-text" href={`${base}/agreements/new?quote=${quote.id}`}>Create agreement</Link> : null}
                        {quote.decision ? <small className="muted"> {quote.status === "accepted" ? "Accepted" : "Not selected"} by {quote.decision.by}, {formatDemoDateTime(quote.decision.at)}: {quote.decision.reason}</small> : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="card__footnote">{request.kind === "shipment" ? "Totals are worked out from the quoted price and this shipment's quantity. A per-load price needs the number of loads." : "Compared on the same footing: the monthly and yearly equivalents are plain arithmetic. A yearly fee is not a discount and does not mean paying in advance. Minimum commitments are only recorded from agreed terms."}</p>
        {request.kind === "shipment" && !data.can.decide ? <div className="note-bar"><Lock /> <span>Accepting or not selecting a quote is for the Mine Manager or the Commercial / Finance Officer.</span></div> : null}
      </section>

      <section className="card task-card" aria-label="History"><h2>History</h2><History lines={request.history} /></section>

      {recording ? <RecordQuoteDialog request={request} quote={recording} data={data} onClose={() => setRecording(null)} /> : null}
      {deciding ? <DecisionDialog request={request} data={data} quote={deciding.quote} decision={deciding.decision} shipmentHasPrice={Boolean(shipment?.pricingSource)} priceLabel={shipment?.pricingSource?.label ?? ""} onClose={() => setDeciding(null)} /> : null}
    </div>
  );
}

function RecordQuoteDialog({ request, quote, data, onClose }: { request: QuoteRequest; quote: Quote; data: Transport; onClose: () => void }) {
  const isShipment = request.kind === "shipment";
  const [unavailable, setUnavailable] = useState(false);
  const [f, setF] = useState({
    reference: quote.reference ?? "", receivedOn: quote.receivedOn ?? TRANSPORT_DEMO_DATE, validUntil: quote.validUntil ?? "",
    method: (quote.method ?? (isShipment ? "per_tonne" : "fixed_fee")) as string, amount: quote.amount === null ? "" : String(quote.amount), feePeriod: quote.feePeriod ?? "month", loads: quote.loads === null ? "" : String(quote.loads),
    includedTonnes: quote.includedTonnes === null ? "" : String(quote.includedTonnes), allowancePeriod: quote.allowancePeriod ?? "calendar_month", billing: quote.billing ?? request.preferredBilling ?? "monthly", excessRate: quote.excessRate === null ? "" : String(quote.excessRate),
    inclusions: quote.inclusions, availability: quote.availability, vat: quote.vat === "not_stated" ? "excluded" : quote.vat, fuelAdjustment: quote.fuelAdjustment, otherCharges: quote.otherCharges, exclusions: quote.exclusions, conditions: unavailable ? "" : quote.conditions,
    reason: "",
  });
  const [attachments, setAttachments] = useState<Attachment[]>(quote.attachments);
  const set = (key: keyof typeof f) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [key]: event.target.value });
  const save = useTransportAction<Record<string, unknown>, QuoteRequest>({ path: `/quote-requests/${request.id}/quotes/${quote.id}`, success: () => ({ title: unavailable ? "Recorded as unavailable" : "Quote recorded", detail: unavailable ? undefined : "It is now waiting to be reviewed. Recording a quote does not accept it." }), onDone: onClose });
  const methods = isShipment ? shipmentPricingMethods : { fixed_fee: agreementPricingMethods.fixed_fee, unit_rate: agreementPricingMethods.unit_rate, fixed_plus_usage: agreementPricingMethods.fixed_plus_usage };
  const submit = () => save.mutate(unavailable ? { unavailable: true, reason: f.reason } : { ...f, attachments });
  return (
    <Dialog title={`Record quote from ${providerName(data, quote.providerId)}`} description={request.number} size="wide" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending} onClick={submit}><Busy pending={save.isPending} label="Saving…">{unavailable ? "Record as unavailable" : "Save quote"}</Busy></button></>}>
      <div className="dialog__stack">
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={unavailable} onChange={(event) => setUnavailable(event.target.checked)} /> This provider cannot quote</label>
        {unavailable ? <Field label="Reason"><textarea rows={3} value={f.reason} onChange={set("reason")} /></Field> : (
          <div className="task-grid task-grid--two">
            <Field label="Quote reference"><input value={f.reference} onChange={set("reference")} /></Field>
            <Field label="Date received"><input type="date" value={f.receivedOn} onChange={set("receivedOn")} /></Field>
            <Field label="Valid until"><input type="date" value={f.validUntil} onChange={set("validUntil")} /></Field>
            <Field label="Pricing method"><Select value={f.method} onChange={set("method")}>{Object.entries(methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label={f.method === "per_tonne" || f.method === "unit_rate" ? "Rate per tonne (R)" : f.method === "per_load" ? "Rate per load (R)" : f.method === "whole_shipment" ? "Price for the shipment (R)" : "Fee (R)"}><input inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
            {f.method === "per_load" ? <Field label="Number of loads" hint="Needed to work out the total."><input inputMode="numeric" value={f.loads} onChange={set("loads")} /></Field> : null}
            {!isShipment && f.method !== "unit_rate" ? <Field label="What the fee covers"><Select value={f.feePeriod} onChange={set("feePeriod")}>{(["month", "year", "agreement"] as const).map((value) => <option key={value} value={value}>Per {periodWords[value]}</option>)}</Select></Field> : null}
            {!isShipment ? <Field label="Included quantity (t)"><input inputMode="decimal" value={f.includedTonnes} onChange={set("includedTonnes")} /></Field> : null}
            {!isShipment ? <Field label="Allowance measured per"><Select value={f.allowancePeriod} onChange={set("allowancePeriod")}>{Object.entries(allowancePeriodWords).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field> : null}
            {!isShipment ? <Field label="Billing"><Select value={f.billing} onChange={set("billing")}>{Object.entries(billingWords).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field> : null}
            {!isShipment ? <Field label="Excess charge per tonne (R)"><input inputMode="decimal" value={f.excessRate} onChange={set("excessRate")} /></Field> : null}
            <Field label="VAT"><Select value={f.vat} onChange={set("vat")}><option value="excluded">Excluding VAT</option><option value="included">Including VAT</option></Select></Field>
            <Field label="What is included" wide><input value={f.inclusions} onChange={set("inclusions")} placeholder="Loading, fuel, tolls" /></Field>
            <Field label="Availability"><input value={f.availability} onChange={set("availability")} /></Field>
            <Field label="Fuel adjustment"><input value={f.fuelAdjustment} onChange={set("fuelAdjustment")} /></Field>
            <Field label="Other charges"><input value={f.otherCharges} onChange={set("otherCharges")} /></Field>
            <Field label="Exclusions"><input value={f.exclusions} onChange={set("exclusions")} /></Field>
            <Field label="Conditions" wide><textarea rows={2} value={f.conditions} onChange={set("conditions")} /></Field>
            <AttachmentInput value={attachments} onChange={setAttachments} label="Quote document" />
          </div>
        )}
      </div>
    </Dialog>
  );
}

function DecisionDialog({ request, data, quote, decision, shipmentHasPrice, priceLabel, onClose }: { request: QuoteRequest; data: Transport; quote: Quote; decision: "accept" | "not_selected"; shipmentHasPrice: boolean; priceLabel: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [replace, setReplace] = useState(false);
  const replaces = decision === "accept" && request.kind === "shipment" && shipmentHasPrice;
  const save = useTransportAction<Record<string, unknown>, QuoteRequest>({
    path: `/quote-requests/${request.id}/quotes/${quote.id}/decision`,
    success: () => ({ title: decision === "accept" ? "Acceptance recorded" : "Marked not selected", detail: decision === "accept" && request.kind === "shipment" ? "The shipment now uses this quote for its transport cost. Collection is still not booked until the provider confirms." : undefined }),
    onDone: onClose,
  });
  const name = providerName(data, quote.providerId);
  return (
    <Dialog title={decision === "accept" ? `Record acceptance of ${name}'s quote` : `Mark ${name}'s quote not selected`} description="Who, when and why are kept with the record." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || reason.trim().length < 5 || (replaces && !replace)} onClick={() => save.mutate({ decision, reason, replace: replaces ? replace : undefined })}><Busy pending={save.isPending} label="Saving…">{decision === "accept" ? "Record acceptance" : "Mark not selected"}</Busy></button></>}>
      <div className="dialog__stack">
        {decision === "accept" ? <p className="muted">{request.kind === "shipment" ? "This becomes the shipment's one transport price. It does not book a truck: collection stays unconfirmed until the provider confirms a time." : "You can then create the agreement from this proposal. An authorised person reviews and activates it."}</p> : null}
        {replaces ? <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /> <span>This shipment already has a transport price ({priceLabel}). Replace it with this quote. The earlier source stays in the shipment&apos;s history.</span></label> : null}
        <Field label="Reason (required)"><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

// ---- New quote request ---------------------------------------------------------------------------------------------------

export function NewQuoteRequestScreen() {
  return <WithTransport>{(data) => <NewQuoteRequestView data={data} />}</WithTransport>;
}

function NewQuoteRequestView({ data }: { data: Transport }) {
  const base = useTransportBase();
  const router = useRouter();
  const params = useSearchParams();
  const logistics = useLogistics();
  const [kind, setKind] = useState<"shipment" | "agreement">(params.get("kind") === "agreement" ? "agreement" : "shipment");
  const approved = data.providers.filter((item) => item.approval === "approved");
  const shipments = (logistics.data?.shipments ?? []).filter((item) => ["preparing", "declined", "waiting", "confirmed"].includes(item.state));
  const [shipmentId, setShipmentId] = useState(params.get("shipment") ?? "");
  const shipment = shipments.find((item) => item.id === shipmentId) ?? null;
  const [chosen, setChosen] = useState<string[]>(() => (params.get("provider") ? [String(params.get("provider"))] : []));
  const [replyBy, setReplyBy] = useState("2026-04-27T16:00");
  const [requirements, setRequirements] = useState("");
  const [service, setService] = useState("Road · Bulk tipper · Multiple loads");
  const [agreement, setAgreement] = useState({ material: "Coal", from: "Riverside Mine", to: "", startDate: "2026-05-01", endDate: "2027-04-30", expectedVolume: "", volumePeriod: "calendar_month", preferredBilling: "monthly" });
  const submission = useSubmissionId();
  const create = useTransportAction<Record<string, unknown>, QuoteRequest>({
    path: "/quote-requests",
    success: (item) => ({ title: "Draft saved", detail: `${item.number} is a draft. Send it to the providers, then record that it was sent.` }),
    onDone: (item) => router.push(`${base}/quotes/${item.id}`),
  });
  if (!data.terms || !data.can.record) return <div className="task-page"><ProviderTabs active="quotes" /><LockedTerms /></div>;
  const toggle = (id: string) => setChosen(chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id]);
  const ready = chosen.length > 0 && replyBy.length >= 16 && (kind === "shipment" ? Boolean(shipment) : agreement.to.trim().length >= 3 && Number(agreement.expectedVolume) > 0);
  const submit = () => create.mutate({ kind, providerIds: chosen, replyBy, requirements, service, submissionId: submission.id, ...(kind === "shipment" ? { shipmentId } : { ...agreement, expectedVolume: Number(agreement.expectedVolume) }) });
  const setA = (key: keyof typeof agreement) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAgreement({ ...agreement, [key]: event.target.value });

  return (
    <div className="task-page">
      <Link href={`${base}/quotes`} className="back-link"><ArrowLeft /> Back to Transport quotes</Link>
      <PageHeader eyebrow="Transport quotes" title="New quote request" description="Ask approved providers to quote. Saving creates a draft; nothing is sent from VESPER." icon={Truck} />
      <section className="card task-card" aria-label="Quote request">
        <nav className="tabs" aria-label="Request type">
          <button className={`tab ${kind === "shipment" ? "tab--active" : ""}`} onClick={() => setKind("shipment")} aria-pressed={kind === "shipment"}>One shipment</button>
          <button className={`tab ${kind === "agreement" ? "tab--active" : ""}`} onClick={() => setKind("agreement")} aria-pressed={kind === "agreement"}>Transport agreement</button>
        </nav>
        {kind === "shipment" ? (
          <div className="task-grid task-grid--two">
            <Field label="Shipment" hint="Details are filled in from the shipment."><Select value={shipmentId} onChange={(event) => setShipmentId(event.target.value)}><option value="">Choose a shipment</option>{shipments.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.mineral} · {formatTonnes(item.tonnes)} · {item.destination}</option>)}</Select></Field>
            {shipment ? (
              <div className="fact-row" style={{ gridColumn: "1 / -1" }}>
                <div className="fact"><span>Material</span><strong>{shipment.mineral}</strong></div>
                <div className="fact"><span>Quantity</span><strong>{formatTonnes(shipment.tonnes)}</strong></div>
                <div className="fact"><span>Collection point</span><strong>Riverside Mine</strong></div>
                <div className="fact"><span>Destination</span><strong>{shipment.destination}</strong></div>
                <div className="fact"><span>Collection window</span><strong>{shortDate(shipment.preferredDate)}</strong></div>
              </div>
            ) : null}
            <Field label="Service" wide><input value={service} onChange={(event) => setService(event.target.value)} /></Field>
          </div>
        ) : (
          <div className="task-grid task-grid--two">
            <Field label="Material"><input value={agreement.material} onChange={setA("material")} /></Field>
            <Field label="Collection point"><input value={agreement.from} onChange={setA("from")} /></Field>
            <Field label="Destination"><input value={agreement.to} onChange={setA("to")} placeholder="Rail Siding B" /></Field>
            <Field label="Service"><input value={service} onChange={(event) => setService(event.target.value)} placeholder="Road transport" /></Field>
            <Field label="Start date"><input type="date" value={agreement.startDate} onChange={setA("startDate")} /></Field>
            <Field label="End date"><input type="date" value={agreement.endDate} onChange={setA("endDate")} /></Field>
            <Field label="Expected quantity (t)" hint="A planning estimate, not a commitment."><input inputMode="decimal" value={agreement.expectedVolume} onChange={setA("expectedVolume")} /></Field>
            <Field label="Per"><Select value={agreement.volumePeriod} onChange={setA("volumePeriod")}>{Object.entries(allowancePeriodWords).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Preferred billing"><Select value={agreement.preferredBilling} onChange={setA("preferredBilling")}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></Select></Field>
          </div>
        )}
        <div className="task-section">
          <h2>Providers to ask</h2>
          {approved.length === 0 ? <p className="muted">No approved providers yet. The Mine Manager approves providers first.</p> : (
            <ul className="check-list">
              {approved.map((item) => <li key={item.id}><label style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}><input type="checkbox" checked={chosen.includes(item.id)} onChange={() => toggle(item.id)} />{item.name} <small className="muted">{item.mode}{item.areasServed.length > 0 ? ` · ${item.areasServed.join(", ")}` : ""}</small></label></li>)}
            </ul>
          )}
        </div>
        <div className="task-grid task-grid--two">
          <Field label="Reply needed by"><input type="datetime-local" value={replyBy} onChange={(event) => setReplyBy(event.target.value)} /></Field>
          <Field label="Requirements" wide><textarea rows={3} maxLength={800} value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="Fuel included, loading assistance, insurance cover" /></Field>
        </div>
        <div className="task-footer">
          <p>Saves a draft. You then copy or download the text, send it yourself and record that it was sent.</p>
          <div className="button-row"><button className="button button--primary" disabled={!ready || create.isPending} onClick={submit}><Busy pending={create.isPending} label="Saving…">Save draft</Busy></button></div>
        </div>
      </section>
    </div>
  );
}
