"use client";

/**
 * The document upload form, shared by Documents and the delivery page. The file's name, type and size are recorded against the record
 * it belongs to. Uploading never changes the record itself: proof of delivery is evidence, not acceptance.
 */
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { documentKinds, folderLabels, formatSize, type Folder } from "@core/lib/trade-rules";
import { Dialog } from "@core/components/dialog";
import { Field } from "@core/components/form-field";
import { Select } from "@core/components/select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type TradeView } from "../use-trade";
import { Busy } from "@core/components/busy";

const MAX = 25 * 1_048_576;

/** The first bytes each accepted type starts with. CSV is plain text, so any contents are allowed. */
function matchesType(name: string, bytes: Uint8Array) {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return starts(0x25, 0x50, 0x44, 0x46);
  if (extension === "png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (extension === "jpg" || extension === "jpeg") return starts(0xff, 0xd8, 0xff);
  if (extension === "docx" || extension === "xlsx") return starts(0x50, 0x4b, 0x03, 0x04);
  if (extension === "doc" || extension === "xls") return starts(0xd0, 0xcf, 0x11, 0xe0) || starts(0x50, 0x4b, 0x03, 0x04);
  return true;
}
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg";

export function UploadDialog({ data, onClose, preset }: { data: TradeView; onClose: () => void; preset?: { folder?: Folder; kind?: string; reference?: string; clientId?: string | null; lockReference?: boolean } }) {
  const submission = useSubmissionId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [form, setForm] = useState({ folder: preset?.folder ?? "deliveries", kind: preset?.kind ?? "Proof of delivery", reference: preset?.reference ?? "", clientId: preset?.clientId ?? "", expiresOn: "", confidential: false });
  const [error, setError] = useState<string | null>(null);
  const save = useTradeAction<Record<string, unknown>>({ path: "/trade/documents", success: () => ({ title: "Document uploaded", detail: form.kind === "Proof of delivery" ? "Filed as evidence. Customer acceptance is still recorded separately." : undefined }), onDone: onClose });

  const [reading, setReading] = useState<number | null>(null);

  // The file is read in the browser so its contents can be checked against its name (a renamed file is refused). The bar shows the
  // bytes actually read; nothing is estimated.
  const pick = (chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.size > MAX) return setError("Files can be at most 25 MB.");
    if (!/\.(pdf|docx?|xlsx?|csv|png|jpe?g)$/i.test(chosen.name)) return setError("Upload a PDF, Word, Excel, CSV or image file.");
    if (chosen.size === 0) return setError("This file is empty.");
    setError(null);
    setFile(null);
    setReading(0);
    const reader = new FileReader();
    reader.onprogress = (event) => { if (event.lengthComputable) setReading(event.loaded / event.total); };
    reader.onerror = () => { setReading(null); setError("The file could not be read. Choose it again."); };
    reader.onload = () => {
      setReading(null);
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      if (!matchesType(chosen.name, bytes)) return setError("This file's contents do not match its type. Check that it is the right file.");
      setFile({ name: chosen.name, size: chosen.size });
    };
    reader.readAsArrayBuffer(chosen);
  };
  const submit = () => {
    if (!file) return setError("Choose a file to upload.");
    if (form.reference.trim().length < 2) return setError("Enter the record it belongs to, such as AGR-0047 or DEL-0231.");
    save.mutate({ ...form, name: file.name, sizeBytes: file.size, clientId: form.clientId || null, expiresOn: form.expiresOn || null, submissionId: submission.id });
  };

  return (
    <Dialog title="Upload document" description="PDF, Word, Excel, CSV or image, up to 25 MB." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" onClick={submit} disabled={save.isPending || reading !== null}><Upload /> <Busy pending={save.isPending} label="Uploading…">Upload</Busy></button></>}>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {reading !== null ? (
        <div className="upload-progress" role="progressbar" aria-label="Reading the file" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reading * 100)}>
          <span>Reading the file… {Math.round(reading * 100)}%</span>
          <span className="upload-progress__track"><span className="upload-progress__bar" style={{ transform: `scaleX(${reading})` }} /></span>
        </div>
      ) : null}
      {save.isPending ? (
        <div className="upload-progress" role="status">
          <span>Saving the document record…</span>
          <span className="upload-progress__track upload-progress__track--indeterminate"><span className="upload-progress__bar" /></span>
        </div>
      ) : null}
      <div
        className={`trade-dropzone ${file ? "trade-dropzone--filled" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); pick(event.dataTransfer.files[0]); }}
      >
        <Upload aria-hidden="true" />
        {file ? <p><strong>{file.name}</strong> · {formatSize(file.size)}</p> : <p>Drag a file here, or</p>}
        <button type="button" className="button button--quiet button--small" onClick={() => input.current?.click()}>{file ? "Choose another file" : "Choose a file"}</button>
        <label className="sr-only" htmlFor="trade-upload-file">File</label>
        <input id="trade-upload-file" ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(event) => pick(event.target.files?.[0])} />
      </div>
      <div className="form-grid">
        <Field label="Folder"><Select value={form.folder} onChange={(event) => setForm({ ...form, folder: event.target.value as Folder })}>{(Object.keys(folderLabels) as Folder[]).map((key) => <option key={key} value={key}>{folderLabels[key]}</option>)}</Select></Field>
        <Field label="Document type"><Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>{documentKinds.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <Field label="Record reference" hint="The agreement, delivery, invoice or client it belongs to."><input value={form.reference} readOnly={preset?.lockReference} onChange={(event) => setForm({ ...form, reference: event.target.value.toUpperCase() })} placeholder="AGR-0047" /></Field>
        <Field label="Client"><Select value={form.clientId ?? ""} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Not client-specific</option>{data.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Expires on" hint="Optional, for certificates and KYC packs."><input type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /></Field>
        {data.can.pricing ? (
          <label className="checkbox-row trade-checkbox"><input type="checkbox" checked={form.confidential} onChange={(event) => setForm({ ...form, confidential: event.target.checked })} /> <span>Confidential (prices or bank details): only pricing roles can see it</span></label>
        ) : null}
      </div>
    </Dialog>
  );
}
