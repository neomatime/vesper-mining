"use client";

/**
 * Workflow: Approvals (commercial requests waiting for a decision), Documents (the commercial document library with folders, filters
 * and uploads; confidential files only for pricing roles) and Linked Operations (which Mining Operations work fulfils which commitment,
 * with readiness read from that work; nothing operational is edited here).
 */
import { BadgeCheck, CircleX, ClipboardCheck, Download, ExternalLink, FileText, Files, Folder, FolderOpen, Hourglass, LayoutGrid, Link2, List, Lock, ShieldAlert, Target, TriangleAlert, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { approvalTypeLabels, folderLabels, formatSize, formatTonnes, type ApprovalType, type Folder as FolderKey } from "@/lib/trade-rules";
import { ConfirmDialog, Dialog } from "../dialog";
import { Field } from "../form-field";
import { Select } from "../select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type ApprovalRow, type DocumentRow, type LinkRow, type TradeView } from "../use-trade";
import { ApprovalStatus, DocumentStatus, Readiness, readinessLabels } from "./trade-status";
import { UploadDialog } from "./trade-upload";
import { ActionMenu, CellMain, dateTimeLabel, dayLabel, Donut, exportCsv, KpiTiles, Money, Progress, RailCard, RailList, Register, TradeData, TradeHeader } from "./trade-ui";
import { Busy } from "../busy";

// ---- Approvals -------------------------------------------------------------------------------------------------------------

export function ApprovalsScreen() {
  return <TradeData label="Loading approvals">{(data) => <Approvals data={data} />}</TradeData>;
}

function Approvals({ data }: { data: TradeView }) {
  const [reviewing, setReviewing] = useState<string | null>(null);
  const rows = data.approvals;
  const pending = rows.filter((item) => item.status === "pending");
  const decided = rows.filter((item) => item.decidedAt);
  const hours = decided.map((item) => (Date.parse(item.decidedAt!) - Date.parse(item.submittedAt)) / 3_600_000);
  const types = Object.keys(approvalTypeLabels) as ApprovalType[];
  const selected = rows.find((item) => item.id === reviewing);
  const mine = pending.filter((item) => item.canDecide);
  const href = (item: ApprovalRow) => ({ agreement: `/trade/agreements/${item.subjectId}`, amendment: `/trade/agreements/${item.subjectId}`, quotation: `/trade/enquiries?open=${item.subjectId}`, settlement: `/trade/settlements?focus=${item.subjectId}`, delivery: `/trade/deliveries/${item.subjectId}` })[item.type];

  return (
    <div className="workspace-page trade-page">
      <TradeHeader eyebrow="Workflow · Trade" title="Approvals" description="Commercial requests waiting for a decision, who decides them and what was decided." icon={ClipboardCheck}
        actions={<button className="button button--quiet" onClick={() => exportCsv("approvals.csv", ["Ref", "Type", "Description", "Client", "Value", "Submitted by", "Status"], rows.map((item) => [item.number, approvalTypeLabels[item.type], item.description, item.clientName, item.value, item.submittedBy, item.status]))}><Download /> Export</button>} />
      <KpiTiles items={[
        { label: "Pending approvals", value: pending.length, hint: `${mine.length} for you to decide`, icon: ClipboardCheck, tone: mine.length ? "attention" : undefined },
        { label: "Approved", value: rows.filter((item) => item.status === "approved").length, hint: "All time", icon: BadgeCheck },
        { label: "Rejected", value: rows.filter((item) => item.status === "rejected").length, hint: "All time", icon: CircleX },
        { label: "Average decision time", value: hours.length ? `${(hours.reduce((a, b) => a + b, 0) / hours.length / 24).toFixed(1)} days` : "—", hint: "Submitted to decided", icon: Hourglass },
        { label: "Value awaiting decision", value: <Money value={data.can.pricing ? pending.reduce((total, item) => total + (item.value ?? 0), 0) : null} />, hint: "Pending requests", icon: Wallet },
      ]} />
      <div className="trade-layout">
        <Register<ApprovalRow>
          title="Approval queue"
          noun="requests"
          rows={rows}
          searchLabel="Search by reference, type, customer or description"
          search={(row) => [row.number, row.subjectNumber, approvalTypeLabels[row.type], row.description, row.clientName, row.submittedBy].join(" ")}
          initialChip="pending"
          chips={[{ key: "pending", label: "Pending", test: (row) => row.status === "pending" }, { key: "mine", label: "For me", test: (row) => row.canDecide }, ...types.map((type) => ({ key: type, label: approvalTypeLabels[type], test: (row: ApprovalRow) => row.type === type }))]}
          initialSort={{ key: "ref", direction: "desc" }}
          columns={[
            { key: "ref", label: "Ref", sort: (row) => row.number, render: (row) => <CellMain title={row.number} detail={row.subjectNumber} /> },
            { key: "description", label: "Request", sort: (row) => row.type, render: (row) => <CellMain title={approvalTypeLabels[row.type]} detail={row.description} /> },
            { key: "customer", label: "Customer", sort: (row) => row.clientName, render: (row) => row.clientName },
            { key: "value", label: "Value", sort: (row) => row.value ?? 0, align: "end", render: (row) => (row.value === null && data.can.pricing ? "—" : <Money value={row.value} />) },
            { key: "by", label: "Submitted by", sort: (row) => row.submittedBy, render: (row) => row.submittedBy },
            { key: "age", label: "Age", sort: (row) => row.ageHours, render: (row) => (row.status === "pending" ? (row.ageHours >= 48 ? `${Math.round(row.ageHours / 24)}d` : `${row.ageHours}h`) : <span className="muted">—</span>) },
            { key: "status", label: "Status", sort: (row) => row.status, render: (row) => <ApprovalStatus approval={row} /> },
          ]}
          actions={(row) => <button className="button button--quiet button--small" onClick={() => setReviewing(row.id)} aria-label={`${row.status === "pending" && row.canDecide ? "Review" : "View"} ${row.number}`}>{row.status === "pending" && row.canDecide ? "Review" : "View"}</button>}
          empty={{ title: "Nothing waiting", body: "Requests appear here when agreements, quotations, amendments, credits or deliveries need a decision." }}
        />
        <aside className="trade-rail" aria-label="Approval insights">
          <RailCard title="Approvals by type">
            <Donut label="Approvals by type" centre={String(rows.length)} caption="Total" segments={types.map((type, index) => ({ label: approvalTypeLabels[type], value: rows.filter((item) => item.type === type).length, tone: (["positive", "warning", "info", "neutral", "danger"] as const)[index], display: String(rows.filter((item) => item.type === type).length) }))} />
          </RailCard>
          <RailCard title="Within target">
            {(() => { const within = hours.filter((value) => value <= 48).length; return <><Progress share={hours.length ? within / hours.length : 0} label={`${within} of ${hours.length} decided within 2 days`} /><p className="muted trade-small">{within} of {hours.length} decided within 2 days.</p></>; })()}
          </RailCard>
          <RailCard title="Who decides">
            <RailList empty="" items={types.map((type) => ({ key: type, icon: ClipboardCheck, title: approvalTypeLabels[type], detail: type === "quotation" ? "Commercial / Finance Officer (or the Mine Manager)" : "Mine Manager" }))} />
            <p className="muted trade-small">Nobody decides a request they submitted themselves.</p>
          </RailCard>
        </aside>
      </div>
      {selected ? <ApprovalDialog data={data} approval={selected} href={href(selected)} onClose={() => setReviewing(null)} /> : null}
    </div>
  );
}

function ApprovalDialog({ data, approval, href, onClose }: { data: TradeView; approval: ApprovalRow; href: string; onClose: () => void }) {
  const [note, setNote] = useState("");
  const decide = useTradeAction<Record<string, unknown>, ApprovalRow>({ path: `/trade/approvals/${approval.id}/decision`, success: (result) => ({ title: result.status === "approved" ? `${result.number} approved` : `${result.number} rejected` }), onDone: onClose });
  return (
    <Dialog title={`${approval.number} · ${approvalTypeLabels[approval.type]}`} description={approval.description} onClose={onClose} locked={decide.isPending}
      footer={approval.status === "pending" && approval.canDecide ? (
        <><button className="button button--quiet" onClick={onClose}>Later</button><button className="button button--danger" disabled={decide.isPending || note.trim().length < 5} onClick={() => decide.mutate({ decision: "rejected", note, version: approval.version })}>Reject</button><button className="button button--primary" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "approved", note, version: approval.version })}><Busy pending={decide.isPending} label="Saving…">Approve</Busy></button></>
      ) : <button className="button button--quiet" onClick={onClose}>Close</button>}>
      <dl className="trade-definitions">
        <div><dt>Record</dt><dd><Link className="row-link-text" href={href}>{approval.subjectNumber} <ExternalLink aria-hidden="true" /></Link></dd></div>
        <div><dt>Customer</dt><dd>{approval.clientName}</dd></div>
        <div><dt>Value</dt><dd>{approval.value === null && data.can.pricing ? "—" : <Money value={approval.value} />}</dd></div>
        <div><dt>Submitted</dt><dd>{approval.submittedBy} · {dateTimeLabel(approval.submittedAt)}</dd></div>
        <div><dt>Decided by</dt><dd>{approval.decidedBy ? `${approval.decidedBy} · ${dateTimeLabel(approval.decidedAt!)}` : approval.approverRole}</dd></div>
        <div><dt>Status</dt><dd><ApprovalStatus approval={approval} /></dd></div>
        {approval.note ? <div><dt>Note</dt><dd>{approval.note}</dd></div> : null}
      </dl>
      <p className="muted trade-small">{{ agreement: "Approving makes the agreement active, so deliveries can be planned against it.", amendment: "Approving applies the change to the agreement.", quotation: "Approving sends the quotation to the buyer.", settlement: "Approving issues the credit and resolves the dispute.", delivery: "Approving records the decision on the delivery." }[approval.type]}</p>
      {approval.status === "pending" && approval.canDecide ? <Field label="Note (required to reject)"><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field> : null}
      {approval.status === "pending" && !approval.canDecide ? <div className="note-bar" role="status"><span>{approval.decideReason}</span></div> : null}
    </Dialog>
  );
}

