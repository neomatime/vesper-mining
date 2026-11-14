"use client";

import type { ShiftWork } from "@vesper/api-contracts";
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { sizeLabel, toEvidence, type EvidenceFile } from "@/lib/evidence";
import { Dialog } from "./dialog";
import { Field } from "./form-field";

/** Asks for an optional note and evidence when a task is marked done. Reopening a task needs neither. */
export function TaskCompletionDialog({
  title,
  pending,
  onSave,
  onClose,
}: {
  title: string;
  pending: boolean;
  onSave: (input: { note?: string; evidence: EvidenceFile[] }) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      title="Mark task done"
      description={title}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" disabled={pending} onClick={() => onSave({ note: note.trim() || undefined, evidence: files.map(toEvidence) })}>{pending ? "Saving…" : "Mark done"}</button>
        </>
      }
    >
      <div className="dialog__stack">
        <Field label="What was done (optional)" hint="A line for the supervisor and the shift report.">
          <textarea rows={3} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className="task-evidence">
          <input ref={input} id="task-evidence-files" className="sr-only" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} />
          <label htmlFor="task-evidence-files" className="button button--quiet button--small"><Paperclip /> Attach evidence (optional)</label>
          <small className="field-hint">Up to five files. Evidence is recorded by file name and size.</small>
          {files.length > 0 ? (
            <ul className="chips" aria-label="Files to attach">
              {files.map((file) => <li key={file.name}><Paperclip /> {file.name} <small>{sizeLabel(file.size)}</small></li>)}
            </ul>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

/** What was recorded when a task was finished: the note, and the evidence by name. */
export function TaskCompletionNote({ task }: { task: Pick<ShiftWork, "completion"> }) {
  const completion = task.completion;
  if (!completion || (!completion.note && completion.evidence.length === 0)) return null;
  return (
    <div className="task-completion">
      {completion.note ? <q>{completion.note}</q> : null}
      {completion.evidence.length > 0 ? (
        <ul className="chips" aria-label="Evidence">
          {completion.evidence.map((file) => <li key={file.name}>{file.kind === "photo" ? <ImageIcon /> : <FileText />} {file.name} <small>{file.sizeLabel}</small></li>)}
        </ul>
      ) : null}
    </div>
  );
}
