"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, KeyRound, Minus, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { passwordProblem, roleInfo } from "@/lib/organisation-rules";
import { initials } from "@/lib/personas";
import { levelLabels, rightsForRole } from "@/lib/rights";
import { useDemoContext } from "@/stores/demo-context";
import { useAccount } from "@/stores/session";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { useOrganisation, useOrganisationMutations } from "./use-organisation";

const passwordSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), next: z.string(), confirm: z.string() })
  .superRefine((values, ctx) => {
    const problem = passwordProblem(values.next, values.current);
    if (problem) ctx.addIssue({ code: "custom", path: ["next"], message: problem });
    if (values.next !== values.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two passwords do not match." });
  });

/** Every signed-in person's own profile: their details, what their role allows, and their password. */
export function MyProfileScreen() {
  const { context } = useDemoContext();
  const account = useAccount();
  const { data, isPending } = useOrganisation();
  const actions = useOrganisationMutations();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { current: "", next: "", confirm: "" } });
  const { errors } = form.formState;

  if (isPending || !data) return <div className="workspace-page"><LoadingState /></div>;
  const member = data.members.find((item) => item.name === context.persona);
  if (!member) return <div className="workspace-page"><section className="card detail-card restricted"><h2>Your profile could not be found</h2></section></div>;

  const rights = rightsForRole(member.role);
  const experience = roleInfo(member.role)?.fieldOnly ? "VESPER Mobile" : "Web and tablet";

  return (
    <div className="workspace-page">
      <header className="profile-header">
        <span className="avatar avatar--large">{initials(member.name)}</span>
        <div className="profile-header__copy">
          <span className="eyebrow">My profile</span>
          <h1>{member.name}</h1>
          <p>{member.role} · {context.siteName}</p>
        </div>
        <div className="profile-header__actions"><StatusBadge value="complete" label="Active" /></div>
      </header>

      <div className="detail-layout">
        <div className="detail-layout__main">
          <section className="card detail-card" aria-labelledby="mine-heading">
            <header className="card__header">
              <div><span className="eyebrow">Profile</span><h2 id="mine-heading">My details</h2></div>
              <button className="button button--quiet" onClick={() => { setPhone(member.phone); setEditingPhone(true); }}><Pencil /> Edit phone</button>
            </header>
            <dl className="definition-grid">
              <div><dt>Full name</dt><dd>{member.name}</dd></div>
              <div><dt>Role</dt><dd>{member.role}</dd></div>
              <div><dt>Work email</dt><dd>{member.email}</dd></div>
              <div><dt>Phone</dt><dd>{member.phone || "—"}</dd></div>
              <div><dt>Employee number</dt><dd>{member.employeeNumber || "—"}</dd></div>
              <div><dt>Experience</dt><dd>{experience}</dd></div>
              <div><dt>Last signed in</dt><dd>{member.lastSignInAt ? formatDemoDateTime(member.lastSignInAt) : "This is your first sign-in"}</dd></div>
            </dl>
            <p className="card-note">Your name, email and role are managed by your Mine Manager.</p>
          </section>

          <section className="card detail-card" aria-labelledby="my-rights-heading">
            <header className="card__header"><div><span className="eyebrow">Access control</span><h2 id="my-rights-heading">What my role allows</h2></div></header>
            <p className="card-note card-note--top">These rights come from your {member.role} role. Ask your Mine Manager if you need a different role.</p>
            <div className="profile-rights">
              {rights.map((group) => (
                <div key={group.area} className="profile-rights__group">
                  <h3>{group.area}</h3>
                  <ul>
                    {group.rows.map((row) => (
                      <li key={row.action} className={`profile-rights__row profile-rights__row--${row.level}`}>
                        {row.level === "no" ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}
                        <span>{row.action}</span>
                        <small>{levelLabels[row.level]}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="detail-layout__aside">
          <section className="card detail-card" aria-labelledby="password-heading">
            <header className="card__header"><div><span className="eyebrow">Security</span><h2 id="password-heading">Change password</h2></div></header>
            <form
              className="form-grid form-grid--card"
              noValidate
              onSubmit={form.handleSubmit((values) =>
                actions.changeOwnPassword.mutate({ email: account?.email ?? member.email, current: values.current, next: values.next }, { onSuccess: () => form.reset() }),
              )}
            >
              <Field label="Current password" error={errors.current?.message} wide><input type="password" autoComplete="current-password" aria-invalid={Boolean(errors.current)} {...form.register("current")} /></Field>
              <Field label="New password" error={errors.next?.message} hint="At least 10 characters, with upper and lower case letters and a number." wide><input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.next)} {...form.register("next")} /></Field>
              <Field label="Confirm new password" error={errors.confirm?.message} wide><input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} {...form.register("confirm")} /></Field>
              <div className="form-field--wide"><button className="button button--primary" disabled={actions.changeOwnPassword.isPending}><KeyRound /> {actions.changeOwnPassword.isPending ? "Saving…" : "Change password"}</button></div>
            </form>
          </section>
        </aside>
      </div>

      {editingPhone ? (
        <Dialog
          title="Edit your phone number"
          size="narrow"
          onClose={() => setEditingPhone(false)}
          locked={actions.updateOwn.isPending}
          footer={
            <>
              <button className="button button--quiet" type="button" onClick={() => setEditingPhone(false)}>Cancel</button>
              <button className="button button--primary" form="phone-form" disabled={actions.updateOwn.isPending}>Save</button>
            </>
          }
        >
          <form id="phone-form" className="form-grid" onSubmit={(event) => { event.preventDefault(); actions.updateOwn.mutate({ phone }, { onSuccess: () => setEditingPhone(false) }); }}>
            <Field label="Phone number" wide><input data-autofocus type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