// ---- Documents -------------------------------------------------------------------------------------------------------------

export function DocumentsScreen() {
  return <TradeData label="Loading documents">{(data) => <Documents data={data} />}</TradeData>;
}

function Documents({ data }: { data: TradeView }) {
  const [uploading, setUploading] = useState(false);
  const [folder, setFolder] = useState<FolderKey | "">("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const status = useTradeAction<{ id: string; status: string }>({ path: (input) => `/trade/documents/${input.id}/status`, success: () => ({ title: "Document updated" }) });
  const remove = useTradeAction<{ id: string }>({ path: (input) => `/trade/documents/${input.id}`, method: "DELETE", success: () => ({ title: "Document deleted" }), onDone: () => setDeleting(null) });
  const rows = data.documents;
  const folders = Object.keys(folderLabels) as FolderKey[];
  const expiring = rows.filter((item) => item.expiresInDays !== null && item.expiresInDays >= 0 && item.expiresInDays <= 30).sort((a, b) => a.expiresInDays! - b.expiresInDays!);
  const totalSize = rows.reduce((total, item) => total + item.sizeBytes, 0);
  const recent = [...rows].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 4);

  return (
    <div className="workspace-page trade-page">
      <TradeHeader eyebrow="Workflow · Trade" title="Documents" description="Commercial, contractual and delivery documents, filed against the records they belong to." icon={Files}
        actions={<>
          <button className="button button--quiet" onClick={() => exportCsv("documents.csv", ["Name", "Type", "Folder", "Reference", "Client", "Size", "Updated", "Status", "Expires"], rows.map((item) => [item.name, item.kind, folderLabels[item.folder], item.reference, item.clientName, formatSize(item.sizeBytes), item.uploadedAt.slice(0, 10), item.status, item.expiresOn]))}><Download /> Export</button>
          {data.can.uploadDocuments ? <button className="button button--primary" onClick={() => setUploading(true)}><Upload /> Upload document</button> : null}
        </>} />
      {data.hiddenDocuments ? <div className="note-bar" role="status"><span><Lock aria-hidden="true" /> {data.hiddenDocuments} confidential documents (agreements, invoices and quotations with prices) are visible only to the Mine Manager and the Commercial / Finance Officer.</span></div> : null}
      <KpiTiles items={[
        { label: "Documents", value: rows.length, hint: "You can see", icon: FileText },
        { label: "Total size", value: formatSize(totalSize), hint: "Of the documents listed", icon: Files },
        { label: "Agreement documents", value: rows.filter((item) => item.folder === "agreements").length, hint: "Agreements and amendments", icon: Folder },
        { label: "Compliance documents", value: rows.filter((item) => item.folder === "compliance").length, hint: "KYC, BEE and tax", icon: ShieldAlert },
        { label: "Expiring (≤ 30 days)", value: expiring.length, hint: expiring[0] ? `Next: ${expiring[0].name}` : "None", icon: TriangleAlert, tone: expiring.length ? "attention" : undefined },
      ]} />
      <div className="trade-layout">
        <div className="trade-stack-main">
          <section className="card trade-folders" aria-label="Folders">
            <header className="trade-register__header">
              <h2>Document library</h2>
              <div className="segmented" role="group" aria-label="View">
                <button className={view === "grid" ? "active" : ""} aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid aria-hidden="true" /> Grid</button>
                <button className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" /> List</button>
              </div>
            </header>
            <div className={view === "grid" ? "trade-folder-grid" : "trade-folder-list"}>
              {folders.map((key) => (
                <button key={key} className={`trade-folder ${folder === key ? "is-active" : ""}`} aria-pressed={folder === key} onClick={() => setFolder(folder === key ? "" : key)}>
                  {folder === key ? <FolderOpen aria-hidden="true" /> : <Folder aria-hidden="true" />}
                  <strong>{folderLabels[key]}</strong>
                  <small>{rows.filter((item) => item.folder === key).length} documents</small>
                </button>
              ))}
            </div>
          </section>
          <Register<DocumentRow>
            title={folder ? `${folderLabels[folder]} documents` : "All documents"}
            noun="documents"
            rows={rows}
            searchLabel="Search documents by name, reference, customer or type"
            search={(row) => [row.name, row.reference, row.clientName, row.kind, folderLabels[row.folder]].join(" ")}
            chips={[
              { key: "pending", label: "Pending review", test: (row) => row.status === "pending_review" },
              { key: "expiring", label: "Expiring", test: (row) => row.expiresInDays !== null && row.expiresInDays <= 30 },
              { key: "evidence", label: "Delivery evidence", test: (row) => ["Proof of delivery", "Weighbridge ticket", "Quality certificate"].includes(row.kind) },
            ]}
            extra={{ controls: null, test: (row) => !folder || row.folder === folder, active: Boolean(folder), clear: () => setFolder("") }}
            initialSort={{ key: "updated", direction: "desc" }}
            columns={[
              { key: "name", label: "Document", sort: (row) => row.name, render: (row) => <CellMain title={<>{row.confidential ? <Lock className="trade-inline-icon" aria-label="Confidential" /> : null}{row.name}</>} detail={folderLabels[row.folder]} /> },
              { key: "type", label: "Type", sort: (row) => row.kind, render: (row) => row.kind },
              { key: "reference", label: "Reference", sort: (row) => row.reference, render: (row) => row.reference },
              { key: "customer", label: "Customer", sort: (row) => row.clientName, render: (row) => row.clientName },
              { key: "size", label: "Size", sort: (row) => row.sizeBytes, render: (row) => formatSize(row.sizeBytes) },
              { key: "updated", label: "Updated", sort: (row) => row.uploadedAt, render: (row) => dayLabel(row.uploadedAt) },
              { key: "status", label: "Status", sort: (row) => row.status, render: (row) => <DocumentStatus document={row} /> },
            ]}
            actions={(row) => <ActionMenu label={`Actions for ${row.name}`} actions={[
              { label: "Approve", onClick: () => status.mutate({ id: row.id, status: "approved" }), hidden: !data.can.manageAgreements || row.status !== "pending_review" },
              { label: "Mark final", onClick: () => status.mutate({ id: row.id, status: "final" }), hidden: !data.can.manageAgreements || !["pending_review", "approved"].includes(row.status) },
              { label: "Mark superseded", onClick: () => status.mutate({ id: row.id, status: "superseded" }), hidden: !data.can.manageAgreements || row.status === "superseded" },
              { label: "Delete", onClick: () => setDeleting(row), danger: true, hidden: !data.can.manageAgreements || ["approved", "final"].includes(row.status) },
            ]} />}
            empty={{ title: "No documents yet", body: "Upload agreements, delivery evidence, invoices and compliance documents." }}
          />
        </div>
        <aside className="trade-rail" aria-label="Document activity">
          <RailCard title="Recent activity">
            <RailList empty="No uploads yet." items={recent.map((item) => ({ key: item.id, icon: Upload, title: item.name, detail: `${item.uploadedBy} · ${dayLabel(item.uploadedAt)}` }))} />
          </RailCard>
          <RailCard title={`Expiring documents (${expiring.length})`}>
            <RailList empty="Nothing expires in the next 30 days." items={expiring.map((item) => ({ key: item.id, icon: TriangleAlert, tone: item.expiresInDays! <= 7 ? "critical" as const : "attention" as const, title: `${item.reference} – expires in ${item.expiresInDays} day${item.expiresInDays === 1 ? "" : "s"}`, detail: item.name }))} />
          </RailCard>
        </aside>
      </div>
      {uploading ? <UploadDialog data={data} onClose={() => setUploading(false)} preset={folder ? { folder } : undefined} /> : null}
      {deleting ? <ConfirmDialog title={`Delete ${deleting.name}?`} body="This removes the document from the library. It cannot be undone." confirmLabel="Delete document" tone="danger" pending={remove.isPending} onConfirm={() => remove.mutate({ id: deleting.id })} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}

// ---- Linked Operations -----------------------------------------------------------------------------------------------------

export function LinkedOperationsScreen() {
  return <TradeData label="Loading linked operations">{(data) => <LinkedOperations data={data} />}</TradeData>;
}

function LinkedOperations({ data }: { data: TradeView }) {
  const params = useSearchParams();
  const [linking, setLinking] = useState<string | null>(params.get("link"));
  const [removing, setRemoving] = useState<LinkRow | null>(null);
  const remove = useTradeAction<{ id: string }>({ path: (input) => `/trade/links/${input.id}`, method: "DELETE", success: () => ({ title: "Link removed", detail: "Mining Operations records are unchanged." }), onDone: () => setRemoving(null) });
  const rows = data.links;
  const counts = (key: LinkRow["readiness"]) => rows.filter((item) => item.readiness === key).length;
  const linkedAgreements = new Set(rows.map((item) => item.agreementId)).size;
  const unlinked = data.agreements.filter((item) => item.status === "active" && !rows.some((link) => link.agreementId === item.id));
  const shifts = rows.filter((item) => item.shift).sort((a, b) => a.shift!.startsAt.localeCompare(b.shift!.startsAt));

  return (
    <div className="workspace-page trade-page">
      <TradeHeader eyebrow="Workflow · Trade" title="Linked Operations" description="Which Mining Operations work fulfils each commercial commitment, and how ready it is." icon={Link2}
        actions={<>
          <button className="button button--quiet" onClick={() => exportCsv("linked-operations.csv", ["Link", "Agreement", "Client", "Workstream", "Area", "Shift", "Dispatched t", "Readiness"], rows.map((item) => [item.number, item.agreementNumber, item.clientName, item.workstream, item.area.name, item.shift?.name ?? "", item.dispatched, readinessLabels[item.readiness]]))}><Download /> Export</button>
          {data.can.linkOperations ? <button className="button button--primary" onClick={() => setLinking("")}><Link2 /> Link operation</button> : null}
        </>} />
      <div className="note-bar" role="status"><span>Readiness, shifts, shipments and issues are read from Mining Operations. Open the area, shift or shipment there to change them.</span></div>
      <KpiTiles items={[
        { label: "Linked agreements", value: linkedAgreements, hint: `${unlinked.length} active agreements not linked`, icon: FileText },
        { label: "Operation links", value: rows.length, hint: `${rows.reduce((total, item) => total + item.shipments.length, 0)} shipments referenced`, icon: Link2 },
        { label: "Dispatched against links", value: formatTonnes(rows.reduce((total, item) => total + item.dispatched, 0)), hint: "From Mining Operations", icon: Target },
        { label: "At risk", value: counts("at_risk"), hint: "Open issues or area at risk", icon: TriangleAlert, tone: counts("at_risk") ? "attention" : undefined },
      ]} />
      <div className="trade-layout">
        <Register<LinkRow>
          title="Linked operations register"
          noun="linked operations"
          rows={rows}
          searchLabel="Search by agreement, operation, shift or reference"
          search={(row) => [row.number, row.agreementNumber, row.clientName, row.workstream, row.area.name, row.shift?.name, ...row.shipments.map((item) => item.number)].join(" ")}
          chips={(Object.keys(readinessLabels) as LinkRow["readiness"][]).map((key) => ({ key, label: readinessLabels[key], test: (row) => row.readiness === key }))}
          initialSort={{ key: "ref", direction: "desc" }}
          columns={[
            { key: "ref", label: "Link", sort: (row) => row.number, render: (row) => <CellMain title={row.number} detail={row.commitment?.label} /> },
            { key: "agreement", label: "Agreement", sort: (row) => row.agreementNumber, render: (row) => <CellMain title={<Link className="row-link-text" href={`/trade/agreements/${row.agreementId}`}>{row.agreementNumber}</Link>} detail={row.clientName} /> },
            { key: "work", label: "Operation / workstream", render: (row) => row.workstream },
            { key: "area", label: "Area", sort: (row) => row.area.name, render: (row) => <Link className="row-link-text" href="/map">{row.area.name}</Link> },
            { key: "shift", label: "Linked shift", render: (row) => (row.shift ? <Link className="row-link-text" href={`/shifts/${row.shift.id}`}>{row.shift.name}</Link> : <span className="muted">None</span>) },
            { key: "progress", label: "Dispatched", sort: (row) => row.progress, render: (row) => (row.commitment ? <Progress share={row.progress} label={`${formatTonnes(row.dispatched)} of ${formatTonnes(row.commitment.tonnes)} dispatched`} /> : "—") },
            { key: "ready", label: "Readiness", sort: (row) => row.readiness, render: (row) => <Readiness link={row} /> },
          ]}
          actions={(row) => <ActionMenu label={`Actions for ${row.number}`} actions={[
            { label: "View agreement", href: `/trade/agreements/${row.agreementId}` },
            ...row.shipments.map((item) => ({ label: `Open ${item.number} in Mining Operations`, href: `/shipments/${item.id}` })),
            ...row.issues.map((item) => ({ label: `Open issue ${item.number}`, href: `/exceptions/${item.id}` })),
            { label: "Remove link", onClick: () => setRemoving(row), danger: true, hidden: !data.can.linkOperations },
          ]} />}
          empty={{ title: "No operations linked", body: "Link an agreement's commitment to the mine area, shift and shipments doing the work." }}
        />
        <aside className="trade-rail" aria-label="Link health">
          <RailCard title="Link health">
            <Donut label="Link health" centre={rows.length ? `${Math.round(((counts("on_track") + counts("ready") + counts("completed")) / rows.length) * 100)}%` : "—"} caption="On track" segments={[
              { label: "On track or ready", value: counts("on_track") + counts("ready") + counts("completed"), tone: "positive", display: String(counts("on_track") + counts("ready") + counts("completed")) },
              { label: "At risk", value: counts("at_risk"), tone: "warning", display: String(counts("at_risk")) },
              { label: "Awaiting link", value: counts("awaiting_link"), tone: "neutral", display: String(counts("awaiting_link")) },
            ]} />
          </RailCard>
          <RailCard title="Linked shifts">
            <RailList empty="No shifts linked." items={shifts.map((item) => ({ key: item.id, title: `${item.shift!.name} – ${item.workstream}`, detail: dateTimeLabel(item.shift!.startsAt), href: `/shifts/${item.shift!.id}` }))} />
          </RailCard>
          <RailCard title="Operational alerts">
            <RailList empty="No operational issue affects a linked commitment." items={rows.flatMap((item) => item.issues.map((issue) => ({ key: `${item.id}-${issue.id}`, icon: TriangleAlert, tone: "critical" as const, title: `${issue.title} may delay ${item.agreementNumber}`, detail: `${issue.number} · ${item.area.name}`, href: `/exceptions/${issue.id}` })))} />
          </RailCard>
        </aside>
      </div>
      {linking !== null ? <LinkDialog data={data} agreementId={linking} onClose={() => setLinking(null)} /> : null}
      {removing ? <ConfirmDialog title={`Remove ${removing.number}?`} body="The link between the commitment and this work is removed. Nothing in Mining Operations changes." confirmLabel="Remove link" tone="danger" pending={remove.isPending} onConfirm={() => remove.mutate({ id: removing.id })} onClose={() => setRemoving(null)} /> : null}
    </div>
  );
}

function LinkDialog({ data, agreementId, onClose }: { data: TradeView; agreementId: string; onClose: () => void }) {
  const submission = useSubmissionId();
  const active = data.agreements.filter((item) => item.status === "active");
  const [form, setForm] = useState({ agreementId: active.some((item) => item.id === agreementId) ? agreementId : "", commitmentId: "", workstream: "", areaId: "", shiftId: "", shipmentIds: [] as string[], note: "" });
  const [error, setError] = useState<string | null>(null);
  const save = useTradeAction<Record<string, unknown>>({ path: "/trade/links", success: () => ({ title: "Operation linked" }), onDone: onClose });
  const agreement = active.find((item) => item.id === form.agreementId);
  const submit = () => {
    if (!agreement) return setError("Choose an active agreement.");
    if (!form.commitmentId) return setError("Choose the commitment.");
    if (form.workstream.trim().length < 3) return setError("Describe the work, such as 'Concentrate loading – May tranche'.");
    if (!form.areaId) return setError("Choose the mine area.");
    setError(null);
    save.mutate({ ...form, submissionId: submission.id });
  };
  return (
    <Dialog title="Link an operation" description="Connect a commitment to the Mining Operations work that fulfils it. Nothing operational is created or changed." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" onClick={submit} disabled={save.isPending}><Busy pending={save.isPending} label="Saving…">Link operation</Busy></button></>}>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="form-grid">
        <Field label="Agreement"><Select value={form.agreementId} onChange={(event) => setForm({ ...form, agreementId: event.target.value, commitmentId: "" })}><option value="">Choose an agreement</option>{active.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.clientName}</option>)}</Select></Field>
        <Field label="Commitment"><Select value={form.commitmentId} onChange={(event) => setForm({ ...form, commitmentId: event.target.value })}><option value="">Choose a commitment</option>{(agreement?.commitments ?? []).filter((item) => item.state !== "fulfilled").map((item) => <option key={item.id} value={item.id}>{item.label} · {formatTonnes(item.tonnes)}</option>)}</Select></Field>
        <Field label="Workstream" wide><input value={form.workstream} onChange={(event) => setForm({ ...form, workstream: event.target.value })} /></Field>
        <Field label="Mine area"><Select value={form.areaId} onChange={(event) => setForm({ ...form, areaId: event.target.value })}><option value="">Choose an area</option>{data.mining.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Shift" hint="Optional"><Select value={form.shiftId} onChange={(event) => setForm({ ...form, shiftId: event.target.value })}><option value="">No shift</option>{data.mining.shifts.map((item) => <option key={item.id} value={item.id}>{item.name} · {dateTimeLabel(item.startsAt)}</option>)}</Select></Field>
      </div>
      <fieldset className="trade-checklist">
        <legend>Mining Operations shipments (optional)</legend>
        {data.mining.shipments.filter((item) => item.state !== "cancelled").map((item) => (
          <label key={item.id} className="checkbox-row"><input type="checkbox" checked={form.shipmentIds.includes(item.id)} onChange={(event) => setForm({ ...form, shipmentIds: event.target.checked ? [...form.shipmentIds, item.id] : form.shipmentIds.filter((id) => id !== item.id) })} /> <span>{item.number} · {formatTonnes(item.tonnes)} · {item.state}</span></label>
        ))}
      </fieldset>
    </Dialog>
  );
}
