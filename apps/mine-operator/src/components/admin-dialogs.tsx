"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Company, Member, SiteDetails } from "@vesper/api-contracts";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { isValidEmail, roleCatalogue, timezones } from "@/lib/organisation-rules";
import { levelLabels, rightsMatrix } from "@/lib/rights";
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

// ---- Add or edit an employee -----------------------------------------------------------------------

const memberSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's full name."),
  email: z.string().trim().refine(isValidEmail, "Enter a valid work email address."),
  role: z.string().min(1, "Choose a role."),
  phone: z.string(),
  employeeNumber: z.string(),
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
    defaultValues: { name: member?.name ?? "", email: member?.email ?? "", role: member?.role ?? "", phone: member?.phone ?? "", employeeNumber: member?.employeeNumber ?? "" },
  });
  const { errors } = form.formState;
  const chosenRole = useWatch({ control: form.control, name: "role" });
  // A person who has signed in keeps the name on their records.
  const nameLocked = Boolean(member?.lastSignInAt);

  return (
    <Dialog
      title={member ? `Edit ${member.name}` : "Add an employee"}
      description={member ? "Role changes apply the next time they open VESPER." : "You will get a temporary password to share with them. They choose their own at first sign-in."}
      size="wide"
      onClose={onClose}
      locked={pending}
      footer={<DialogFooter pending={pending} onClose={onClose} form="member-form" label={member ? "Save changes" : "Add employee"} />}
    >
      <form id="member-form" className="form-grid" noValidate onSubmit={form.handleSubmit((values) => onSave(member ? { ...values, ...(nameLocked ? { name: member.name } : {}) } : values))}>
        <Field label="Full name" error={errors.name?.message} hint={nameLocked ? "Fixed once someone has signed in, because it appears on their records." : undefined} wide>
          <input data-autofocus={!nameLocked} disabled={nameLocked} aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Work email address" error={errors.email?.message} wide>
          <input type="email" inputMode="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
        </Field>
        <Field label="Phone number"><input type="tel" {...form.register("phone")} /></Field>
        <Field label="Employee number"><input {...form.register("employeeNumber")} /></Field>
        <Field label="Role" error={errors.role?.message} wide>
          <select data-autofocus={nameLocked} aria-invalid={Boolean(errors.role)} {...form.register("role")}>
            <option value="">Choose a role</option>
            {roleCatalogue.map((item) => <option key={item.role} value={item.role}>{item.role}</option>)}
          </select>
        </Field>
        <p className="form-note">{roleCatalogue.find((item) => item.role === chosenRole)?.scope ?? "A role decides what a person sees and what they can change."}</p>
      </form>
    </Dialog>
  );
}

// ---- Temporary password ----------------------------------------------------------------------------

export function TemporaryPasswordDialog({ name, email, password, reason, onClose }: { name: string; email: string; password: string; reason: "added" | "reset"; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Dialog
      title={reason === "added" ? `${name} has been added` : `Password reset for ${name}`}
      description="Share these sign-in details with them. This is the only time the temporary password is shown."
      size="narrow"
      onClose={onClose}
      footer={<button className="button button--primary" onClick={onClose} data-autofocus>Done</button>}
    >
      <dl className="credential-card">
        <div><dt>Email address</dt><dd>{email}</dd></div>
        <div><dt>Temporary password</dt><dd><code>{password}</code><button className="button button--quiet button--small" type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button></dd></div>
      </dl>
      <p className="form-note">They will be asked to choose their own password the first time they sign in. You cannot see it afterwards.</p>
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

// ---- Change role, with a preview of what changes --------------------------------------------------

export function ChangeRoleDialog({ member, pending, onSave, onClose }: { member: Member; pending: boolean; onSave: (role: string) => void; onClose: () => void }) {
  const [role, setRole] = useState(member.role);
  const changes = rightsMatrix
    .map((row) => ({ area: row.area, action: row.action, from: row.levels[member.role] ?? "no", to: row.levels[role] ?? "no" }))
    .filter((row) => row.from !== row.to);
  const gained = changes.filter((row) => row.to !== "no" && (row.from === "no" || row.to === "yes"));
  const lost = changes.filter((row) => !gained.includes(row));

  return (
    <Dialog
      title={`Change the role for ${member.name}`}
      description="A person's rights come from their role. Choosing a different role changes what they can do everywhere in VESPER."
      size="wide"
      onClose={onClose}
      locked={pending}
      footer={
        <>
          <button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="button button--primary" disabled={pending || role === member.role} onClick={() => onSave(role)}>{pending ? "Saving…" : "Change role"}</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Role" wide>
          <select data-autofocus value={role} onChange={(event) => setRole(event.target.value)}>
            {roleCatalogue.map((item) => <option key={item.role} value={item.role}>{item.role}</option>)}
          </select>
        </Field>
      </div>
      {role === member.role ? (
        <p className="form-note">Choose a different role to see what changes.</p>
      ) : (
        <div className="role-diff" aria-live="polite">
          <div>
            <h3>Gains ({gained.length})</h3>
            {gained.length === 0 ? <p className="muted">Nothing new.</p> : <ul>{gained.map((row) => <li key={row.action}><span>{row.action}</span><small>{row.area} · {levelLabels[row.to]}</small></li>)}</ul>}
          </div>
          <div>
            <h3>Loses ({lost.length})</h3>
            {lost.length === 0 ? <p className="muted">Nothing is taken away.</p> : <ul>{lost.map((row) => <li key={row.action}><span>{row.action}</span><small>{row.area} · {levelLabels[row.to]}</small></li>)}</ul>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
