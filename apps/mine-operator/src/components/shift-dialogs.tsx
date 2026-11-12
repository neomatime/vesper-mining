"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { OperationalIssue } from "@vesper/api-contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useOwners, useSupervisors } from "./use-directory";
import { crewDuties, type ShiftView } from "@/lib/shift-rules";
import { toDateTimeParts } from "@/lib/shift-format";
import type { CrewInput, ShiftFormInput, WorkInput } from "./use-shift-mutations";
import { Dialog } from "./dialog";
import { Field } from "./form-field";

type Option = { id: string; name: string };


// ---- Create or edit a shift ------------------------------------------------------------------------

const shiftSchema = z.object({
  name: z.string().trim().min(3, "Use at least three characters."),
  date: z.string().min(1, "Choose the date."),
  start: z.string().min(1, "Set the start time."),
  end: z.string().min(1, "Set the end time."),
  supervisor: z.string(),
  briefing: z.string(),
});

type ShiftValues = z.infer<typeof shiftSchema>;

export function ShiftFormDialog({
  shift,
  suggestion,
  pending,
  onSave,
  onClose,
}: {
  shift?: ShiftView;
  suggestion?: { name: string; date: string; start: string; end: string };
  pending: boolean;
  onSave: (input: Partial<ShiftFormInput>) => void;
  onClose: () => void;
}) {
  const supervisors = useSupervisors();
  const start = shift ? toDateTimeParts(shift.startsAt) : null;
  const end = shift ? toDateTimeParts(shift.endsAt) : null;
  const running = shift?.state === "in_progress";
  const form = useForm<ShiftValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: shift?.name ?? suggestion?.name ?? "",
      date: start?.date ?? suggestion?.date ?? "",
      start: start?.time ?? suggestion?.start ?? "06:00",
      end: end?.time ?? suggestion?.end ?? "14:00",
      supervisor: shift?.supervisor ?? "",
      briefing: shift?.briefing ?? "",
    },
  });
  const { errors } = form.formState;

  return (
    <Dialog
      title={shift ? "Edit shift" : "Create a shift"}
      description={shift ? (running ? "This shift is running, so only the briefing can change." : `${shift.name}. Every change is recorded.`) : "Schedule who leads the shift and when it runs."}
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="shift-form" disabled={pending}>{pending ? "Saving…" : shift ? "Save changes" : "Create shift"}</button>
        </>
      }
    >
      <form
        id="shift-form"
        className="form-grid"
        noValidate
        onSubmit={
          running
            ? (event) => {
                event.preventDefault();
                onSave({ briefing: form.getValues("briefing").trim() || null });
              }
            : form.handleSubmit((values) =>
          onSave({
            name: values.name,
            date: values.date,
            start: values.start,
            end: values.end,
            supervisor: values.supervisor || null,
            briefing: values.briefing.trim() || null,
          }),
        )
        }
      >
        <Field label="Shift name" error={errors.name?.message} hint="For example, Shift A.">
          <input data-autofocus disabled={running} aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Supervisor" hint="Needed before the shift can start.">
          <select disabled={running} {...form.register("supervisor")}>
            <option value="">Not assigned yet</option>
            {supervisors.map((person) => <option key={person.name} value={person.name}>{person.name}</option>)}
          </select>
        </Field>
        <Field label="Date" error={errors.date?.message}>
          <input type="date" disabled={running} aria-invalid={Boolean(errors.date)} {...form.register("date")} />
        </Field>
        <div className="form-pair">
          <Field label="Starts" error={errors.start?.message}>
            <input type="time" disabled={running} aria-invalid={Boolean(errors.start)} {...form.register("start")} />
          </Field>
          <Field label="Ends" error={errors.end?.message}>
            <input type="time" disabled={running} aria-invalid={Boolean(errors.end)} {...form.register("end")} />
          </Field>
        </div>
        <p className="field-hint form-field--wide">Times are site time. If the end is before the start, the shift ends the next day.</p>
        <Field label="Briefing" hint="What the crew should know before they start." wide>
          <textarea rows={3} {...form.register("briefing")} />
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Add crew ------------------------------------------------------------------------------------------------

const crewSchema = z.object({
  name: z.string().min(1, "Choose a person."),
  duty: z.string().trim().min(3, "Say what they do on this shift."),
  equipmentId: z.string(),
});

type CrewValues = z.infer<typeof crewSchema>;

