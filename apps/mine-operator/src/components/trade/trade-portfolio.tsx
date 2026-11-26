"use client";

/**
 * Portfolio: the mine's commercial clients (customers and counterparties). Their agreements, committed and accepted tonnes, balances
 * and contacts. No subscription tiers or recurring-revenue figures: these are buyers of ore, not software customers.
 */
import { Building2, CirclePlus, FileText, Globe, Layers, Mail, MapPin, Phone, Target, Trash2, Truck, UserPlus, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientSegments, formatTonnes } from "@/lib/trade-rules";
import { Dialog } from "../dialog";
import { Field } from "../form-field";
import { EmptyState } from "../query-state";
import { Select } from "../select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type ClientRow, type TradeView } from "../use-trade";
import { AgreementStatus, ApprovalStatus, ClientStatus, DeliveryStatus, DocumentStatus, EnquiryStage, Readiness, SettlementStatus } from "./trade-status";
import { ActionMenu, CellMain, Crumbs, dayLabel, KpiTiles, Money, Progress, RailCard, RailList, Register, TabBar, TradeData, TradeHeader } from "./trade-ui";
import { Busy } from "../busy";

export function PortfolioScreen() {
  return <TradeData label="Loading the portfolio">{(data) => <Portfolio data={data} />}</TradeData>;
}

