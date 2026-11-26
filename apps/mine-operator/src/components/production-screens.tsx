"use client";

/**
 * Production, from the shift to the stockpile: the Production tab in Shift Control, the Record production form, and the Check
 * production screen where an amount is confirmed into inventory.
 *
 * The rule these screens keep visible: what a supervisor reports is not stock. Stock changes only when someone else checks the
 * amount, and the reported amount, the measurement and the reason for any difference all stay on the record.
 */
import type { ProductionRecord } from "@vesper/api-contracts";
import { AlertTriangle, ArrowLeft, Check, Info, Lock, Paperclip, Send, Save, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { toEvidence, type EvidenceFile } from "@/lib/evidence";
import { formatDay, shiftTimes } from "@/lib/shift-format";
import {
  basisLabels,
  canActOnShipments,
  checkDifference,
  conditionLabels,
  formatTonnes,
  productionStateLabels,
  productionTone,
  shiftTargetTonnes,
} from "@/lib/shipment-rules";
import { useDemoContext } from "@/stores/demo-context";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { ImpactCard } from "./impact-panels";
import { ShiftControlTabs } from "./module-tabs";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { Select } from "./select";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { useLogistics, useLogisticsAction, useSubmissionId, type StockpileView } from "./use-logistics";
import { RegisterView, type Register } from "./workspace-screen";
import { Busy } from "./busy";

const bases = ["estimate", "weighbridge", "survey", "other"] as const;

/** The next step beside a production record, in the words a person would use. */
function nextStep(record: ProductionRecord, canCheck: boolean) {
  if (record.state === "needs_checking") return canCheck ? "Check quantity" : "View record";
  if (record.state === "draft") return "Continue";
  if (record.state === "sent_back") return "Correct and send again";
  return "View record";
}

// ---- The Production tab -----------------------------------------------------------------------------------------------

export function ProductionListScreen() {
  const query = useLogistics();
  const { context } = useDemoContext();
  const actor = { name: context.persona, role: context.role };
  if (query.isPending) return <LoadingState />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;

  const records = query.data.production;
  const canRecord = canActOnShipments("record_production", actor).allowed;
  const reported = records.reduce((total, item) => total + item.reportedTonnes, 0);
  const checked = records.reduce((total, item) => total + (item.check?.confirmedTonnes ?? 0), 0);
  const waiting = records.filter((item) => item.state === "needs_checking");

  const register: Register<ProductionRecord> = {
    icon: TrendingUp,
    tiles: [
      { label: "Reported", value: formatTonnes(reported), hint: "Recorded by supervisors" },
      { label: "Checked", value: formatTonnes(checked), hint: "Confirmed quantities" },
      { label: "Needs checking", value: waiting.length === 1 ? "1 record" : `${waiting.length} records`, hint: waiting.length ? [...new Set(waiting.map((item) => item.shiftName))].join(", ") : "Nothing is waiting", attention: waiting.length > 0 },
    ],
    columns: [
      { key: "record", label: "Record", render: (item) => item.number },
      { key: "shift", label: "Shift & material", render: (item) => `${item.shiftName} · ${item.mineral}` },
      { key: "target", label: "Target", render: (item) => formatTonnes(item.targetTonnes) },
      { key: "reported", label: "Reported", render: (item) => formatTonnes(item.reportedTonnes) },
      { key: "checked", label: "Checked", render: (item) => (item.check ? formatTonnes(item.check.confirmedTonnes) : <span className="muted">—</span>) },
      { key: "status", label: "Status", render: (item) => <StatusBadge value={productionTone[item.state]} label={productionStateLabels[item.state]} /> },
      { key: "next", label: "Next step", render: (item) => <span className="row-link-text">{nextStep(item, canActOnShipments("check_production", actor, item.reportedBy).allowed)}</span> },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "needs", label: "Needs checking", test: (item) => item.state === "needs_checking" },
      { key: "checked", label: "Checked", test: (item) => item.state === "checked" },
    ],
    href: (item) => (item.state === "draft" || item.state === "sent_back" ? `/shifts/production/new?id=${item.id}` : `/shipments/inventory/check/${item.id}`),
    text: (item) => [item.number, item.shiftName, item.mineral, item.reportedBy, productionStateLabels[item.state]].join(" "),
    rows: records,
    action: canRecord ? { label: "Record production", href: "/shifts/production/new", plus: true } : undefined,
    emptyTitle: "No production recorded yet",
    emptyBody: "Record what the shift mined. Someone else then checks the amount before it counts as stock.",
    footnote: "Reported amounts do not update stock until they are checked.",
  };

  return <RegisterView initialFilter={null} header={{ eyebrow: "Shift Control & Handover", title: "Production", description: "See what was mined and what still needs checking." }} register={register} tabs={<><ShiftControlTabs active="production" /><ImpactCard focus="shift" /></>} />;
}

