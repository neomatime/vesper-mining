"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Action, IssueDependency, OperationalIssue } from "@vesper/api-contracts";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { fromLocalInput, toLocalInput } from "@/lib/demo-clock";
import { activeActions, type TransitionOption } from "@/lib/issue-rules";
import { owners, teams } from "@/lib/personas";
import type { ActionInput, DependencyInput, IssueDetailsInput } from "./use-issue-mutations";
import { Dialog } from "./dialog";
import { Field } from "./form-field";

type Option = { id: string; name: string };

const priorities = ["low", "medium", "high", "critical"] as const;

export const dependencyKinds = [
  { value: "parts", label: "Spare parts or stock" },
  { value: "contractor", label: "Contractor or supplier" },
  { value: "internal_team", label: "Another internal team" },
  { value: "permit_reference", label: "Permit or approval reference" },
  { value: "information", label: "Information or decision" },
] as const;

export function dependencyKindLabel(kind: string) {
  return dependencyKinds.find((item) => item.value === kind)?.label ?? kind;
}

// ---- Edit issue --------------------------------------------------------------------------------

const detailsSchema = z.object({
  title: z.string().trim().min(4, "Use at least four characters."),
  description: z.string().trim().min(12, "Describe the issue in a little more detail."),
  priority: z.enum(priorities),
  owner: z.string(),
  equipmentId: z.string(),
  areaId: z.string(),
});

type DetailsValues = z.infer<typeof detailsSchema>;