function Portfolio({ data }: { data: TradeView }) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [segment, setSegment] = useState("");
  const clients = data.clients;
  const active = clients.filter((item) => item.status === "active");
  const preview = clients.find((item) => item.id === selected) ?? [...active].sort((a, b) => b.committed - a.committed)[0];
  const outstanding = data.can.pricing ? clients.reduce((total, item) => total + (item.outstanding ?? 0), 0) : null;
  const committed = active.reduce((total, item) => total + item.committed, 0);
  const accepted = active.reduce((total, item) => total + item.accepted, 0);

  return (
    <div className="workspace-page trade-page">
      <TradeHeader eyebrow="Portfolio · Clients" title="Clients" description="The mine's customers and counterparties: their agreements, fulfilment and balances." icon={Layers}
        actions={data.can.manageClients ? <button className="button button--primary" onClick={() => setAdding(true)}><CirclePlus /> Add client</button> : undefined} />
      <KpiTiles items={[
        { label: "Total clients", value: clients.length, hint: `${clients.filter((item) => item.status === "onboarding").length} onboarding`, icon: UsersRound },
        { label: "Active clients", value: active.length, hint: `${clients.filter((item) => item.status === "on_hold").length} on hold`, icon: Building2 },
        { label: "Committed volume", value: formatTonnes(committed), hint: "Active agreements", icon: Layers },
        { label: "Accepted so far", value: formatTonnes(accepted), hint: `${committed ? Math.round((accepted / committed) * 100) : 0}% of committed`, icon: Target },
        { label: "Outstanding balance", value: <Money value={outstanding} />, hint: `${clients.reduce((total, item) => total + item.overdue, 0)} overdue invoices`, icon: Wallet },
      ]} />
      <div className="trade-layout">
        <Register<ClientRow>
          title="Client portfolio"
          noun="clients"
          rows={clients}
          searchLabel="Search clients"
          search={(row) => [row.name, row.code, row.segment, row.city, row.accountOwner].join(" ")}
          href={(row) => `/trade/portfolio/${row.id}`}
          chips={[
            { key: "active", label: "Active", test: (row) => row.status === "active" },
            { key: "onboarding", label: "Onboarding", test: (row) => row.status === "onboarding" },
            { key: "at_risk", label: "At risk", test: (row) => row.atRisk || row.overdue > 0 },
            { key: "on_hold", label: "On hold", test: (row) => row.status === "on_hold" },
            { key: "inactive", label: "Inactive", test: (row) => row.status === "inactive" },
          ]}
          extra={{
            controls: <label className="trade-select"><span className="sr-only">Segment</span><Select value={segment} onChange={(event) => setSegment(event.target.value)}><option value="">All segments</option>{clientSegments.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>,
            test: (row) => !segment || row.segment === segment,
            active: Boolean(segment),
            clear: () => setSegment(""),
          }}
          initialSort={{ key: "client", direction: "asc" }}
          columns={[
            { key: "client", label: "Client", sort: (row) => row.name, render: (row) => <CellMain title={row.name} detail={`${row.segment} · ${row.city}`} /> },
            { key: "status", label: "Status", sort: (row) => row.status, render: (row) => <ClientStatus client={row} /> },
            { key: "agreements", label: "Agreements", sort: (row) => row.activeAgreements, render: (row) => row.activeAgreements },
            { key: "committed", label: "Committed", sort: (row) => row.committed, render: (row) => (row.committed ? formatTonnes(row.committed) : <span className="muted">None active</span>) },
            { key: "fulfilment", label: "Accepted of due", sort: (row) => row.dueShare ?? -1, render: (row) => (row.dueShare !== null ? <Progress share={row.dueShare} label={`${Math.round(row.dueShare * 100)}% of the tonnes due so far accepted`} /> : <span className="muted">Nothing due yet</span>) },
            { key: "outstanding", label: "Outstanding", sort: (row) => row.outstanding ?? 0, align: "end", render: (row) => <Money value={row.outstanding} /> },
          ]}
          actions={(row) => <button className="button button--quiet button--small" aria-label={`Preview ${row.name}`} aria-pressed={preview?.id === row.id} onClick={() => setSelected(row.id)}>Preview</button>}
          empty={{ title: "No clients yet", body: "Add the mine's first customer to start recording enquiries and agreements." }}
        />
        <aside className="trade-rail" aria-label="Client preview">
          {preview ? <ClientPreview client={preview} data={data} /> : null}
        </aside>
      </div>
      {adding ? <ClientDialog data={data} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function ClientPreview({ client, data }: { client: ClientRow; data: TradeView }) {
  return (
    <RailCard title={client.name} label={`Preview of ${client.name}`}>
      <div className="trade-preview">
        <div className="trade-preview__status"><ClientStatus client={client} /><span className="muted">{client.segment}</span></div>
        <dl className="trade-preview__facts">
          <div><dt><MapPin aria-hidden="true" /> Location</dt><dd>{client.city}, {client.country}</dd></div>
          <div><dt><Mail aria-hidden="true" /> Email</dt><dd>{client.email}</dd></div>
          <div><dt><Phone aria-hidden="true" /> Phone</dt><dd>{client.phone || "Not recorded"}</dd></div>
          <div><dt><UsersRound aria-hidden="true" /> Account owner</dt><dd>{client.accountOwner}</dd></div>
        </dl>
        <h3>Commercial position</h3>
        <dl className="trade-preview__metrics">
          <div><dt>Active agreements</dt><dd>{client.activeAgreements}</dd></div>
          <div><dt>Committed</dt><dd>{formatTonnes(client.committed)}</dd></div>
          <div><dt>Accepted</dt><dd>{formatTonnes(client.accepted)}</dd></div>
          <div><dt>Outstanding</dt><dd><Money value={client.outstanding} /></dd></div>
          <div><dt>Credit limit</dt><dd><Money value={client.creditLimit} /></dd></div>
          <div><dt>Next agreement end</dt><dd>{client.nextEnd ? dayLabel(client.nextEnd) : "—"}</dd></div>
        </dl>
        {client.notes ? <p className="note-bar"><span>{client.notes}</span></p> : null}
        <Link className="button button--quiet trade-preview__open" href={`/trade/portfolio/${client.id}`}>View full profile</Link>
        <span className="sr-only">{data.clients.length} clients in the portfolio</span>
      </div>
    </RailCard>
  );
}

// ---- Client detail ---------------------------------------------------------------------------------------------------------

type ClientTab = "overview" | "agreements" | "deliveries" | "settlements" | "enquiries" | "documents" | "operations";

export function ClientScreen({ id }: { id: string }) {
  return <TradeData label="Loading the client" variant="detail">{(data) => {
    const client = data.clients.find((item) => item.id === id);
    if (!client) return <div className="workspace-page"><Crumbs items={[{ label: "Portfolio", href: "/trade/portfolio" }, { label: "Not found" }]} /><EmptyState title="This client could not be found" description="It may have been removed, or the link is wrong." /></div>;
    return <ClientDetail data={data} client={client} />;
  }}</TradeData>;
}

function ClientDetail({ data, client }: { data: TradeView; client: ClientRow }) {
  const [tab, setTab] = useState<ClientTab>("overview");
  const [dialog, setDialog] = useState<null | "edit" | "status" | "contact">(null);
  const removeContact = useTradeAction<{ contactId: string }>({ path: (input) => `/trade/clients/${client.id}/contacts/${input.contactId}`, method: "DELETE", success: () => ({ title: "Contact removed" }) });
  const agreements = data.agreements.filter((item) => item.clientId === client.id);
  const deliveries = data.deliveries.filter((item) => item.clientId === client.id);
  const settlements = data.settlements.filter((item) => item.clientId === client.id);
  const enquiries = data.enquiries.filter((item) => item.clientId === client.id);
  const documents = data.documents.filter((item) => item.clientId === client.id);
  const links = data.links.filter((item) => item.clientId === client.id);
  const approvals = data.approvals.filter((item) => item.clientId === client.id);
  const activity = [
    ...client.history.map((item) => ({ ...item, icon: Building2, source: "Client" })),
    ...agreements.flatMap((agreement) => agreement.history.map((item) => ({ ...item, icon: FileText, source: agreement.number }))),
    ...deliveries.flatMap((delivery) => delivery.history.map((item) => ({ ...item, icon: Truck, source: delivery.number }))),
    ...settlements.flatMap((settlement) => settlement.history.map((item) => ({ ...item, icon: Wallet, source: settlement.invoiceNumber }))),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  return (
    <div className="workspace-page trade-page">
      <Crumbs items={[{ label: "Portfolio", href: "/trade/portfolio" }, { label: "Clients", href: "/trade/portfolio" }, { label: client.name }]} />
      <header className="trade-detail-head">
        <span className="trade-detail-head__mark" aria-hidden="true">{client.code}</span>
        <div className="trade-detail-head__copy">
          <h1>{client.name} <ClientStatus client={client} /></h1>
          <p>{client.segment} · client since {dayLabel(client.since)}</p>
          <p className="trade-detail-head__meta"><span><MapPin aria-hidden="true" /> {client.city}, {client.country}</span><span><Globe aria-hidden="true" /> {client.website || "No website"}</span><span>Reg. {client.registration || "not recorded"}</span></p>
        </div>
        <dl className="trade-detail-head__figures">
          <div><dt>Active agreements</dt><dd>{client.activeAgreements}</dd></div>
          <div><dt>Outstanding</dt><dd><Money value={client.outstanding} /></dd></div>
          <div><dt>Accepted of due</dt><dd>{client.dueShare !== null ? `${Math.round(client.dueShare * 100)}%` : "—"}</dd></div>
        </dl>
        <ActionMenu label={`Actions for ${client.name}`} actions={[
          { label: "Edit details", onClick: () => setDialog("edit"), hidden: !data.can.manageClients },
          { label: "Change status", onClick: () => setDialog("status"), hidden: !data.can.manageClients },
          { label: "Add contact", onClick: () => setDialog("contact"), hidden: !data.can.manageClients },
          { label: "Log an enquiry", href: `/trade/enquiries?new=${client.id}`, hidden: !data.can.manageClients || client.status === "inactive" },
          { label: "New agreement", href: `/trade/agreements/new?client=${client.id}`, hidden: !data.can.manageAgreements || client.status === "inactive" },
        ]} />
      </header>
      {client.notes ? <div className="note-bar" role="status"><span>{client.notes}</span></div> : null}

      <TabBar<ClientTab> label="Client sections" active={tab} onChange={setTab} tabs={[
        { key: "overview", label: "Overview" },
        { key: "agreements", label: "Agreements", count: agreements.length },
        { key: "deliveries", label: "Deliveries", count: deliveries.length },
        { key: "settlements", label: "Settlements", count: settlements.length },
        { key: "enquiries", label: "Enquiries", count: enquiries.length },
        { key: "documents", label: "Documents", count: documents.length },
        { key: "operations", label: "Linked Operations", count: links.length },
      ]} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" ? (
          <div className="trade-detail-grid">
            <RailCard title="Client information">
              <dl className="trade-definitions">
                <div><dt>Client name</dt><dd>{client.name}</dd></div>
                <div><dt>Segment</dt><dd>{client.segment}</dd></div>
                <div><dt>Email</dt><dd>{client.email}</dd></div>
                <div><dt>Phone</dt><dd>{client.phone || "Not recorded"}</dd></div>
                <div><dt>Payment terms</dt><dd>{client.paymentTermsDays} days</dd></div>
                <div><dt>Credit limit</dt><dd><Money value={client.creditLimit} /></dd></div>
                <div><dt>Account owner</dt><dd>{client.accountOwner}</dd></div>
              </dl>
            </RailCard>
            <RailCard title={`Key contacts (${client.contacts.length})`} action={data.can.manageClients ? { label: "Add contact", onClick: () => setDialog("contact") } : undefined}>
              {client.contacts.length === 0 ? <p className="muted trade-rail-empty">No contacts recorded.</p> : (
                <ul className="trade-contacts">
                  {client.contacts.map((contact) => (
                    <li key={contact.id}>
                      <span className="avatar">{contact.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                      <span className="trade-contacts__copy"><strong>{contact.name}</strong><small>{contact.role}</small></span>
                      <a className="icon-button icon-button--light" href={`mailto:${contact.email}`} aria-label={`Email ${contact.name}`}><Mail /></a>
                      {contact.phone ? <a className="icon-button icon-button--light" href={`tel:${contact.phone.replace(/\s/g, "")}`} aria-label={`Call ${contact.name}`}><Phone /></a> : null}
                      {data.can.manageClients ? <button className="icon-button icon-button--light" aria-label={`Remove ${contact.name}`} disabled={removeContact.isPending} onClick={() => removeContact.mutate({ contactId: contact.id })}><Trash2 /></button> : null}
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>
            <RailCard title="Recent activity">
              <RailList empty="No activity yet." items={activity.map((item) => ({ key: item.id + item.source, icon: item.icon, title: item.summary, detail: `${item.source} · ${item.actor}`, aside: dayLabel(item.at) }))} />
            </RailCard>
            <RailCard title="Active agreements" action={{ label: "View all", href: `/trade/agreements?client=${client.id}` }}>
              <RailList empty="No active agreements." items={agreements.filter((item) => item.status === "active").map((item) => ({ key: item.id, icon: FileText, title: `${item.number} · ${item.title}`, detail: `${formatTonnes(item.accepted)} of ${formatTonnes(item.committed)} accepted`, aside: <AgreementStatus agreement={item} />, href: `/trade/agreements/${item.id}` }))} />
            </RailCard>
            <RailCard title="Pending approvals">
              <RailList empty="Nothing waiting for approval." items={approvals.filter((item) => item.status === "pending").map((item) => ({ key: item.id, title: `${item.number} · ${item.description}`, detail: `Asked by ${item.submittedBy}`, aside: <ApprovalStatus approval={item} />, href: "/trade/approvals" }))} />
            </RailCard>
          </div>
        ) : null}
        {tab === "agreements" ? <MiniTable rows={agreements} empty="No agreements with this client." head={["Agreement", "Commodity", "Committed", "Accepted", "Status", "End date"]} render={(item) => [<Link key="a" className="row-link-text" href={`/trade/agreements/${item.id}`}>{item.number}</Link>, item.commodity, formatTonnes(item.committed), <Progress key="p" share={item.share} />, <AgreementStatus key="s" agreement={item} />, dayLabel(item.endDate)]} /> : null}
        {tab === "deliveries" ? <MiniTable rows={deliveries} empty="No deliveries for this client." head={["Delivery", "Agreement", "Planned", "Accepted", "Status", "Scheduled"]} render={(item) => [<Link key="a" className="row-link-text" href={`/trade/deliveries/${item.id}`}>{item.number}</Link>, item.agreementNumber, formatTonnes(item.tonnes), formatTonnes(item.quantities.accepted), <DeliveryStatus key="s" delivery={item} />, dayLabel(item.scheduledDate)]} /> : null}
        {tab === "settlements" ? <MiniTable rows={settlements} empty="No invoices for this client." head={["Invoice", "Agreement", "Amount", "Balance", "Status", "Due"]} render={(item) => [<Link key="a" className="row-link-text" href={`/trade/settlements?focus=${item.id}`}>{item.invoiceNumber}</Link>, item.agreementNumber, <Money key="m" value={item.amount} />, <Money key="b" value={item.balance} />, <SettlementStatus key="s" settlement={item} />, dayLabel(item.dueDate)]} /> : null}
        {tab === "enquiries" ? <MiniTable rows={enquiries} empty="No enquiries from this client." head={["Enquiry", "Commodity", "Quantity", "Window", "Stage", "Owner"]} render={(item) => [<Link key="a" className="row-link-text" href={`/trade/enquiries?open=${item.id}`}>{item.number}</Link>, item.commodity, formatTonnes(item.tonnes), item.deliveryWindow, <EnquiryStage key="s" enquiry={item} />, item.owner]} /> : null}
        {tab === "documents" ? <MiniTable rows={documents} empty={data.hiddenDocuments ? "No documents you can see for this client." : "No documents for this client."} head={["Document", "Type", "Reference", "Updated", "Status"]} render={(item) => [item.name, item.kind, item.reference, dayLabel(item.uploadedAt), <DocumentStatus key="s" document={item} />]} /> : null}
        {tab === "operations" ? <MiniTable rows={links} empty="No operations linked to this client's agreements." head={["Link", "Agreement", "Workstream", "Area", "Readiness"]} render={(item) => [item.number, item.agreementNumber, item.workstream, item.area.name, <Readiness key="r" link={item} />]} /> : null}
      </div>

      {dialog === "edit" ? <ClientDialog data={data} client={client} onClose={() => setDialog(null)} /> : null}
      {dialog === "status" ? <ClientStatusDialog client={client} onClose={() => setDialog(null)} /> : null}
      {dialog === "contact" ? <ContactDialog client={client} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

export function MiniTable<T extends { id: string }>({ rows, head, render, empty }: { rows: T[]; head: string[]; render: (row: T) => React.ReactNode[]; empty: string }) {
  if (rows.length === 0) return <section className="card trade-mini-empty"><p className="muted">{empty}</p></section>;
  return (
    <section className="card register-card">
      <div className="table-wrap">
        <table className="data-table data-table--register">
          <thead><tr>{head.map((item) => <th key={item} scope="col">{item}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>{render(row).map((cell, index) => <td key={head[index]} data-label={head[index]}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

// ---- Dialogs ---------------------------------------------------------------------------------------------------------------

function ClientDialog({ data, client, onClose }: { data: TradeView; client?: ClientRow; onClose: () => void }) {
  const router = useRouter();
  const submission = useSubmissionId();
  const [form, setForm] = useState({
    name: client?.name ?? "", registration: client?.registration ?? "", segment: client?.segment ?? clientSegments[0], city: client?.city ?? "", country: client?.country ?? "South Africa",
    email: client?.email ?? "", phone: client?.phone ?? "", website: client?.website ?? "", accountOwner: client?.accountOwner ?? data.actor.name,
    paymentTermsDays: String(client?.paymentTermsDays ?? 30), creditLimit: client?.creditLimit != null ? String(client.creditLimit) : "", notes: client?.notes ?? "", contactName: "", contactRole: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useTradeAction<Record<string, unknown>, { id: string }>({
    path: client ? `/trade/clients/${client.id}` : "/trade/clients",
    method: client ? "PATCH" : "POST",
    success: () => ({ title: client ? "Client updated" : "Client added", detail: client ? undefined : "The client starts as onboarding until you make it active." }),
    onDone: (result) => { onClose(); if (!client) router.push(`/trade/portfolio/${result.id}`); },
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value });
  const submit = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter the client's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.city.trim().length < 2) next.city = "Enter the city.";
    const terms = Number(form.paymentTermsDays);
    if (!Number.isInteger(terms) || terms < 0 || terms > 120) next.paymentTermsDays = "Between 0 and 120 days.";
    if (form.creditLimit && !(Number(form.creditLimit) > 0)) next.creditLimit = "Enter an amount, or leave it empty.";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({ ...form, paymentTermsDays: terms, creditLimit: form.creditLimit ? Number(form.creditLimit) : null, submissionId: client ? undefined : submission.id, version: client?.version });
  };
  return (
    <Dialog title={client ? `Edit ${client.name}` : "Add client"} description="A customer or counterparty of the mine." size="wide" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" onClick={submit} disabled={save.isPending}><Busy pending={save.isPending} label="Saving…">{client ? "Save changes" : "Add client"}</Busy></button></>}>
      <div className="form-grid">
        <Field label="Client name" error={errors.name}><input value={form.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} data-autofocus /></Field>
        <Field label="Registration number"><input value={form.registration} onChange={set("registration")} /></Field>
        <Field label="Segment"><Select value={form.segment} onChange={set("segment")}>{clientSegments.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <Field label="Account owner"><input value={form.accountOwner} onChange={set("accountOwner")} /></Field>
        <Field label="City" error={errors.city}><input value={form.city} onChange={set("city")} aria-invalid={Boolean(errors.city)} /></Field>
        <Field label="Country"><input value={form.country} onChange={set("country")} /></Field>
        <Field label="Email address" error={errors.email}><input type="email" value={form.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Website"><input value={form.website} onChange={set("website")} /></Field>
        <Field label="Payment terms (days)" error={errors.paymentTermsDays}><input inputMode="numeric" value={form.paymentTermsDays} onChange={set("paymentTermsDays")} /></Field>
        {data.can.pricing ? <Field label="Credit limit (R)" error={errors.creditLimit} hint="Optional"><input inputMode="decimal" value={form.creditLimit} onChange={set("creditLimit")} /></Field> : null}
        {!client ? <><Field label="Main contact"><input value={form.contactName} onChange={set("contactName")} /></Field><Field label="Contact's role"><input value={form.contactRole} onChange={set("contactRole")} /></Field></> : null}
        <Field label="Notes" wide><textarea rows={3} value={form.notes} onChange={set("notes")} /></Field>
      </div>
    </Dialog>
  );
}

function ClientStatusDialog({ client, onClose }: { client: ClientRow; onClose: () => void }) {
  const [status, setStatus] = useState<string>(client.status === "active" ? "on_hold" : "active");
  const [note, setNote] = useState("");
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/clients/${client.id}/status`, success: () => ({ title: "Client status changed" }), onDone: onClose });
  const needsReason = status === "on_hold" || status === "inactive";
  return (
    <Dialog title={`Change status of ${client.name}`} size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={save.isPending || status === client.status || (needsReason && note.trim().length < 5)} onClick={() => save.mutate({ status, note, version: client.version })}><Busy pending={save.isPending} label="Saving…">Change status</Busy></button></>}>
      <Field label="New status"><Select value={status} onChange={(event) => setStatus(event.target.value)}>{["active", "onboarding", "on_hold", "inactive"].map((item) => <option key={item} value={item} disabled={item === client.status}>{{ active: "Active", onboarding: "Onboarding", on_hold: "On hold", inactive: "Inactive" }[item]}</option>)}</Select></Field>
      <Field label={needsReason ? "Why? (required)" : "Note (optional)"}><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </Dialog>
  );
}

function ContactDialog({ client, onClose }: { client: ClientRow; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const save = useTradeAction<Record<string, unknown>>({ path: `/trade/clients/${client.id}/contacts`, success: () => ({ title: "Contact added" }), onDone: onClose });
  const submit = () => {
    if (form.name.trim().length < 2) return setError("Enter the contact's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    setError(null);
    save.mutate(form);
  };
  return (
    <Dialog title={`Add a contact at ${client.name}`} size="narrow" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" onClick={submit} disabled={save.isPending}><UserPlus /> <Busy pending={save.isPending} label="Saving…">Add contact</Busy></button></>}>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-autofocus /></Field>
      <Field label="Role"><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></Field>
      <Field label="Email address"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
      <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
    </Dialog>
  );
}