// ---- Record production ------------------------------------------------------------------------------------------------

/** The route's entry: reads ?id= (to continue a draft or correct a record) and shows the form. */
export function RecordProductionRoute() {
  return <RecordProductionScreen editId={useSearchParams().get("id")} />;
}

export function RecordProductionScreen({ editId }: { editId: string | null }) {
  const logistics = useLogistics();
  const { data: shell } = useShellData();
  if (logistics.isPending || !shell) return <LoadingState />;
  if (logistics.isError && !logistics.data) return <ErrorState message={logistics.error.message} onRetry={() => logistics.refetch()} retrying={logistics.isFetching} />;
  const existing = editId ? logistics.data.production.find((item) => item.id === editId) : undefined;
  if (editId && !existing) return <ErrorState message="This production record could not be found." onRetry={() => logistics.refetch()} />;
  return <ProductionForm stockpiles={logistics.data.stockpiles} shifts={shell.shifts} areas={shell.areas.map((area) => area.name)} existing={existing} />;
}

type FormShift = { id: string; name: string; startsAt: string; endsAt: string; state: string; supervisor: string | null };

function ProductionForm({ stockpiles, shifts, areas, existing }: { stockpiles: StockpileView[]; shifts: FormShift[]; areas: string[]; existing?: ProductionRecord }) {
  const router = useRouter();
  const { context } = useDemoContext();
  const actor = { name: context.persona, role: context.role };
  const submission = useSubmissionId();
  const open = shifts.filter((item) => item.state !== "cancelled" && item.state !== "scheduled");
  const choices = open.length > 0 ? open : shifts.filter((item) => item.state !== "cancelled");
  const [shiftId, setShiftId] = useState(existing?.shiftId ?? choices.find((item) => item.state === "in_progress")?.id ?? choices[0]?.id ?? "");
  const [area, setArea] = useState(existing?.area ?? areas[0] ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.reportedTonnes) : "");
  const [basis, setBasis] = useState<string>(existing?.basis ?? "estimate");
  const [stockpileId, setStockpileId] = useState(existing?.stockpileId ?? stockpiles.find((item) => item.condition === "needs_processing")?.id ?? stockpiles[0]?.id ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [files, setFiles] = useState<EvidenceFile[]>(existing?.evidence ?? []);
  const [error, setError] = useState("");
  const shift = shifts.find((item) => item.id === shiftId);
  const allowed = canActOnShipments("record_production", actor);

  const save = useLogisticsAction<Record<string, unknown>, ProductionRecord>({
    path: existing ? `/production/${existing.id}` : "/production",
    method: existing ? "PATCH" : "POST",
    success: (record) => (record.state === "draft" ? { title: "Draft saved", detail: `${record.number} is saved. Send it for checking when it is ready.` } : { title: "Sent for checking", detail: `${record.number}: ${formatTonnes(record.reportedTonnes)}. It does not count as stock until it is checked.` }),
  });

  if (!allowed.allowed) {
    return (
      <div className="task-page">
        <Link href="/shifts/production" className="back-link"><ArrowLeft /> Back to Production</Link>
        <section className="card detail-card restricted"><Lock aria-hidden="true" /><h2>This step is for a supervisor</h2><p>{allowed.reason}</p></section>
      </div>
    );
  }

  const submit = (send: boolean, another = false) => {
    const tonnes = Number(amount);
    if (!amount.trim() || !Number.isFinite(tonnes) || tonnes <= 0) return setError("Enter how many tonnes were produced.");
    if (!area) return setError("Choose the mining area.");
    if (!shift) return setError("Choose the shift.");
    setError("");
    save.mutate(
      { submissionId: submission.id, shiftId: shift.id, mineral: "Chrome concentrate", area, reportedTonnes: tonnes, basis, stockpileId, note, evidence: files, submit: send, version: existing?.version },
      {
        onSuccess: () => {
          if (another) {
            setAmount("");
            setNote("");
            setFiles([]);
            submission.renew();
          } else router.push("/shifts/production");
        },
      },
    );
  };

  return (
    <div className="task-page">
      <Link href="/shifts/production" className="back-link"><ArrowLeft /> Back to Production</Link>
      <PageHeader eyebrow="Shift Control & Handover › Production" title="Record production" description="Record what your team produced during this shift." icon={TrendingUp} />
      {existing?.state === "sent_back" ? <div className="note-bar note-bar--warn" role="status"><AlertTriangle /> <span><strong>Sent back for correction.</strong> {existing.sentBackReason}</span></div> : null}
      <form className="card task-card" onSubmit={(event) => { event.preventDefault(); submit(true); }} noValidate>
        <div className="task-context">
          <strong>{shift?.name ?? "No shift"}</strong>
          {shift ? <span>{formatDay(shift.startsAt)} · {shiftTimes(shift)}</span> : null}
          {shift?.supervisor ? <span>{shift.supervisor}</span> : null}
        </div>

        <section className="task-section">
          <h2>What was mined?</h2>
          <div className="task-grid">
            <Field label="Shift"><Select value={shiftId} onChange={(event) => setShiftId(event.target.value)}>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Mineral"><Select value="Chrome concentrate" disabled onChange={() => {}}><option>Chrome concentrate</option></Select></Field>
            <Field label="Mining area"><Select value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
          </div>
          <p className="field-hint">Target for this shift: {formatTonnes(shiftTargetTonnes)}.</p>
        </section>

        <section className="task-section">
          <h2>How much was produced?</h2>
          <div className="task-grid">
            <Field label="Amount produced (t)" error={error && !amount.trim() ? error : undefined}><input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(error)} /></Field>
            <Field label="How was it measured?"><Select value={basis} onChange={(event) => setBasis(event.target.value)}>{bases.map((item) => <option key={item} value={item}>{basisLabels[item]}</option>)}</Select></Field>
            <Field label="Moved to"><Select value={stockpileId} onChange={(event) => setStockpileId(event.target.value)}>{stockpiles.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select></Field>
          </div>
        </section>

        <section className="task-section">
          <h2>Notes and evidence</h2>
          <Field label="Note (optional)" wide><textarea rows={3} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></Field>
          <div className="task-evidence">
            <input id="production-evidence" className="sr-only" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5).map(toEvidence))} />
            <label htmlFor="production-evidence" className="button button--quiet button--small"><Paperclip /> Add measurement record</label>
            {files.length > 0 ? <ul className="chips" aria-label="Files to attach">{files.map((file) => <li key={file.name}><Paperclip /> {file.name} <small>{file.sizeLabel}</small></li>)}</ul> : <small className="field-hint">Optional. Recorded by file name.</small>}
          </div>
        </section>

        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        <div className="task-footer">
          <p>The amount must be checked before it updates stock.</p>
          <div className="button-row">
            {!existing ? <button type="button" className="button button--quiet" disabled={save.isPending} onClick={() => submit(true, true)}>Send and add another material</button> : null}
            <button type="button" className="button button--quiet" disabled={save.isPending} onClick={() => submit(false)}><Save /> Save draft</button>
            <button className="button button--primary" disabled={save.isPending}><Send /> <Busy pending={save.isPending} label="Sending…">Send for checking</Busy></button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---- Check production -------------------------------------------------------------------------------------------------

