"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { MaintenancePlan } from "@vesper/api-contracts";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { fromLocalInput, toLocalInput } from "@/lib/demo-clock";
import { categories, categoryLabels, type EquipmentView } from "@/lib/equipment-rules";
import type { EquipmentFormInput, PlanInput, ServiceInput } from "./use-equipment-mutations";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { Select } from "./select";
import { DateTimeInput } from "./date-fields";

type Option = { id: string; name: string };

const optionalNumber = (label: string, rules: { positive?: boolean; max?: number } = {}) =>
  z.string().refine((value) => {
    if (value.trim() === "") return true;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return false;
    if (rules.positive && parsed === 0) return false;
    return rules.max === undefined || parsed <= rules.max;
  }, `Enter ${label} as a number, or leave it blank.`);

const toNumber = (value: string) => (value.trim() === "" ? null : Number(value));
const toText = (value: string) => value.trim() || null;

// ---- Add or edit equipment ----------------------------------------------------------------------

const equipmentSchema = z.object({
  name: z.string().trim().min(3, "Use at least three characters."),
  code: z.string().trim().min(2, "Enter an asset code, for example EX-204."),
  category: z.string().min(1, "Choose a category."),
  areaId: z.string(),
  makeModel: z.string(),
  serialNumber: z.string(),
  hours: optionalNumber("the hours"),
  hoursPerDay: optionalNumber("the hours per day", { positive: true, max: 24 }),
  notes: z.string(),
});

type EquipmentValues = z.infer<typeof equipmentSchema>;

