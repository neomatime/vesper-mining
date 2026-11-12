"use client";

import { ArrowLeft, Check, KeyRound, Lock, Minus, Pencil, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { canManageOrganisation, memberStatusLabels, roleInfo } from "@/lib/organisation-rules";
import { initials } from "@/lib/personas";
import { levelLabels, rightsForRole } from "@/lib/rights";
import { useDemoContext } from "@/stores/demo-context";
import { ChangeRoleDialog, MemberDialog, TemporaryPasswordDialog } from "./admin-dialogs";
import { ConfirmDialog } from "./dialog";
import { MoreMenu } from "./more-menu";
import { LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { useOrganisation, useOrganisationMutations } from "./use-organisation";

const statusTone = { active: "complete", invited: "pending", deactivated: "unknown" } as const;

type Pending = "off" | "delete" | null;

export function EmployeeProfileScreen({ id }: { id: string }) {
  const router = useRouter();
  const { context } = useDemoContext();
  const { data, isPending } = useOrganisation();
  const actions = useOrganisationMutations();
  const [editing, setEditing] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [reset, setReset] = useState<{ password: string } | null>(null);

  const canManage = canManageOrganisation({ name: context.persona, role: context.role }).allowed;

  if (!canManage) {
    return (
      <div className="workspace-page">
        <section className="card detail-card restricted">
          <Lock aria-hidden="true" />
          <h2>Administration is for the Mine Manager</h2>
          <p>Employee profiles are managed by the Mine Manager.</p>
        </section>
      </div>
    );
  }
  if (isPending || !data) return <div className="workspace-page"><LoadingState /></div>;

  const member = data.members.find((item) => item.id === id);
  if (!member) {
    return (
      <div className="workspace-page">
        <Link className="back-link" href="/admin"><ArrowLeft /> Administration</Link>
        <section className="card detail-card restricted">
          <h2>This employee could not be found</h2>
          <p>They may have been deleted.</p>
        </section>
      </div>
    );
  }

  const self = member.name === context.persona;
  const history = data.activity.filter((event) => event.summary.includes(member.name));
  const rights = rightsForRole(member.role);
  const experience = roleInfo(member.role)?.fieldOnly ? "VESPER Mobile" : "Web and tablet";
  const statusLabel = member.status === "invited" ? "Awaiting first sign-in" : memberStatusLabels[member.status];

  return (
    <div className="workspace-page">
      <Link className="back-link" href="/admin"><ArrowLeft /> Administration</Link>

      <header className="profile-header">
        <span className="avatar avatar--large">{initials(member.name)}</span>
        <div className="profile-header__copy">
          <span className="eyebrow">Employee</span>
          <h1>{member.name}{self ? " (you)" : ""}</h1>
          <p>{member.role} · {member.email}</p>
        </div>
        <div className="profile-header__actions">
          <StatusBadge value={statusTone[member.status]} label={statusLabel} />
          <button className="button button--primary" onClick={() => setEditing(true)}><Pencil /> Edit details</button>
          {!self && member.status !== "deactivated" ? (
            <button className="button button--quiet" disabled={actions.resetPassword.isPending} onClick={() => actions.resetPassword.mutate(member.id, { onSuccess: ({ temporaryPassword }) => setReset({ password: temporaryPassword }) })}><KeyRound /> Reset password</button>
          ) : null}
          {!self ? (
            <MoreMenu>
              {(close) => (
                <>
                  {member.status === "deactivated" ? (
                    <button className="menu-item" onClick={() => { close(); actions.setAccess.mutate({ id: member.id, access: "on" }); }}>
                      <span className="menu-item__copy"><strong>Restore access</strong><small>Let them sign in again</small></span>
                    </button>
                  ) : (
                    <button className="menu-item" onClick={() => { close(); setConfirm("off"); }}>
                      <span className="menu-item__copy"><strong>Turn off access</strong><small>Keeps their records</small></span>
                    </button>
                  )}
                  <button className="menu-item" onClick={() => { close(); setConfirm("delete"); }}>
                    <span className="menu-item__copy"><strong>Delete employee</strong><small>Only when nothing refers to them</small></span>
                  </button>
                </>
              )}
            </MoreMenu>
          ) : null}
        </div>
      </header>

      <div className="detail-layout">
        <div className="detail-layout__main">
          <section className="card detail-card" aria-labelledby="profile-heading">
            <header className="card__header"><div><span className="eyebrow">Profile</span><h2 id="profile-heading">Details</h2></div></header>
            <dl className="definition-grid">
              <div><dt>Full name</dt><dd>{member.name}</dd></div>
              <div><dt>Role</dt><dd>{member.role}</dd></div>
              <div><dt>Work email</dt><dd>{member.email}</dd></div>
              <div><dt>Phone</dt><dd>{member.phone || "—"}</dd></div>
              <div><dt>Employee number</dt><dd>{member.employeeNumber || "—"}</dd></div>
              <div><dt>Experience</dt><dd>{experience}</dd></div>
              <div><dt>Added</dt><dd>{member.invitedAt ? formatDemoDateTime(member.invitedAt) : "—"}</dd></div>
              <div><dt>Last signed in</dt><dd>{member.lastSignInAt ? formatDemoDateTime(member.lastSignInAt) : "Not yet"}</dd></div>
              <div><dt>Password</dt><dd>{member.mustChangePassword ? "Temporary. They choose their own at next sign-in." : "Chosen by the employee"}</dd></div>
            </dl>
          </section>

          <section className="card detail-card" aria-labelledby="rights-heading">
            <header className="card__header">
              <div><span className="eyebrow">Access control</span><h2 id="rights-heading">Rights from the {member.role} role</h2></div>
              {!self ? <button className="button button--primary" onClick={() => setChangingRole(true)}><ShieldCheck /> Change role</button> : null}
            </header>
            <p className="card-note card-note--top">{self ? "You cannot change your own role. Ask another Mine Manager." : "Rights follow the role. Change the role to change what this person can do. You will see exactly what they gain and lose first."}</p>
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
          <section className="card detail-card" aria-labelledby="history-heading">
            <header className="card__header"><div><span className="eyebrow">Record</span><h2 id="history-heading">Account history</h2></div></header>
            {history.length === 0 ? (
              <p className="empty-line">Changes to this account will be listed here.</p>
            ) : (
              <ul className="work-list">
                {history.map((event) => (
                  <li className="work-row" key={event.id}>
                    <div className="work-row__copy"><strong>{event.summary}</strong><small>{event.actor} · {formatDemoDateTime(event.at)}</small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {changingRole ? (
        <ChangeRoleDialog
          member={member}
          pending={actions.updateMember.isPending}
          onClose={() => setChangingRole(false)}
          onSave={(role) => actions.updateMember.mutate({ id: member.id, version: member.version, role }, { onSuccess: () => setChangingRole(false) })}
        />
      ) : null}
      {editing ? (
        <MemberDialog
          member={member}
          pending={actions.updateMember.isPending}
          onClose={() => setEditing(false)}
          onSave={(input) => actions.updateMember.mutate({ id: member.id, version: member.version, ...input }, { onSuccess: () => setEditing(false) })}
        />
      ) : null}
      {reset ? <TemporaryPasswordDialog reason="reset" name={member.name} email={member.email} password={reset.password} onClose={() => setReset(null)} /> : null}
      {confirm === "off" ? (
        <ConfirmDialog
          title={`Turn off access for ${member.name}?`}
          body="They will no longer be able to sign in. Their name stays on the shifts, issues and equipment records they are part of, and you can restore access at any time."
          confirmLabel="Turn off access"
          tone="danger"
          pending={actions.setAccess.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => actions.setAccess.mutate({ id: member.id, access: "off" }, { onSettled: () => setConfirm(null) })}
        />
      ) : null}
      {confirm === "delete" ? (
        <ConfirmDialog
          title={`Delete ${member.name}?`}
          body="This removes the employee and their sign-in permanently. It is only possible when nothing in VESPER refers to them. If it is not possible, turn off their access instead."
          confirmLabel="Delete employee"
          tone="danger"
          pending={actions.deleteMember.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => actions.deleteMember.mutate(member.id, { onSuccess: () => router.replace("/admin"), onSettled: () => setConfirm(null) })}
        />
      ) : null}
    </div>
  );
}