export function EditIssueDialog({
  issue,
  equipment,
  areas,
  canAssign,
  pending,
  onSave,
  onClose,
}: {
  issue: OperationalIssue;
  equipment: Option[];
  areas: Option[];
  canAssign: boolean;
  pending: boolean;
  onSave: (changes: Partial<IssueDetailsInput>) => void;
  onClose: () => void;
}) {
  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      owner: issue.owner ?? "",
      equipmentId: issue.equipmentId ?? "",
      areaId: issue.areaId ?? "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) => {
    const changes: Partial<IssueDetailsInput> = {};
    if (values.title !== issue.title) changes.title = values.title;
    if (values.description !== issue.description) changes.description = values.description;
    if (values.priority !== issue.priority) changes.priority = values.priority;
    if ((values.owner || null) !== issue.owner) changes.owner = values.owner || null;
    if ((values.equipmentId || null) !== issue.equipmentId) changes.equipmentId = values.equipmentId || null;
    if ((values.areaId || null) !== issue.areaId) changes.areaId = values.areaId || null;
    if (Object.keys(changes).length === 0) return onClose();
    onSave(changes);
  });

  return (
    <Dialog
      title="Edit issue details"
      description={`${issue.issueNumber}. Every change is recorded in the issue history.`}
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="edit-issue-form" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        </>
      }
    >
      <form id="edit-issue-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Title" error={errors.title?.message} wide>
          <input data-autofocus aria-invalid={Boolean(errors.title)} {...form.register("title")} />
        </Field>
        <Field label="Description" error={errors.description?.message} wide>
          <textarea rows={4} aria-invalid={Boolean(errors.description)} {...form.register("description")} />
        </Field>
        <Field label="Priority">
          <select {...form.register("priority")}>
            {priorities.map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Accountable owner" hint={canAssign ? "One person is accountable. Contributors own separate actions." : "Only a Shift Supervisor or Mine Manager can change the owner."}>
          <select disabled={!canAssign} {...form.register("owner")}>
            <option value="">No owner yet</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Equipment">
          <select {...form.register("equipmentId")}>
            <option value="">No equipment</option>
            {equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Operating area">
          <select {...form.register("areaId")}>
            <option value="">No area</option>
            {areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Add or edit an action -----------------------------------------------------------------------

const actionSchema = z.object({
  title: z.string().trim().min(4, "Use at least four characters."),
  owner: z.string().min(1, "Choose who owns this action."),
  team: z.string().min(1, "Choose the owning team."),
  dueAt: z.string(),
});

type ActionValues = z.infer<typeof actionSchema>;

export function ActionDialog({
  action,
  pending,
  onSave,
  onClose,
}: {
  action?: Action;
  pending: boolean;
  onSave: (input: ActionInput) => void;
  onClose: () => void;
}) {
  const form = useForm<ActionValues>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      title: action?.title ?? "",
      owner: action?.owner ?? "",
      team: action?.team ?? "",
      dueAt: toLocalInput(action?.dueAt ?? null),
    },
  });
  const { errors } = form.formState;
  const dueAt = useWatch({ control: form.control, name: "dueAt" });

  return (
    <Dialog
      title={action ? "Edit action" : "Add an action"}
      description="An action only counts as assigned when it has an owner and a deadline."
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="action-form" disabled={pending}>{pending ? "Saving…" : action ? "Save action" : "Add action"}</button>
        </>
      }
    >
      <form
        id="action-form"
        className="form-grid"
        noValidate
        onSubmit={form.handleSubmit((values) => onSave({ title: values.title, owner: values.owner, team: values.team, dueAt: fromLocalInput(values.dueAt) }))}
      >
        <Field label="What needs to happen" error={errors.title?.message} wide>
          <input data-autofocus placeholder="For example, confirm the filter kit is in stock" aria-invalid={Boolean(errors.title)} {...form.register("title")} />
        </Field>
        <Field label="Owner" error={errors.owner?.message}>
          <select aria-invalid={Boolean(errors.owner)} {...form.register("owner")}>
            <option value="">Choose an owner</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Team" error={errors.team?.message}>
          <select aria-invalid={Boolean(errors.team)} {...form.register("team")}>
            <option value="">Choose a team</option>
            {teams.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Deadline (site time)" hint={dueAt ? undefined : "No deadline set. This action will not count towards assignment."} wide>
          <input type="datetime-local" {...form.register("dueAt")} />
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Add a dependency ----------------------------------------------------------------------------

const dependencySchema = z.object({
  reason: z.string().trim().min(8, "Explain what is needed in at least eight characters."),
  kind: z.string().min(1, "Choose the kind of dependency."),
  owner: z.string().min(1, "Choose who can clear it."),
  blockedActionId: z.string(),
  reviewBy: z.string().min(1, "Set a review deadline."),
});

type DependencyValues = z.infer<typeof dependencySchema>;

export function DependencyDialog({
  issue,
  pending,
  onSave,
  onClose,
}: {
  issue: OperationalIssue;
  pending: boolean;
  onSave: (input: DependencyInput) => void;
  onClose: () => void;
}) {
  const form = useForm<DependencyValues>({
    resolver: zodResolver(dependencySchema),
    defaultValues: { reason: "", kind: "", owner: "", blockedActionId: "", reviewBy: "" },
  });
  const { errors } = form.formState;

  return (
    <Dialog
      title="Record a dependency"
      description="Dependencies stay open across shifts until someone resolves or bypasses them."
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="dependency-form" disabled={pending}>{pending ? "Saving…" : "Record dependency"}</button>
        </>
      }
    >
      <form
        id="dependency-form"
        className="form-grid"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          onSave({
            reason: values.reason,
            kind: values.kind,
            owner: values.owner,
            blockedActionId: values.blockedActionId || null,
            reviewBy: fromLocalInput(values.reviewBy) ?? values.reviewBy,
          }),
        )}
      >
        <Field label="What is the work waiting for" error={errors.reason?.message} wide>
          <textarea data-autofocus rows={3} aria-invalid={Boolean(errors.reason)} {...form.register("reason")} />
        </Field>
        <Field label="Kind" error={errors.kind?.message}>
          <select aria-invalid={Boolean(errors.kind)} {...form.register("kind")}>
            <option value="">Choose a kind</option>
            {dependencyKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Who can clear it" error={errors.owner?.message}>
          <select aria-invalid={Boolean(errors.owner)} {...form.register("owner")}>
            <option value="">Choose a person or team</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Blocks this action (optional)">
          <select {...form.register("blockedActionId")}>
            <option value="">The issue as a whole</option>
            {activeActions(issue).map((action) => <option key={action.id} value={action.id}>{action.title}</option>)}
          </select>
        </Field>
        <Field label="Review by (site time)" error={errors.reviewBy?.message}>
          <input type="datetime-local" aria-invalid={Boolean(errors.reviewBy)} {...form.register("reviewBy")} />
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Resolve or bypass a dependency ----------------------------------------------------------------

export function ResolveDependencyDialog({
  dependency,
  mode,
  pending,
  onSave,
  onClose,
}: {
  dependency: IssueDependency;
  mode: "resolved" | "bypassed";
  pending: boolean;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = note.trim().length < 8;
  const bypass = mode === "bypassed";

  return (
    <Dialog
      title={bypass ? "Bypass this dependency" : "Mark dependency resolved"}
      description={dependency.reason}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button
            className="button button--primary"
            disabled={pending}
            onClick={() => (invalid ? setTouched(true) : onSave(note.trim()))}
          >
            {pending ? "Saving…" : bypass ? "Record bypass" : "Mark resolved"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field
          label={bypass ? "Justification" : "How was it resolved"}
          hint={bypass ? "A bypass is allowed with a clear justification. It is kept in the history." : "Say what changed and who confirmed it."}
          error={touched && invalid ? "Add at least eight characters." : undefined}
          wide
        >
          <textarea data-autofocus rows={4} value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={touched && invalid} />
        </Field>
      </div>
    </Dialog>
  );
}

// ---- Move the issue to its next state ---------------------------------------------------------------

const consequences: Partial<Record<TransitionOption["to"], string>> = {
  action_assigned: "The accountable owner is notified.",
  resolution_reported: "This reports a resolution. It does not verify it, and it is not permission to operate equipment.",
  verified: "Verification confirms the evidence. It does not authorise operation, and the issue stays open until it is closed.",
  closed: "The full history is kept. A Mine Manager can reopen the issue with a reason.",
  reopened: "The issue goes back to an active, non-closed state and the people involved are notified.",
  cancelled: "The issue stays on record as cancelled. It cannot be changed afterwards.",
  duplicate: "The issue stays on record and points to the original. It cannot be changed afterwards.",
};

export function TransitionDialog({
  issue,
  option,
  pending,
  onSave,
  onClose,
}: {
  issue: OperationalIssue;
  option: TransitionOption;
  pending: boolean;
  onSave: (input: { note?: string; reference?: string }) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const noteInvalid = option.noteLabel !== null && note.trim().length < 8;
  const referenceInvalid = option.needsReference && !reference.trim();
  const needsInput = option.noteLabel !== null || option.needsReference;

  const submit = () => {
    if (noteInvalid || referenceInvalid) return setTouched(true);
    onSave({ note: note.trim() || undefined, reference: reference.trim() || undefined });
  };

  return (
    <Dialog
      title={option.label}
      description={`${issue.issueNumber} · ${issue.title}`}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className={`button ${option.tone === "danger" ? "button--danger" : "button--primary"}`} onClick={submit} disabled={pending} data-autofocus={needsInput ? undefined : true}>
            {pending ? "Saving…" : option.label}
          </button>
        </>
      }
    >
      <div className="dialog__stack">
        {consequences[option.to] ? <p className="dialog__text">{consequences[option.to]}</p> : null}
        {option.needsReference ? (
          <Field label="Duplicate of (issue number)" error={touched && referenceInvalid ? "Enter the issue number this duplicates." : undefined}>
            <input data-autofocus value={reference} onChange={(event) => setReference(event.target.value)} placeholder="RIV-2025-039" aria-invalid={touched && referenceInvalid} />
          </Field>
        ) : null}
        {option.noteLabel ? (
          <Field label={option.noteLabel} error={touched && noteInvalid ? "Add at least eight characters." : undefined}>
            <textarea data-autofocus={option.needsReference ? undefined : true} rows={4} value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={touched && noteInvalid} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
