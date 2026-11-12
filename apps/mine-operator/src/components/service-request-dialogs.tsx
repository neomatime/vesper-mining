"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { DateInput } from "./date-fields";

function Footer({ pending, onClose, form, label }: { pending: boolean; onClose: () => void; form: string; label: string }) {
  return (
    <>
      <button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Cancel</button>
      <button className="button button--primary" form={form} disabled={pending}>{pending ? "Saving…" : label}</button>
    </>
  );
}

// ---- Schedule --------------------------------------------------------------------------------------

export function ScheduleDialog({ current, pending, onSave, onClose }: { current: string | null; pending: boolean; onSave: (date: string) => void; onClose: () => void }) {
  const form = useForm<{ date: string }>({ defaultValues: { date: current ?? "" } });
  const date = useWatch({ control: form.control, name: "date" });
  return (
    <Dialog
      title="Book the work"
      description="Record the date the provider is booked to do the work."
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={<Footer pending={pending} onClose={onClose} form="schedule-form" label="Save booking" />}
    >
      <form id="schedule-form" className="form-grid" onSubmit={form.handleSubmit((values) => values.date && onSave(values.date))}>
        <Field label="Date" wide><DateInput data-autofocus  required {...form.register("date")} /></Field>
        {!date ? <p className="form-note">Choose a date to continue.</p> : null}
      </form>
    </Dialog>
  );
}

// ---- Complete --------------------------------------------------------------------------------------

const completeSchema = z.object({
  summary: z.string().trim().min(8, "Describe what was done, in at least eight characters."),
  hours: z.string().refine((value) => value.trim() === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), "Enter the meter reading as a number, or leave it blank."),
  workOrderRef: z.string(),
});

export type CompleteValues = z.infer<typeof completeSchema>;

export function CompleteDialog({ title, hasPlan, pending, onSave, onClose }: { title: string; hasPlan: boolean; pending: boolean; onSave: (values: CompleteValues) => void; onClose: () => void }) {
  const form = useForm<CompleteValues>({ resolver: zodResolver(completeSchema), defaultValues: { summary: "", hours: "", workOrderRef: "" } });
  const { errors } = form.formState;
  return (
    <Dialog
      title="Mark the work complete"
      description={hasPlan ? "This logs a service on the equipment and resets the linked maintenance plan." : "This logs a service on the equipment."}
      onClose={onClose}
      locked={pending}
      footer={<Footer pending={pending} onClose={onClose} form="complete-form" label="Complete and log" />}
    >
      <form id="complete-form" className="form-grid" noValidate onSubmit={form.handleSubmit(onSave)}>
        <Field label="What was done" error={errors.summary?.message} wide><textarea data-autofocus rows={3} placeholder={`For example, ${title} completed and checked.`} aria-invalid={Boolean(errors.summary)} {...form.register("summary")} /></Field>
        <Field label="Meter reading at service (hours)" error={errors.hours?.message} hint={hasPlan ? "Needed to work out the next service date." : undefined}><input inputMode="decimal" aria-invalid={Boolean(errors.hours)} {...form.register("hours")} /></Field>
        <Field label="Work order reference" hint="Leave blank to use the request number."><input {...form.register("workOrderRef")} /></Field>
      </form>
    </Dialog>
  );
}

// ---- Cancel ----------------------------------------------------------------------------------------

export function CancelRequestDialog({ pending, onSave, onClose }: { pending: boolean; onSave: (reason: string) => void; onClose: () => void }) {
  const form = useForm<{ reason: string }>({ defaultValues: { reason: "" } });
  const reason = useWatch({ control: form.control, name: "reason" });
  return (
    <Dialog
      title="Cancel this request?"
      description="The request is kept as a record, marked cancelled, and cannot be reopened."
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Keep request</button>
          <button className="button button--danger" form="cancel-form" disabled={pending || reason.trim().length < 4}>{pending ? "Saving…" : "Cancel request"}</button>
        </>
      }
    >
      <form id="cancel-form" className="form-grid" onSubmit={form.handleSubmit((values) => onSave(values.reason))}>
        <Field label="Why is it being cancelled?" wide><textarea data-autofocus rows={3} {...form.register("reason")} /></Field>
      </form>
    </Dialog>
  );
}