export function EquipmentFormDialog({
  item,
  areas,
  pending,
  onSave,
  onClose,
}: {
  item?: EquipmentView;
  areas: Option[];
  pending: boolean;
  onSave: (input: EquipmentFormInput) => void;
  onClose: () => void;
}) {
  const form = useForm<EquipmentValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: item?.name ?? "",
      code: item?.code ?? "",
      category: item?.category ?? "",
      areaId: item?.areaId ?? "",
      makeModel: item?.makeModel ?? "",
      serialNumber: item?.serialNumber ?? "",
      hours: "",
      hoursPerDay: item?.hoursPerDay ? String(item.hoursPerDay) : "",
      notes: item?.notes ?? "",
    },
  });
  const { errors } = form.formState;

  return (
    <Dialog
      title={item ? "Edit equipment" : "Add equipment"}
      description={item ? `${item.code}. Every change is recorded in the history.` : "Add a machine, vehicle or plant item to the register."}
      size="wide"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="equipment-form" disabled={pending}>{pending ? "Saving…" : item ? "Save changes" : "Add equipment"}</button>
        </>
      }
    >
      <form
        id="equipment-form"
        className="form-grid"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          onSave({
            name: values.name,
            code: values.code,
            category: values.category,
            areaId: values.areaId || null,
            makeModel: toText(values.makeModel),
            serialNumber: toText(values.serialNumber),
            hoursPerDay: toNumber(values.hoursPerDay),
            notes: toText(values.notes),
            ...(item ? {} : { hours: toNumber(values.hours) }),
          }),
        )}
      >
        <Field label="Name" error={errors.name?.message} wide>
          <input data-autofocus placeholder="For example, Haul Truck HT-301" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Asset code" error={errors.code?.message} hint="Short and unique. Shown on the map, in search and on issues.">
          <input placeholder="HT-301" aria-invalid={Boolean(errors.code)} {...form.register("code")} />
        </Field>
        <Field label="Category" error={errors.category?.message}>
          <Select aria-invalid={Boolean(errors.category)} {...form.register("category")}>
            <option value="">Choose a category</option>
            {categories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
          </Select>
        </Field>
        <Field label="Make and model">
          <input placeholder="Komatsu PC1250" {...form.register("makeModel")} />
        </Field>
        <Field label="Serial number">
          <input {...form.register("serialNumber")} />
        </Field>
        <Field label="Operating area">
          <Select {...form.register("areaId")}>
            <option value="">Not assigned</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </Select>
        </Field>
        <Field label="Average hours per day" error={errors.hoursPerDay?.message} hint="Used to estimate when a service is due.">
          <input inputMode="decimal" aria-invalid={Boolean(errors.hoursPerDay)} {...form.register("hoursPerDay")} />
        </Field>
        {item ? null : (
          <Field label="Current meter reading (hours)" error={errors.hours?.message} hint="You can record this later.">
            <input inputMode="decimal" aria-invalid={Boolean(errors.hours)} {...form.register("hours")} />
          </Field>
        )}
        <Field label="Notes" wide>
          <textarea rows={3} {...form.register("notes")} />
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Availability ----------------------------------------------------------------------------------

export function StateDialog({
  item,
  pending,
  onSave,
  onClose,
}: {
  item: EquipmentView;
  pending: boolean;
  onSave: (input: { state: "available" | "unavailable"; note?: string }) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<"available" | "unavailable">(item.state === "available" ? "unavailable" : "available");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const noteInvalid = state === "unavailable" && note.trim().length < 8;

  return (
    <Dialog
      title="Report availability"
      description={`${item.code} · ${item.name}. This is a report. It is not verification or permission to operate.`}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="button button--primary" disabled={pending} onClick={() => (noteInvalid ? setTouched(true) : onSave({ state, note: note.trim() || undefined }))}>{pending ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="dialog__stack">
        <fieldset className="choice-group">
          <legend>Status</legend>
          {(["available", "unavailable"] as const).map((value) => (
            <label key={value} className={`choice ${state === value ? "choice--selected" : ""}`}>
              <input type="radio" name="state" checked={state === value} onChange={() => setState(value)} />
              <span><strong>{value === "available" ? "Available" : "Unavailable"}</strong><small>{value === "available" ? "Reported as ready for work." : "Reported as not available for work."}</small></span>
            </label>
          ))}
        </fieldset>
        <Field label={state === "unavailable" ? "Reason" : "Note (optional)"} error={touched && noteInvalid ? "Add at least eight characters." : undefined}>
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={touched && noteInvalid} />
        </Field>
      </div>
    </Dialog>
  );
}

// ---- Meter reading ----------------------------------------------------------------------------------

export function ReadingDialog({
  item,
  pending,
  onSave,
  onClose,
}: {
  item: EquipmentView;
  pending: boolean;
  onSave: (input: { hours: number; correction?: boolean; note?: string }) => void;
  onClose: () => void;
}) {
  const [hours, setHours] = useState("");
  const [correction, setCorrection] = useState(false);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const parsed = Number(hours);
  const hoursInvalid = hours.trim() === "" || Number.isNaN(parsed) || parsed < 0;
  const lower = item.hours !== null && !hoursInvalid && parsed < item.hours;
  const noteInvalid = correction && note.trim().length < 8;

  return (
    <Dialog
      title="Record meter reading"
      description={item.hours !== null ? `Last reading: ${item.hours.toLocaleString("en-GB")} hours.` : "No reading has been recorded yet."}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            className="button button--primary"
            disabled={pending}
            onClick={() => (hoursInvalid || (lower && !correction) || noteInvalid ? setTouched(true) : onSave({ hours: parsed, correction: correction || undefined, note: note.trim() || undefined }))}
          >
            {pending ? "Saving…" : "Record reading"}
          </button>
        </>
      }
    >
      <div className="dialog__stack">
        <Field label="Operating hours on the meter" error={touched && hoursInvalid ? "Enter the hours as a number." : touched && lower && !correction ? "That is lower than the last reading. Tick the box below if the last reading was wrong." : undefined}>
          <input data-autofocus inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} aria-invalid={touched && (hoursInvalid || (lower && !correction))} />
        </Field>
        <label className={`choice ${correction ? "choice--selected" : ""}`}>
          <input type="checkbox" checked={correction} onChange={(event) => setCorrection(event.target.checked)} />
          <span><strong>This corrects an earlier reading</strong><small>A meter never goes down on its own. Say why it changed.</small></span>
        </label>
        {correction ? (
          <Field label="Why is it being corrected" error={touched && noteInvalid ? "Add at least eight characters." : undefined}>
            <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={touched && noteInvalid} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

// ---- Maintenance plan ---------------------------------------------------------------------------------

const planSchema = z.object({
  name: z.string().trim().min(3, "Use at least three characters."),
  basis: z.enum(["hours", "days"]),
  interval: z.string().refine((value) => value.trim() !== "" && Number(value) > 0, "Enter how often, as a number above zero."),
  lastServiceHours: optionalNumber("the hours"),
  lastServiceAt: z.string(),
});

type PlanValues = z.infer<typeof planSchema>;

export function PlanDialog({
  item,
  plan,
  pending,
  onSave,
  onClose,
}: {
  item: EquipmentView;
  plan?: MaintenancePlan;
  pending: boolean;
  onSave: (input: PlanInput) => void;
  onClose: () => void;
}) {
  const form = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: plan?.name ?? "",
      basis: plan?.basis ?? "hours",
      interval: plan ? String(plan.interval) : "",
      lastServiceHours: plan?.lastServiceHours != null ? String(plan.lastServiceHours) : "",
      lastServiceAt: toLocalInput(plan?.lastServiceAt ?? null),
    },
  });
  const { errors } = form.formState;
  const basis = useWatch({ control: form.control, name: "basis" });

  return (
    <Dialog
      title={plan ? "Edit maintenance plan" : "Add maintenance plan"}
      description={`${item.code} · ${item.name}. VESPER works out when the next service is due.`}
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="plan-form" disabled={pending}>{pending ? "Saving…" : plan ? "Save plan" : "Add plan"}</button>
        </>
      }
    >
      <form
        id="plan-form"
        className="form-grid"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          onSave({
            name: values.name,
            basis: values.basis,
            interval: Number(values.interval),
            lastServiceHours: values.basis === "hours" ? toNumber(values.lastServiceHours) : null,
            lastServiceAt: values.basis === "days" ? fromLocalInput(values.lastServiceAt) : null,
          }),
        )}
      >
        <Field label="Plan name" error={errors.name?.message} wide>
          <input data-autofocus placeholder="For example, 500 hour service" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <fieldset className="choice-group form-field--wide">
          <legend>Repeats every</legend>
          <div className="choice-row">
            {(["hours", "days"] as const).map((value) => (
              <label key={value} className={`choice ${basis === value ? "choice--selected" : ""}`}>
                <input type="radio" value={value} {...form.register("basis")} />
                <span><strong>{value === "hours" ? "Operating hours" : "Calendar days"}</strong><small>{value === "hours" ? "Based on the meter reading." : "Based on the date of the last service."}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={basis === "hours" ? "Interval (hours)" : "Interval (days)"} error={errors.interval?.message}>
          <input inputMode="decimal" aria-invalid={Boolean(errors.interval)} {...form.register("interval")} />
        </Field>
        {basis === "hours" ? (
          <Field label="Hours at the last service" error={errors.lastServiceHours?.message} hint="Leave blank if it has not been done yet.">
            <input inputMode="decimal" aria-invalid={Boolean(errors.lastServiceHours)} {...form.register("lastServiceHours")} />
          </Field>
        ) : (
          <Field label="Date of the last service (site time)">
            <DateTimeInput {...form.register("lastServiceAt")} />
          </Field>
        )}
      </form>
    </Dialog>
  );
}

// ---- Log a service, inspection or repair -----------------------------------------------------------------

const serviceSchema = z.object({
  type: z.enum(["service", "inspection", "repair"]),
  summary: z.string().trim().min(8, "Say what was done, in at least eight characters."),
  performedAt: z.string(),
  hours: optionalNumber("the hours"),
  planId: z.string(),
  workOrderRef: z.string(),
});

type ServiceValues = z.infer<typeof serviceSchema>;

export function ServiceDialog({
  item,
  planId,
  pending,
  onSave,
  onClose,
}: {
  item: EquipmentView;
  planId?: string;
  pending: boolean;
  onSave: (input: ServiceInput) => void;
  onClose: () => void;
}) {
  const form = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      type: "service",
      summary: "",
      performedAt: "",
      hours: item.hours !== null ? String(item.hours) : "",
      planId: planId ?? "",
      workOrderRef: "",
    },
  });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  return (
    <Dialog
      title="Log service history"
      description={`${item.code} · ${item.name}. Entries are kept as history and are not edited afterwards.`}
      size="wide"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="button button--primary" form="service-form" disabled={pending}>{pending ? "Saving…" : "Log entry"}</button>
        </>
      }
    >
      <form
        id="service-form"
        className="form-grid"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          onSave({
            type: values.type,
            summary: values.summary,
            performedAt: fromLocalInput(values.performedAt),
            hours: toNumber(values.hours),
            planId: values.type === "service" ? values.planId || null : null,
            workOrderRef: toText(values.workOrderRef),
          }),
        )}
      >
        <Field label="Type">
          <Select {...form.register("type")}>
            <option value="service">Service</option>
            <option value="inspection">Inspection</option>
            <option value="repair">Repair</option>
          </Select>
        </Field>
        <Field label="Meter reading (hours)" error={errors.hours?.message}>
          <input inputMode="decimal" aria-invalid={Boolean(errors.hours)} {...form.register("hours")} />
        </Field>
        <Field label="What was done" error={errors.summary?.message} wide>
          <textarea data-autofocus rows={3} aria-invalid={Boolean(errors.summary)} {...form.register("summary")} />
        </Field>
        {type === "service" && item.plans.length > 0 ? (
          <Field label="Completes this plan" hint="Choosing a plan restarts its countdown." wide>
            <Select {...form.register("planId")}>
              <option value="">No plan</option>
              {item.plans.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <Field label="When (site time)" hint="Leave blank for now.">
          <DateTimeInput {...form.register("performedAt")} />
        </Field>
        <Field label="Work order reference" hint="From the maintenance system, if there is one.">
          <input {...form.register("workOrderRef")} />
        </Field>
      </form>
    </Dialog>
  );
}

// ---- Retire ----------------------------------------------------------------------------------------------------

export function RetireDialog({
  item,
  pending,
  onSave,
  onClose,
}: {
  item: EquipmentView;
  pending: boolean;
  onSave: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = reason.trim().length < 8;
  return (
    <Dialog
      title="Retire this equipment"
      description={`${item.code} · ${item.name}`}
      size="narrow"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" onClick={onClose} disabled={pending}>Keep active</button>
          <button className="button button--danger" disabled={pending} onClick={() => (invalid ? setTouched(true) : onSave(reason.trim()))}>{pending ? "Retiring…" : "Retire equipment"}</button>
        </>
      }
    >
      <div className="dialog__stack">
        <p className="dialog__text">Retired equipment leaves the active register and can no longer be changed. Its history is kept, and you can restore it later.</p>
        <Field label="Why is it being retired" error={touched && invalid ? "Add at least eight characters." : undefined}>
          <textarea data-autofocus rows={3} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={touched && invalid} />
        </Field>
      </div>
    </Dialog>
  );
}