export function CrewDialog({
  shift,
  equipment,
  pending,
  onSave,
  onClose,
}: {
  shift: ShiftView;
  equipment: Option[];
  pending: boolean;
  onSave: (input: CrewInput) => void;
  onClose: () => void;
}) {
  const owners = useOwners();
  const form = useForm<CrewValues>({ resolver: zodResolver(crewSchema), defaultValues: { name: "", duty: "", equipmentId: "" } });
  const { errors } = form.formState;
  const taken = new Set([shift.supervisor, ...shift.crew.map((member) => member.name)]);

  return (
    <Dialog
      title="Add to the shift"
      description={shift.name}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="crew-form" disabled={pending}>{pending ? "Adding…" : "Add to shift"}</button>
        </>
      }
    >
      <form id="crew-form" className="form-grid" noValidate onSubmit={form.handleSubmit((values) => onSave({ name: values.name, duty: values.duty, equipmentId: values.equipmentId || null }))}>
        <Field label="Person" error={errors.name?.message} wide>
          <select data-autofocus aria-invalid={Boolean(errors.name)} {...form.register("name")}>
            <option value="">Choose a person</option>
            {owners.filter((name) => !taken.has(name)).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Duty" error={errors.duty?.message} wide>
          <input list="crew-duties" placeholder="For example, Excavator operator" aria-invalid={Boolean(errors.duty)} {...form.register("duty")} />
          <datalist id="crew-duties">{crewDuties.map((duty) => <option key={duty} value={duty} />)}</datalist>
        </Field>
        <Field label="Equipment (optional)" wide>
          <select {...form.register("equipmentId")}>
            <option value="">None</option>
            {equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Add work -----------------------------------------------------------------------------------------------------

const workSchema = z.object({
  issueId: z.string(),
  title: z.string().trim().min(4, "Use at least four characters."),
  owner: z.string(),
});

type WorkValues = z.infer<typeof workSchema>;

export function WorkDialog({
  shift,
  issues,
  pending,
  onSave,
  onClose,
}: {
  shift: ShiftView;
  issues: OperationalIssue[];
  pending: boolean;
  onSave: (input: WorkInput) => void;
  onClose: () => void;
}) {
  const owners = useOwners();
  const attached = new Set(shift.work.map((item) => item.issueId));
  const available = issues.filter((issue) => !attached.has(issue.id));
  const form = useForm<WorkValues>({ resolver: zodResolver(workSchema), defaultValues: { issueId: "", title: "", owner: "" } });
  const { errors } = form.formState;

  return (
    <Dialog
      title="Add work to the shift"
      description={shift.name}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="work-form" disabled={pending}>{pending ? "Adding…" : "Add work"}</button>
        </>
      }
    >
      <form id="work-form" className="form-grid" noValidate onSubmit={form.handleSubmit((values) => onSave({ title: values.title, owner: values.owner || null, issueId: values.issueId || null }))}>
        <Field label="Attach an open issue (optional)" hint="The task follows the issue, so it stays visible across shifts." wide>
          <select
            {...form.register("issueId", {
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                const issue = available.find((item) => item.id === event.target.value);
                if (issue && !form.getValues("title")) form.setValue("title", `Follow up: ${issue.title}`);
                if (issue?.owner && !form.getValues("owner")) form.setValue("owner", issue.owner);
              },
            })}
          >
            <option value="">No issue</option>
            {available.map((issue) => <option key={issue.id} value={issue.id}>{issue.issueNumber} · {issue.title}</option>)}
          </select>
        </Field>
        <Field label="What needs doing" error={errors.title?.message} wide>
          <input data-autofocus aria-invalid={Boolean(errors.title)} {...form.register("title")} />
        </Field>
        <Field label="Who does it" wide>
          <select {...form.register("owner")}>
            <option value="">Not assigned yet</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Cancel ---------------------------------------------------------------------------------------------------------

export function CancelShiftDialog({
  shift,
  pending,
  onSave,
  onClose,
}: {
  shift: ShiftView;
  pending: boolean;
  onSave: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = reason.trim().length < 8;
  return (
    <Dialog
      title="Cancel this shift"
      description={shift.name}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending}>Keep the shift</button>
          <button className="button button--danger" disabled={pending} onClick={() => (invalid ? setTouched(true) : onSave(reason.trim()))}>{pending ? "Cancelling…" : "Cancel shift"}</button>
        </>
      }
    >
      <div className="dialog__stack">
        <p className="dialog__text">The shift stays on the roster as cancelled, with its reason, and can no longer be changed.</p>
        <Field label="Why is it being cancelled" error={touched && invalid ? "Add at least eight characters." : undefined}>
          <textarea data-autofocus rows={3} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={touched && invalid} />
        </Field>
      </div>
    </Dialog>
  );
}
