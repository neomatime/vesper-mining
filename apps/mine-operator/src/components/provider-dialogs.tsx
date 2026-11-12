"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ServiceProvider } from "@vesper/api-contracts";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { categories, categoryLabels } from "@/lib/equipment-rules";
import { isValidEmail } from "@/lib/organisation-rules";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import type { ProviderInput } from "./use-service";

const providerSchema = z.object({
  name: z.string().trim().min(3, "Enter the company name."),
  registration: z.string(),
  contactName: z.string(),
  email: z.string().trim().refine((value) => value === "" || isValidEmail(value), "Enter a valid email address, or leave it blank."),
  phone: z.string(),
  categories: z.array(z.string()).min(1, "Choose at least one kind of equipment they service."),
  approvedUntil: z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a date, or leave it blank."),
  notes: z.string(),
});

export function ProviderDialog({
  provider,
  pending,
  onSave,
  onClose,
}: {
  provider?: ServiceProvider;
  pending: boolean;
  onSave: (input: ProviderInput) => void;
  onClose: () => void;
}) {
  const form = useForm<z.infer<typeof providerSchema>>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: provider?.name ?? "",
      registration: provider?.registration ?? "",
      contactName: provider?.contactName ?? "",
      email: provider?.email ?? "",
      phone: provider?.phone ?? "",
      categories: provider?.categories ?? [],
      approvedUntil: provider?.approvedUntil ?? "",
      notes: provider?.notes ?? "",
    },
  });
  const { errors } = form.formState;

  return (
    <Dialog
      title={provider ? `Edit ${provider.name}` : "Add a service provider"}
      description="Only providers on this list can be asked for quotes. Add the ones already approved to work at this mine."
      size="wide"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="button button--primary" form="provider-form" disabled={pending}>{pending ? "Saving…" : provider ? "Save changes" : "Add provider"}</button>
        </>
      }
    >
      <form id="provider-form" className="form-grid" noValidate onSubmit={form.handleSubmit(onSave)}>
        <Field label="Company name" error={errors.name?.message} wide>
          <input data-autofocus aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Registration number"><input {...form.register("registration")} /></Field>
        <Field label="Approved for this mine until" error={errors.approvedUntil?.message} hint="Leave blank if the approval has no end date."><input type="date" {...form.register("approvedUntil")} /></Field>
        <Field label="Contact person"><input {...form.register("contactName")} /></Field>
        <Field label="Phone"><input type="tel" {...form.register("phone")} /></Field>
        <Field label="Email address" error={errors.email?.message} wide><input type="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} /></Field>
        <fieldset className="form-field form-field--wide check-group">
          <legend>Equipment they service</legend>
          <div className="check-grid">
            {categories.map((category) => (
              <label key={category} className="check-option">
                <input type="checkbox" value={category} {...form.register("categories")} />
                <span>{categoryLabels[category]}</span>
              </label>
            ))}
          </div>
          {errors.categories ? <small className="field-error" role="alert">{errors.categories.message}</small> : null}
        </fieldset>
        <Field label="Notes" wide><textarea rows={3} {...form.register("notes")} /></Field>
      </form>
    </Dialog>
  );
}
