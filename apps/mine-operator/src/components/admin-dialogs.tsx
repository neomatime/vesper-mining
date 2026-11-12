"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Company, Member, SiteDetails } from "@vesper/api-contracts";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { isValidEmail, roleCatalogue, timezones } from "@/lib/organisation-rules";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import type { MemberInput } from "./use-organisation";

type Footer = { pending: boolean; onClose: () => void; form: string; label: string };

function DialogFooter({ pending, onClose, form, label }: Footer) {
  return (
    <>
      <button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Cancel</button>
      <button className="button button--primary" form={form} disabled={pending}>{pending ? "Saving…" : label}</button>
    </>
  );
}

// ---- Invite or edit a person -----------------------------------------------------------------------

const memberSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's full name."),
  email: z.string().trim().refine(isValidEmail, "Enter a valid work email address."),
  role: z.string().min(1, "Choose a role."),
});

export function MemberDialog({
  member,
  pending,
  onSave,
  onClose,
}: {
  member?: Member;
  pending: boolean;
  onSave: (input: Partial<MemberInput>) => void;
  onClose: () => void;
}) {
  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: member?.name ?? "", email: member?.email ?? "", role: member?.role ?? "" },
  });
  const { errors } = form.formState;
  const chosenRole = useWatch({ control: form.control, name: "role" });
  // A person who has signed in keeps the name and email on their records. Only the role can change.
  const identityLocked = Boolean(member && member.status !== "invited");

  return (
    <Dialog
      title={member ? `Edit ${member.name}` : "Invite a person"}
      description={member ? "Role changes take effect the next time they open VESPER." : "They receive an invitation and can sign in with their work email address."}
      onClose={onClose}
      locked={pending}
      footer={<DialogFooter pending={pending} onClose={onClose} form="member-form" label={member ? "Save changes" : "Send invitation"} />}
    >
      <form
        id="member-form"
        className="form-grid"
        noValidate
        onSubmit={form.handleSubmit((values) => onSave(member ? { ...(identityLocked ? {} : { name: values.name, email: values.email }), role: values.role } : values))}
      >
        <Field label="Full name" error={errors.name?.message} wide>
          <input data-autofocus={!identityLocked} disabled={identityLocked} aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Work email address" error={errors.email?.message} hint={identityLocked ? "This cannot change after the person has signed in." : undefined} wide>
          <input type="email" inputMode="email" disabled={identityLocked} aria-invalid={Boolean(errors.email)} {...form.register("email")} />
        </Field>
        <Field label="Role" error={errors.role?.message} wide>
          <select data-autofocus={identityLocked} aria-invalid={Boolean(errors.role)} {...form.register("role")}>
            <option value="">Choose a role</option>
            {roleCatalogue.map((item) => <option key={item.role} value={item.role}>{item.role}</option>)}
          </select>
        </Field>
        <p className="form-note">{roleCatalogue.find((item) => item.role === chosenRole)?.scope ?? "A role decides what a person sees and what they can change."}</p>
      </form>
    </Dialog>
  );
}

// ---- Company ---------------------------------------------------------------------------------------

const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name."),
  industry: z.string(),
  registration: z.string(),
  address: z.string(),
  contactName: z.string(),
  contactEmail: z.string().trim().refine((value) => value === "" || isValidEmail(value), "Enter a valid email address, or leave it blank."),
  contactPhone: z.string(),
});

export function CompanyDialog({ company, pending, onSave, onClose }: { company: Company; pending: boolean; onSave: (input: z.infer<typeof companySchema>) => void; onClose: () => void }) {
  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: company.name, industry: company.industry, registration: company.registration, address: company.address, contactName: company.contactName, contactEmail: company.contactEmail, contactPhone: company.contactPhone },
  });
  const { errors } = form.formState;
  return (
    <Dialog title="Edit company details" onClose={onClose} locked={pending} size="wide" footer={<DialogFooter pending={pending} onClose={onClose} form="company-form" label="Save changes" />}>
      <form id="company-form" className="form-grid" noValidate onSubmit={form.handleSubmit(onSave)}>
        <Field label="Company name" error={errors.name?.message} wide><input data-autofocus aria-invalid={Boolean(errors.name)} {...form.register("name")} /></Field>
        <Field label="Industry"><input {...form.register("industry")} /></Field>
        <Field label="Registration number"><input {...form.register("registration")} /></Field>
        <Field label="Address" wide><input {...form.register("address")} /></Field>
        <Field label="Primary contact"><input {...form.register("contactName")} /></Field>
        <Field label="Contact phone"><input type="tel" {...form.register("contactPhone")} /></Field>
        <Field label="Contact email" error={errors.contactEmail?.message} wide><input type="email" aria-invalid={Boolean(errors.contactEmail)} {...form.register("contactEmail")} /></Field>
      </form>
    </Dialog>
  );
}

// ---- Site ------------------------------------------------------------------------------------------

const siteSchema = z.object({
  name: z.string().trim().min(2, "Enter the site name."),
  type: z.string(),
  commodity: z.string(),
  location: z.string(),
  timezone: z.string(),
  operatingHours: z.string(),
  siteContact: z.string(),
});

export function SiteDialog({ site, pending, onSave, onClose }: { site: SiteDetails; pending: boolean; onSave: (input: z.infer<typeof siteSchema>) => void; onClose: () => void }) {
  const form = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: site.name, type: site.type, commodity: site.commodity, location: site.location, timezone: site.timezone, operatingHours: site.operatingHours, siteContact: site.siteContact },
  });
  const { errors } = form.formState;
  return (
    <Dialog title="Edit site details" description="The site name appears across VESPER." onClose={onClose} locked={pending} size="wide" footer={<DialogFooter pending={pending} onClose={onClose} form="site-form" label="Save changes" />}>
      <form id="site-form" className="form-grid" noValidate onSubmit={form.handleSubmit(onSave)}>
        <Field label="Site name" error={errors.name?.message} wide><input data-autofocus aria-invalid={Boolean(errors.name)} {...form.register("name")} /></Field>
        <Field label="Mine type"><input {...form.register("type")} /></Field>
        <Field label="Commodity"><input {...form.register("commodity")} /></Field>
        <Field label="Location" wide><input {...form.register("location")} /></Field>
        <Field label="Time zone">
          <select {...form.register("timezone")}>
            {(timezones.includes(site.timezone) ? timezones : [site.timezone, ...timezones]).map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </Field>
        <Field label="Operating hours"><input {...form.register("operatingHours")} /></Field>
        <Field label="Site contact" wide><input {...form.register("siteContact")} /></Field>
      </form>
    </Dialog>
  );
}
