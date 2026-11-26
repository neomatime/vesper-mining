"use client";

/**
 * The dialog for adding or editing an approved service provider.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import type { ServiceProvider } from "@vesper/api-contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { categories, categoryLabels } from "@/lib/equipment-rules";
import { isValidEmail } from "@/lib/organisation-rules";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { Select } from "./select";
import type { ProviderInput } from "./use-service";
import { DateInput } from "./date-fields";
import { Busy } from "./busy";

const providerSchema = z.object({
  name: z.string().trim().min(3, "Enter the company name."),
  registration: z.string(),
  contactName: z.string(),
  email: z.string().trim().refine((value) => value === "" || isValidEmail(value), "Enter a valid email address, or leave it blank."),
  phone: z.string(),
  categories: z.array(z.string()).min(1, "Choose at least one kind of equipment or infrastructure they service."),
  approvedUntil: z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a date, or leave it blank."),
  notes: z.string(),
  specialisation: z.string(),
  serviceAreas: z.string(),
  responseHours: z.string().refine((value) => value.trim() === "" || (Number(value) > 0 && Number(value) <= 720), "Enter the response time in hours, or leave it blank."),
  approval: z.string(),
});

export function ProviderDialog({
  provider,
  canApprove = false,
  pending,
  onSave,
  onClose,
}: {
  provider?: ServiceProvider;
  /** Whether the person may choose the approval status. Everyone else adds a provider as pending. */
  canApprove?: boolean;
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
      specialisation: provider?.specialisation ?? "",
      serviceAreas: provider ? provider.serviceAreas.join(", ") : "Riverside Mine",
      responseHours: provider?.responseHours ? String(provider.responseHours) : "",
      approval: provider?.approval ?? "pending",
    },
  });
  const [documents, setDocuments] = useState<{ name: string; sizeLabel: string }[]>(provider?.documents ?? []);
  const { errors } = form.formState;

  return (
    <Dialog
      title={provider ? `Edit ${provider.name}` : "Add a service provider"}
      description={provider ? "Every change is recorded in the provider's history." : "A new provider is pending until the Mine Manager approves it. Only approved providers can be given repair requests."}
      size="wide"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="button button--primary" form="provider-form" disabled={pending}><Busy pending={pending} label="Saving…">{provider ? "Save changes" : "Add provider"}</Busy></button>
        </>
      }
    >
      <form id="provider-form" className="form-grid" noValidate onSubmit={form.handleSubmit((values) => onSave({ ...values, documents, ...(canApprove || provider ? {} : { approval: "pending" }) }))}>
        <Field label="Company name" error={errors.name?.message} wide>
          <input data-autofocus aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Company registration number"><input {...form.register("registration")} /></Field>
        <Field label="Service specialisation" hint="For example: Crushers, conveyors, processing equipment."><input {...form.register("specialisation")} /></Field>
        <Field label="Approved for this mine until" error={errors.approvedUntil?.message} hint="Leave blank if the approval has no end date."><DateInput {...form.register("approvedUntil")} /></Field>
        <Field label="Contact person"><input {...form.register("contactName")} /></Field>
        <Field label="Phone"><input type="tel" {...form.register("phone")} /></Field>
        <Field label="Email address" error={errors.email?.message} wide><input type="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} /></Field>
        <fieldset className="form-field form-field--wide check-group">
          <legend>Equipment and infrastructure they service</legend>
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
        <Field label="Service areas" hint="Separate areas with commas."><input {...form.register("serviceAreas")} /></Field>
        <Field label="Expected response time (hours)" error={errors.responseHours?.message} hint="The expected or contracted response time. Leave blank if not agreed."><input inputMode="decimal" aria-invalid={Boolean(errors.responseHours)} {...form.register("responseHours")} /></Field>
        {canApprove && !provider ? (
          <Field label="Approval status" hint="New providers are pending unless you approve them here.">
            <Select {...form.register("approval")}>
              <option value="pending">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        ) : null}
        <Field label="Certifications and supporting documents" wide hint="Optional. Only the file names are kept in this prototype.">
          <input
            type="file"
            multiple
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []).map((file) => ({ name: file.name, sizeLabel: file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB` }));
              setDocuments([...documents, ...picked].slice(0, 10));
              event.target.value = "";
            }}
          />
          {documents.length > 0 ? (
            <span className="chip-row">
              {documents.map((file, index) => (
                <span className="chip" key={`${file.name}-${index}`}>{file.name} <small>{file.sizeLabel}</small> <button type="button" className="link-button" aria-label={`Remove ${file.name}`} onClick={() => setDocuments(documents.filter((_, at) => at !== index))}>×</button></span>
              ))}
            </span>
          ) : null}
        </Field>
        <Field label="Notes" wide><textarea rows={3} {...form.register("notes")} /></Field>
      </form>
    </Dialog>
  );
}