export function CheckProductionScreen({ id }: { id: string }) {
  const query = useLogistics();
  if (query.isPending) return <LoadingState />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const record = query.data.production.find((item) => item.id === id);
  if (!record) return <ErrorState message="This production record could not be found." onRetry={() => query.refetch()} />;
  return <CheckForm record={record} stockpiles={query.data.stockpiles} />;
}

function CheckForm({ record, stockpiles }: { record: ProductionRecord; stockpiles: StockpileView[] }) {
  const router = useRouter();
  const { context } = useDemoContext();
  const actor = { name: context.persona, role: context.role };
  const [confirmed, setConfirmed] = useState(String(record.reportedTonnes));
  const [basis, setBasis] = useState<string>(record.basis === "estimate" ? "weighbridge" : record.basis);
  const [measurement, setMeasurement] = useState("");
  const [reason, setReason] = useState("");
  const [stockpileId, setStockpileId] = useState(record.stockpileId);
  const [error, setError] = useState("");
  const [sendingBack, setSendingBack] = useState(false);
  const stockpile = stockpiles.find((item) => item.id === stockpileId);
  const permission = canActOnShipments("check_production", actor, record.reportedBy);
  const tonnes = Number(confirmed);
  const valid = confirmed.trim() !== "" && Number.isFinite(tonnes) && tonnes >= 0;
  const difference = valid ? checkDifference(record, tonnes) : 0;

  const check = useLogisticsAction<Record<string, unknown>, ProductionRecord>({
    path: `/production/${record.id}/check`,
    success: (result) => ({ title: "Receipt confirmed", detail: `${formatTonnes(result.check?.confirmedTonnes ?? 0)} added to ${stockpile?.code ?? "stock"}. The original report is kept.` }),
    onDone: () => router.push("/shipments/inventory"),
  });
  const sendBack = useLogisticsAction<{ reason: string; version: number }, ProductionRecord>({
    path: `/production/${record.id}/send-back`,
    success: () => ({ title: "Sent back", detail: `${record.reportedBy} has been told what to correct.` }),
    onDone: () => router.push("/shifts/production"),
  });

  const header = <PageHeader eyebrow="Shipments › Mineral inventory" title="Check production" description="Confirm the amount received and where it is stored." icon={TrendingUp} />;
  const back = <Link href="/shipments/inventory" className="back-link"><ArrowLeft /> Back to Mineral Inventory</Link>;
  const summary = <div className="task-context"><strong>{record.number}</strong><span>{record.shiftName}</span><span>{record.mineral}</span><span>Reported by {record.reportedBy}</span></div>;

  if (record.state !== "needs_checking") {
    return (
      <div className="task-page">
        {back}
        {header}
        <section className="card task-card">
          {summary}
          <div className="fact-row">
            <div className="fact"><span>Status</span><strong><StatusBadge value={productionTone[record.state]} label={productionStateLabels[record.state]} /></strong></div>
            <div className="fact"><span>Reported</span><strong>{formatTonnes(record.reportedTonnes)} · {basisLabels[record.basis]}</strong></div>
            {record.check ? <div className="fact"><span>Confirmed</span><strong>{formatTonnes(record.check.confirmedTonnes)} · {basisLabels[record.check.basis]}</strong></div> : null}
            {record.check ? <div className="fact"><span>Stored in</span><strong>{stockpiles.find((item) => item.id === record.check?.stockpileId)?.code}</strong></div> : null}
          </div>
          {record.check?.reason ? <div className="note-bar"><Info /> <span><strong>Difference explained:</strong> {record.check.reason}</span></div> : null}
          {record.state === "sent_back" ? <div className="note-bar note-bar--warn"><AlertTriangle /> <span><strong>Sent back:</strong> {record.sentBackReason}</span></div> : null}
          {record.state === "draft" || record.state === "sent_back" ? <div className="button-row"><Link className="button button--primary" href={`/shifts/production/new?id=${record.id}`}>{record.state === "draft" ? "Continue the draft" : "Correct and send again"}</Link></div> : null}
          <section className="task-section">
            <h2>History</h2>
            <ul className="timeline-list">{record.events.map((entry) => <li key={entry.id}><strong>{entry.summary}</strong><small>{entry.actor} · {formatDemoDateTime(entry.occurredAt)}{entry.note ? ` · ${entry.note}` : ""}</small></li>)}</ul>
          </section>
        </section>
      </div>
    );
  }

  if (!permission.allowed) {
    return (
      <div className="task-page">
        {back}
        {header}
        <section className="card task-card">
          {summary}
          <div className="note-bar"><Lock /> <span>{permission.reason}</span></div>
          <div className="fact-row"><div className="fact"><span>Reported</span><strong>{formatTonnes(record.reportedTonnes)} · {basisLabels[record.basis]}</strong></div></div>
        </section>
      </div>
    );
  }

  const confirm = () => {
    if (!valid) return setError("Enter the confirmed amount.");
    if (!measurement.trim()) return setError("Add the measurement record, for example the weighbridge slip.");
    if (difference !== 0 && reason.trim().length < 8) return setError("Record the reason for the difference.");
    setError("");
    check.mutate({ confirmedTonnes: tonnes, basis, record: measurement, reason, stockpileId, version: record.version });
  };

  return (
    <div className="task-page">
      {back}
      {header}
      <form className="card task-card" onSubmit={(event) => { event.preventDefault(); confirm(); }} noValidate>
        {summary}
        <section className="task-section">
          <h2>Check the amount</h2>
          <div className="task-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <Field label="Reported amount"><input readOnly value={formatTonnes(record.reportedTonnes)} /></Field>
            <Field label="Confirmed amount (t)"><input type="number" inputMode="decimal" min="0" step="any" value={confirmed} onChange={(event) => setConfirmed(event.target.value)} /></Field>
            <Field label="Measurement"><Select value={basis} onChange={(event) => setBasis(event.target.value)}>{bases.map((item) => <option key={item} value={item}>{basisLabels[item]}</option>)}</Select></Field>
            <Field label="Measurement record"><input value={measurement} placeholder="For example WB-0148.pdf" onChange={(event) => setMeasurement(event.target.value)} /></Field>
          </div>
          {difference !== 0 ? <div className="note-bar note-bar--warn" role="status"><AlertTriangle /> <span>{formatTonnes(Math.abs(difference))} {difference < 0 ? "less" : "more"} than reported. Record the reason below.</span></div> : null}
          {difference !== 0 ? <Field label="Reason" wide><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why does the confirmed amount differ?" /></Field> : null}
        </section>

        <section className="task-section">
          <h2>Where is it stored?</h2>
          <div className="task-grid task-grid--two">
            <Field label="Stockpile"><Select value={stockpileId} onChange={(event) => setStockpileId(event.target.value)}>{stockpiles.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select></Field>
            <Field label="Material condition" hint="Set by the stockpile."><input readOnly value={stockpile ? conditionLabels[stockpile.condition] : ""} /></Field>
          </div>
          <p className="field-hint">Checking the amount does not make this material ready to ship.{stockpile?.condition === "needs_processing" ? " It stays out of reach for shipments until it is processed." : ""}</p>
        </section>

        <div className="note-bar"><Info /> <span><strong>After confirmation:</strong> {valid ? formatTonnes(tonnes) : "—"} added to {stockpile?.code ?? "stock"}. Original report kept: {formatTonnes(record.reportedTonnes)}.</span></div>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
        <div className="task-footer">
          <div className="button-row">
            <button className="button button--primary" disabled={check.isPending}><Check /> <Busy pending={check.isPending} label="Confirming…">Confirm receipt</Busy></button>
            <button type="button" className="button button--quiet" disabled={check.isPending} onClick={() => setSendingBack(true)}>Send back for correction</button>
          </div>
        </div>
      </form>
      {sendingBack ? <SendBackDialog pending={sendBack.isPending} onClose={() => setSendingBack(false)} onSend={(text) => sendBack.mutate({ reason: text, version: record.version })} /> : null}
    </div>
  );
}

function SendBackDialog({ pending, onClose, onSend }: { pending: boolean; onClose: () => void; onSend: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const short = reason.trim().length < 8;
  return (
    <Dialog
      title="Send back for correction"
      description="Tell the supervisor what to correct. Nothing is added to stock."
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={<><button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Cancel</button><button className="button button--primary" disabled={pending || short} onClick={() => onSend(reason.trim())}><Busy pending={pending} label="Sending…">Send back</Busy></button></>}
    >
      <Field label="What needs correcting?" hint="At least eight characters."><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    </Dialog>
  );
}

