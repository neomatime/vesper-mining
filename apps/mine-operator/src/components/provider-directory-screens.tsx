"use client";

/**
 * Manage Service Providers: the directory of repair and maintenance providers for equipment and infrastructure, and one provider's page.
 * Opened from Equipment & Maintenance > Assets. Approved providers are the only ones offered when an external repair is requested;
 * pending and inactive providers are kept but cannot be given new work. A provider that any repair request refers to is never deleted:
 * it is deactivated, so its history stays whole. Providers here are fictional demonstration records.
 */
import type { ServiceProvider } from "@vesper/api-contracts";
import { ArrowLeft, ChevronLeft, ChevronRight, CirclePlus, Ellipsis, Filter, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { categoryLabels } from "@/lib/equipment-rules";
import { approvalLabel, approvalStatusLabels, approvalStatusTone, canApproveProviders, canManageProviders, isApproved, requestStatusLabels, responseLabel } from "@/lib/service-rules";
import { useDemoContext } from "@/stores/demo-context";
import { ConfirmDialog, Dialog } from "./dialog";
import { Field } from "./form-field";
import { PageHeader } from "./page-header";
import { ProviderDialog } from "./provider-dialogs";
import { ErrorState, LoadingState } from "./query-state";
import { Select } from "./select";
import { StatusBadge } from "./status-badge";
import { useProviderDetail, useProviderMutations, useProviders, type ProviderDetail, type ProviderInput } from "./use-service";
import { useDismiss } from "./use-dismiss";
import { useShellData } from "./shell-data";
import { Busy } from "./busy";

const PAGE_SIZE = 5;

const useActor = () => {
  const { context } = useDemoContext();
  return { name: context.persona, role: context.role };
};

function Breadcrumb({ current, middle }: { current: string; middle?: { label: string; href: string } }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link href={middle ? middle.href : "/equipment"} aria-label="Back"><ArrowLeft aria-hidden="true" /></Link>
      <Link href="/equipment">Equipment &amp; Maintenance</Link>
      {middle ? <><span aria-hidden="true">/</span><Link href={middle.href}>{middle.label}</Link></> : null}
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}

/** What a provider is called in the table: the status, with an expired approval shown as such rather than as current. */
function StatusCell({ provider, today }: { provider: ServiceProvider; today: string }) {
  if (provider.approval === "approved" && !isApproved(provider, today)) return <StatusBadge value="at_risk" label="Approval expired" />;
  return <StatusBadge value={approvalStatusTone[provider.approval]} label={approvalStatusLabels[provider.approval]} />;
}

// ---- The directory -----------------------------------------------------------------------------------------------------

export function ProviderDirectoryScreen() {
  const providers = useProviders();
  const { data: shell } = useShellData();
  const actor = useActor();
  const manage = canManageProviders(actor).allowed;
  const approve = canApproveProviders(actor).allowed;
  const actions = useProviderMutations();
  const [search, setSearch] = useState("");
  const [specialisation, setSpecialisation] = useState("");
  const [status, setStatus] = useState("");
  const [area, setArea] = useState("");
  const [maxHours, setMaxHours] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ provider?: ServiceProvider } | null>(null);
  const [asking, setAsking] = useState<{ provider: ServiceProvider; approval: "approved" | "inactive" | "pending" } | null>(null);
  const [deleting, setDeleting] = useState<ServiceProvider | null>(null);
  const today = shell?.now ?? "";

  const all = useMemo(() => [...(providers.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [providers.data]);
  const areas = useMemo(() => Array.from(new Set(all.flatMap((item) => item.serviceAreas))).sort(), [all]);
  const specialisations = useMemo(() => Array.from(new Set(all.flatMap((item) => item.categories))).sort((a, b) => categoryLabels[a].localeCompare(categoryLabels[b])), [all]);

  if (providers.isPending) return <LoadingState />;
  if (providers.isError && !providers.data) return <ErrorState message={providers.error.message} onRetry={() => providers.refetch()} retrying={providers.isFetching} />;

  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = all.filter((item) => {
    if (specialisation && !item.categories.includes(specialisation as ServiceProvider["categories"][number])) return false;
    if (status && item.approval !== status) return false;
    if (area && !item.serviceAreas.includes(area)) return false;
    if (maxHours && !(item.responseHours !== null && item.responseHours <= Number(maxHours))) return false;
    const text = [item.name, item.registration, item.contactName, item.specialisation, item.serviceAreas.join(" "), item.categories.map((value) => categoryLabels[value]).join(" "), approvalStatusLabels[item.approval]].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  const filtering = Boolean(search.trim() || specialisation || status || area || maxHours);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const count = (value: ServiceProvider["approval"]) => all.filter((item) => item.approval === value).length;
  const expired = all.filter((item) => item.approval === "approved" && !isApproved(item, today)).length;
  const clear = () => { setSearch(""); setSpecialisation(""); setStatus(""); setArea(""); setMaxHours(""); setPage(1); };

  return (
    <div className="workspace-page">
      <Breadcrumb current="Manage Service Providers" />
      <PageHeader
        eyebrow="Service providers"
        title="Manage Service Providers"
        description="Maintain approved service providers for equipment and infrastructure repairs and maintenance."
        action={manage ? <button className="button button--primary" onClick={() => setForm({})}><CirclePlus /> Add Service Provider</button> : undefined}
      />

      <section className="kpi-row" aria-label="Summary">
        <article className="kpi"><span>Service providers</span><strong>{all.length}</strong><small>Total registered</small></article>
        <article className="kpi"><span>Approved</span><strong>{count("approved")}</strong><small>{expired > 0 ? `${expired} need renewing` : "Available for assignment"}</small></article>
        <article className={`kpi ${count("pending") > 0 ? "kpi--attention" : ""}`}><span>Pending approval</span><strong>{count("pending")}</strong><small>Awaiting review</small></article>
        <article className="kpi"><span>Inactive</span><strong>{count("inactive")}</strong><small>Not currently available</small></article>
      </section>

      <section className="card register-card">
        <div className="register-toolbar provider-toolbar">
          <div className="register-search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="provider-search">Search service providers</label>
            <input id="provider-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search service providers…" />
          </div>
          <div className="provider-toolbar__filters">
            <label>
              <span className="sr-only">Specialisation</span>
              <Select value={specialisation} onChange={(event) => { setSpecialisation(event.target.value); setPage(1); }}>
                <option value="">All specialisations</option>
                {specialisations.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
              </Select>
            </label>
            <label>
              <span className="sr-only">Status</span>
              <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending approval</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
            <button className="button button--quiet" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Filter /> Filters</button>
          </div>
        </div>
        {filtersOpen ? (
          <div className="provider-filters" role="group" aria-label="More filters">
            <Field label="Service area">
              <Select value={area} onChange={(event) => { setArea(event.target.value); setPage(1); }}>
                <option value="">Any area</option>
                {areas.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Response time">
              <Select value={maxHours} onChange={(event) => { setMaxHours(event.target.value); setPage(1); }}>
                <option value="">Any response time</option>
                <option value="2">Within 2 hours or faster</option>
                <option value="4">Within 4 hours or faster</option>
                <option value="8">Within 8 hours or faster</option>
                <option value="24">Within 1 day or faster</option>
              </Select>
            </Field>
          </div>
        ) : null}

        {shown.length === 0 ? (
          <div className="empty-inline empty-inline--centered">
            <strong>{filtering ? "No service providers match these filters" : "No service providers yet"}</strong>
            <span>{filtering ? "Try a different filter or clear the search." : "Add the contractors that repair and maintain your equipment and infrastructure."}</span>
            {filtering ? <button className="button button--quiet button--small" onClick={clear}>Clear filters</button> : manage ? <button className="button button--primary button--small" onClick={() => setForm({})}>Add Service Provider</button> : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--register">
              <thead><tr><th scope="col">Service provider</th><th scope="col">Specialisation</th><th scope="col">Service area</th><th scope="col">Status</th><th scope="col">Response time</th><th scope="col"><span className="sr-only">Actions</span><span aria-hidden="true">Actions</span></th></tr></thead>
              <tbody>
                {shown.map((provider) => (
                  <tr key={provider.id}>
                    <td data-label="Service provider"><Link className="row-link" href={`/equipment/providers/${provider.id}`}><span className="cell-main"><strong>{provider.name}</strong><small>{provider.registration ? `Reg. ${provider.registration}` : "No registration number"}</small></span></Link></td>
                    <td data-label="Specialisation">{provider.specialisation || provider.categories.map((value) => categoryLabels[value]).join(", ")}</td>
                    <td data-label="Service area">{provider.serviceAreas.length > 0 ? provider.serviceAreas.join(", ") : <span className="muted">Not recorded</span>}</td>
                    <td data-label="Status"><StatusCell provider={provider} today={today} /></td>
                    <td data-label="Response time">{responseLabel(provider.responseHours)}</td>
                    <td data-label="Actions">
                      <RowMenu provider={provider} manage={manage} approve={approve} onEdit={() => setForm({ provider })} onApproval={(approval) => setAsking({ provider, approval })} onDelete={() => setDeleting(provider)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="provider-pager">
          <span>Showing {shown.length} of {visible.length} service providers{filtering ? ` (${all.length} registered)` : ""}</span>
          {pages > 1 ? (
            <nav aria-label="Pages">
              <button className="icon-button icon-button--light" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft /></button>
              {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                <button key={number} className={`pager-number ${number === current ? "active" : ""}`} aria-current={number === current ? "page" : undefined} aria-label={`Page ${number}`} onClick={() => setPage(number)}>{number}</button>
              ))}
              <button className="icon-button icon-button--light" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight /></button>
            </nav>
          ) : null}
        </footer>
      </section>

      {form ? <FormDialog provider={form.provider} canApprove={approve} actions={actions} onClose={() => setForm(null)} /> : null}
      {asking ? <ApprovalDialog provider={asking.provider} approval={asking.approval} actions={actions} onClose={() => setAsking(null)} /> : null}
      {deleting ? <DeleteDialog provider={deleting} actions={actions} onClose={() => setDeleting(null)} onDeactivate={() => { setAsking({ provider: deleting, approval: "inactive" }); setDeleting(null); }} /> : null}
    </div>
  );
}

/** The "…" menu on a row: view, edit, change approval, delete. Each item only appears for someone allowed to use it. */
function RowMenu({ provider, manage, approve, onEdit, onApproval, onDelete }: { provider: ServiceProvider; manage: boolean; approve: boolean; onEdit: () => void; onApproval: (approval: "approved" | "inactive" | "pending") => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  const pick = (action: () => void) => () => { close(); action(); };
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="icon-button icon-button--light" aria-haspopup="true" aria-expanded={open} aria-label={`Actions for ${provider.name}`} onClick={() => setOpen(!open)}><Ellipsis /></button>
      {open ? (
        <div className="popover popover--menu" role="group" aria-label={`Actions for ${provider.name}`}>
          <div className="menu-section">
            <Link className="menu-item" href={`/equipment/providers/${provider.id}`} onClick={close}>View details</Link>
            {manage ? <button className="menu-item" onClick={pick(onEdit)}>Edit</button> : null}
            {approve && provider.approval !== "approved" ? <button className="menu-item" onClick={pick(() => onApproval("approved"))}>{provider.approval === "inactive" ? "Reactivate" : "Approve"}</button> : null}
            {approve && provider.approval !== "inactive" ? <button className="menu-item" onClick={pick(() => onApproval("inactive"))}>Make inactive</button> : null}
            {approve ? <button className="menu-item menu-item--danger" onClick={pick(onDelete)}>Delete</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Actions = ReturnType<typeof useProviderMutations>;

function FormDialog({ provider, canApprove, actions, onClose }: { provider?: ServiceProvider; canApprove: boolean; actions: Actions; onClose: () => void }) {
  return (
    <ProviderDialog
      provider={provider}
      canApprove={canApprove}
      pending={actions.create.isPending || actions.update.isPending}
      onClose={onClose}
      onSave={(input: ProviderInput) => (provider ? actions.update.mutate({ ...input, id: provider.id, version: provider.version }, { onSuccess: onClose }) : actions.create.mutate({ ...input, submissionId: crypto.randomUUID() } as ProviderInput, { onSuccess: onClose }))}
    />
  );
}

function ApprovalDialog({ provider, approval, actions, onClose }: { provider: ServiceProvider; approval: "approved" | "inactive" | "pending"; actions: Actions; onClose: () => void }) {
  const [note, setNote] = useState("");
  const inactive = approval === "inactive";
  const title = approval === "approved" ? (provider.approval === "inactive" ? `Reactivate ${provider.name}?` : `Approve ${provider.name}?`) : inactive ? `Make ${provider.name} inactive?` : `Return ${provider.name} to pending?`;
  return (
    <Dialog title={title} description={inactive ? "Their records and history are kept. They will not be offered for new repair requests." : approval === "approved" ? "They can then be offered for repair requests that match their specialisation." : undefined} onClose={onClose} locked={actions.setApproval.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={actions.setApproval.isPending}>Cancel</button><button className="button button--primary" disabled={actions.setApproval.isPending || (inactive && note.trim().length < 5)} onClick={() => actions.setApproval.mutate({ id: provider.id, approval, note, version: provider.version }, { onSuccess: onClose })}><Busy pending={actions.setApproval.isPending} label="Saving…">{inactive ? "Make inactive" : approval === "approved" ? "Approve" : "Confirm"}</Busy></button></>}>
      <Field label={inactive ? "Why? (required)" : "Note (optional)"}><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </Dialog>
  );
}

/** Deleting asks first. A provider that repair requests refer to cannot be removed, and the dialog says so and offers to deactivate it. */
function DeleteDialog({ provider, actions, onClose, onDone, onDeactivate }: { provider: ServiceProvider; actions: Actions; onClose: () => void; onDone?: () => void; onDeactivate: () => void }) {
  const [blocked, setBlocked] = useState<string | null>(null);
  if (blocked) {
    return (
      <Dialog title={`${provider.name} cannot be deleted`} onClose={onClose}
        footer={<><button className="button button--quiet" onClick={onClose}>Keep as is</button>{provider.approval !== "inactive" ? <button className="button button--primary" onClick={onDeactivate}>Deactivate instead</button> : null}</>}>
        <p>{blocked}</p>
      </Dialog>
    );
  }
  return (
    <ConfirmDialog
      title={`Delete ${provider.name}?`}
      body={<>This permanently removes the provider. It cannot be undone. A provider that repair requests refer to cannot be deleted: it is deactivated instead, so its history stays.</>}
      confirmLabel="Delete provider"
      tone="danger"
      pending={actions.remove.isPending}
      onClose={onClose}
      onConfirm={() => actions.remove.mutateAsync(provider.id).then(onDone ?? onClose, (error: unknown) => setBlocked(error instanceof Error ? error.message : "This provider cannot be deleted."))}
    />
  );
}

// ---- One provider -----------------------------------------------------------------------------------------------------

export function ProviderDetailScreen({ id }: { id: string }) {
  const query = useProviderDetail(id);
  const { data: shell } = useShellData();
  const actor = useActor();
  const actions = useProviderMutations();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<"approved" | "inactive" | "pending" | null>(null);
  const [deleting, setDeleting] = useState(false);
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const detail: ProviderDetail = query.data;
  const { provider, requests, performance } = detail;
  const manage = canManageProviders(actor).allowed;
  const approve = canApproveProviders(actor).allowed;
  const today = shell?.now ?? "";
  const done = requests.filter((item) => item.chosen && item.status === "completed");

  return (
    <div className="workspace-page">
      <Breadcrumb current={provider.name} middle={{ label: "Manage Service Providers", href: "/equipment/providers" }} />
      <PageHeader
        eyebrow={provider.registration ? `Reg. ${provider.registration}` : "Service provider"}
        title={provider.name}
        description={provider.specialisation || provider.categories.map((value) => categoryLabels[value]).join(", ")}
        action={
          <div className="header-actions">
            <StatusCell provider={provider} today={today} />
            {manage ? <button className="button button--quiet" onClick={() => setEditing(true)}><Pencil /> Edit</button> : null}
            {approve && provider.approval !== "approved" ? <button className="button button--primary" onClick={() => setAsking("approved")}>{provider.approval === "inactive" ? "Reactivate" : "Approve"}</button> : null}
            {approve && provider.approval !== "inactive" ? <button className="button button--quiet" onClick={() => setAsking("inactive")}>Make inactive</button> : null}
            {approve ? <button className="button button--quiet" onClick={() => setDeleting(true)}><Trash2 /> Delete</button> : null}
          </div>
        }
      />
      {provider.approval !== "approved" ? <div className="note-bar" role="status"><span>{provider.approval === "pending" ? "This provider is waiting for approval. It cannot be given repair requests until the Mine Manager approves it." : "This provider is inactive. It cannot be given new repair requests, and its history is kept."}</span></div> : null}
      {provider.approval === "approved" && !isApproved(provider, today) ? <div className="note-bar note-bar--warn" role="status"><span>{approvalLabel(provider, today)}. Renew the approval before offering this provider new work.</span></div> : null}

      <section className="detail-layout">
        <div className="detail-layout__main">
          <article className="card detail-card" aria-labelledby="provider-details">
            <header className="card__header"><div><span className="eyebrow">Provider</span><h2 id="provider-details">Details</h2></div></header>
            <dl className="definition-grid">
              <div><dt>Contact person</dt><dd>{provider.contactName || <span className="muted">Not recorded</span>}</dd></div>
              <div><dt>Email</dt><dd>{provider.email || <span className="muted">Not recorded</span>}</dd></div>
              <div><dt>Phone</dt><dd>{provider.phone || <span className="muted">Not recorded</span>}</dd></div>
              <div><dt>Service areas</dt><dd>{provider.serviceAreas.length > 0 ? provider.serviceAreas.join(", ") : <span className="muted">Not recorded</span>}</dd></div>
              <div><dt>Expected response</dt><dd>{responseLabel(provider.responseHours)}</dd></div>
              <div><dt>Approved until</dt><dd>{provider.approvedUntil || <span className="muted">No end date</span>}</dd></div>
              <div className="definition-grid__wide"><dt>Equipment and infrastructure serviced</dt><dd>{provider.categories.map((value) => categoryLabels[value]).join(", ")}</dd></div>
              <div className="definition-grid__wide"><dt>Certifications and documents</dt><dd>{provider.documents.length > 0 ? provider.documents.map((file) => `${file.name} (${file.sizeLabel})`).join(", ") : <span className="muted">None attached</span>}</dd></div>
            </dl>
            {provider.notes ? <p className="card__footnote">{provider.notes}</p> : null}
          </article>

          <article className="card detail-card" aria-labelledby="provider-requests">
            <header className="card__header"><div><span className="eyebrow">Repair requests</span><h2 id="provider-requests">Linked repair requests</h2></div></header>
            {requests.length === 0 ? (
              <div className="empty-inline"><strong>No repair requests yet</strong><span>{provider.approval === "approved" ? "Requests appear here when this provider is asked to quote for equipment or infrastructure." : "An approved provider can be asked to quote for a repair."}</span></div>
            ) : (
              <ul className="work-list">
                {requests.map((item) => (
                  <li className="work-row" key={item.id}>
                    <Link className="work-row__copy" href={`/equipment/${item.equipmentId}/service/${item.id}`}><strong>{item.title}</strong><small>{item.number} · {item.equipmentCode} · {item.chosen ? "Chosen for the work" : item.invite === "declined" ? "Declined" : item.invite === "quoted" ? "Quote received" : item.invite === "not_selected" ? "Not selected" : "Awaiting reply"}</small></Link>
                    <StatusBadge value={item.status === "completed" ? "complete" : item.status === "cancelled" ? "unknown" : "in_progress"} label={requestStatusLabels[item.status]} />
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card detail-card" aria-labelledby="provider-history">
            <header className="card__header"><div><span className="eyebrow">Record</span><h2 id="provider-history">Repair history and performance</h2></div></header>
            <dl className="definition-grid">
              <div><dt>Asked to quote</dt><dd>{performance.asked}</dd></div>
              <div><dt>Quotes received</dt><dd>{performance.replied}</dd></div>
              <div><dt>Declined</dt><dd>{performance.declined}</dd></div>
              <div><dt>Repairs completed</dt><dd>{performance.completedJobs}</dd></div>
              <div className="definition-grid__wide"><dt>Average time to reply</dt><dd>{performance.averageReplyHours === null ? <span className="muted">No recorded replies yet</span> : `${performance.averageReplyHours} hours, from recorded quotes`}</dd></div>
            </dl>
            {done.length > 0 ? (
              <ul className="work-list">{done.map((item) => <li className="work-row" key={item.id}><Link className="work-row__copy" href={`/equipment/${item.equipmentId}/service/${item.id}`}><strong>{item.title}</strong><small>{item.number} · {item.equipmentCode}{item.completedAt ? ` · completed ${formatDemoDateTime(item.completedAt)}` : ""}</small></Link></li>)}</ul>
            ) : <p className="card__footnote">No completed repairs on record. Figures come only from recorded requests and quotes; nothing is estimated.</p>}
          </article>

          <article className="card detail-card" aria-labelledby="provider-agreements">
            <header className="card__header"><div><span className="eyebrow">Agreements</span><h2 id="provider-agreements">Maintenance agreements</h2></div></header>
            <div className="empty-inline"><strong>No maintenance agreements recorded</strong><span>This prototype keeps repair requests and quotes. Standing maintenance agreements with providers are not recorded yet.</span></div>
          </article>
        </div>

        <aside className="detail-layout__side">
          <article className="card detail-card" aria-labelledby="provider-audit">
            <header className="card__header"><div><span className="eyebrow">Audit</span><h2 id="provider-audit">History of changes</h2></div></header>
            <ul className="timeline-list">
              {[...provider.history].reverse().map((line) => (
                <li key={line.id}><strong>{line.summary}</strong><small>{formatDemoDateTime(line.at)} · {line.actor}{line.note ? ` · “${line.note}”` : ""}</small></li>
              ))}
            </ul>
          </article>
        </aside>
      </section>

      {editing ? <FormDialog provider={provider} canApprove={approve} actions={actions} onClose={() => setEditing(false)} /> : null}
      {asking ? <ApprovalDialog provider={provider} approval={asking} actions={actions} onClose={() => setAsking(null)} /> : null}
      {deleting ? <DeleteDialog provider={provider} actions={actions} onClose={() => setDeleting(false)} onDone={() => router.push("/equipment/providers")} onDeactivate={() => { setDeleting(false); setAsking("inactive"); }} /> : null}
    </div>
  );
}
