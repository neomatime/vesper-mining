"use client";

import type { Member } from "@vesper/api-contracts";
import { Check, Minus, Pencil, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { entitlementRows, entitlementsFor } from "@/lib/entitlements";
import { canManageOrganisation, memberStatusLabels, roleInfo } from "@/lib/organisation-rules";
import { initials, tierLabel } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
import { CompanyDialog, MemberDialog, SiteDialog } from "./admin-dialogs";
import { ConfirmDialog } from "./dialog";
import { PageHeader } from "./page-header";
import { LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { useOrganisation, useOrganisationMutations } from "./use-organisation";

const integrations = [
  { name: "Maintenance system", detail: "Work-order references are entered by hand." },
  { name: "Stores and inventory", detail: "Stock figures are entered by hand." },
  { name: "Equipment telemetry and GPS", detail: "Positions on the map are indicative." },
  { name: "Single sign-on", detail: "People sign in with a work email address and password." },
  { name: "Procurement and payments", detail: "Nothing can be ordered, approved or paid from VESPER." },
];

const tabs = [
  { key: "people", label: "People" },
  { key: "site", label: "Site" },
  { key: "company", label: "Company" },
  { key: "plan", label: "Plan and usage" },
  { key: "connections", label: "Connections" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const statusTone = { active: "complete", invited: "pending", deactivated: "unknown" } as const;
const statusOrder = { active: 0, invited: 1, deactivated: 2 } as const;

type Pending =
  | { kind: "off"; member: Member }
  | { kind: "withdraw"; member: Member }
  | null;

export function AdminScreen() {
  const { context } = useDemoContext();
  const { data, isPending } = useOrganisation();
  const actions = useOrganisationMutations();
  const [tab, setTab] = useState<TabKey>("people");
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [editingSite, setEditingSite] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [confirm, setConfirm] = useState<Pending>(null);

  const plan = entitlementsFor(context.tier);
  const canManage = canManageOrganisation({ name: context.persona, role: context.role }).allowed;

  if (isPending || !data) {
    return (
      <div className="workspace-page">
        <PageHeader eyebrow="Administration" title="Organisation" description="Your people, site and plan." icon={Settings2} />
        <LoadingState />
      </div>
    );
  }

  const { members, company, site, activity } = data;
  const people = [...members].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name));
  const active = members.filter((member) => member.status === "active").length;
  const invited = members.filter((member) => member.status === "invited").length;
  const fieldUsers = members.filter((member) => member.status !== "deactivated" && roleInfo(member.role)?.fieldOnly).length;

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Administration"
        title="Organisation"
        description="Your people, site and plan."
        icon={Settings2}
        action={tab === "people" && canManage ? <button className="button button--primary" onClick={() => setInviting(true)}><Plus /> Invite person</button> : undefined}
      />

      <section className="kpi-row" aria-label="Summary">
        <article className="kpi"><span>Plan</span><strong>{plan.label}</strong><small>{plan.reporting} reporting</small></article>
        <article className="kpi"><span>Site</span><strong>{site.name}</strong><small>{plan.sites} on your plan</small></article>
        <article className="kpi"><span>People</span><strong>{active}</strong><small>{invited ? `${invited} invited` : "With access to VESPER"}</small></article>
      </section>

      {!canManage ? <p className="notice-line">Only the Mine Manager can change people, site and company details. You can see them here.</p> : null}

      <div className="tabs" role="tablist" aria-label="Administration sections">
        {tabs.map((item) => (
          <button key={item.key} role="tab" id={`tab-${item.key}`} aria-selected={tab === item.key} aria-controls={`panel-${item.key}`} tabIndex={tab === item.key ? 0 : -1} className={tab === item.key ? "tab tab--active" : "tab"} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "people" ? (
        <div role="tabpanel" id="panel-people" aria-labelledby="tab-people" className="admin-panel">
          <section className="card detail-card" aria-labelledby="people-heading">
            <header className="card__header"><div><span className="eyebrow">Access</span><h2 id="people-heading">People and roles</h2></div></header>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Experience</th><th scope="col">Access</th><th scope="col">Last signed in</th>{canManage ? <th scope="col"><span className="visually-hidden">Actions</span></th> : null}</tr>
                </thead>
                <tbody>
                  {people.map((member) => {
                    const self = member.name === context.persona;
                    return (
                      <tr key={member.id} className={member.status === "deactivated" ? "row--muted" : ""}>
                        <td><span className="person"><span className="avatar avatar--small">{initials(member.name)}</span><span className="cell-main"><strong>{member.name}{self ? " (you)" : ""}</strong><small>{member.email}</small></span></span></td>
                        <td>{member.role}</td>
                        <td>{roleInfo(member.role)?.fieldOnly ? "VESPER Mobile" : "Web and tablet"}</td>
                        <td><StatusBadge value={statusTone[member.status]} label={memberStatusLabels[member.status]} /></td>
                        <td>{member.lastSignInAt ? formatDemoDateTime(member.lastSignInAt) : <span className="muted">Not yet</span>}</td>
                        {canManage ? (
                          <td className="row-actions">
                            <button className="button button--quiet button--small" aria-label={`Edit ${member.name}`} onClick={() => setEditing(member)}><Pencil /> Edit</button>
                            {member.status === "invited" ? (
                              <>
                                <button className="button button--quiet button--small" aria-label={`Send the invitation to ${member.name} again`} disabled={actions.resend.isPending} onClick={() => actions.resend.mutate(member.id)}>Resend</button>
                                <button className="button button--quiet button--small" aria-label={`Withdraw the invitation for ${member.name}`} onClick={() => setConfirm({ kind: "withdraw", member })}>Withdraw</button>
                              </>
                            ) : null}
                            {member.status === "active" && !self ? <button className="button button--quiet button--small" aria-label={`Turn off access for ${member.name}`} onClick={() => setConfirm({ kind: "off", member })}>Turn off</button> : null}
                            {member.status === "deactivated" ? <button className="button button--quiet button--small" aria-label={`Restore access for ${member.name}`} disabled={actions.setAccess.isPending} onClick={() => actions.setAccess.mutate({ id: member.id, access: "on" })}>Restore</button> : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card detail-card" aria-labelledby="activity-heading">
            <header className="card__header"><div><span className="eyebrow">Record</span><h2 id="activity-heading">Recent changes</h2></div></header>
            {activity.length === 0 ? (
              <p className="empty-line">Changes to people, site and company details will be listed here.</p>
            ) : (
              <ul className="work-list">
                {activity.slice(0, 8).map((event) => (
                  <li className="work-row" key={event.id}>
                    <div className="work-row__copy"><strong>{event.summary}</strong><small>{event.actor} · {formatDemoDateTime(event.at)}</small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "site" ? (
        <div role="tabpanel" id="panel-site" aria-labelledby="tab-site" className="admin-panel">
          <section className="card detail-card" aria-labelledby="site-heading">
            <header className="card__header">
              <div><span className="eyebrow">Site</span><h2 id="site-heading">{site.name}</h2></div>
              {canManage ? <button className="button button--quiet" onClick={() => setEditingSite(true)}><Pencil /> Edit site</button> : null}
            </header>
            <dl className="definition-grid">
              <div><dt>Mine type</dt><dd>{site.type || "—"}</dd></div>
              <div><dt>Commodity</dt><dd>{site.commodity || "—"}</dd></div>
              <div><dt>Location</dt><dd>{site.location || "—"}</dd></div>
              <div><dt>Time zone</dt><dd>{site.timezone || "—"}</dd></div>
              <div><dt>Operating hours</dt><dd>{site.operatingHours || "—"}</dd></div>
              <div><dt>Site contact</dt><dd>{site.siteContact || "—"}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}

      {tab === "company" ? (
        <div role="tabpanel" id="panel-company" aria-labelledby="tab-company" className="admin-panel">
          <section className="card detail-card" aria-labelledby="company-heading">
            <header className="card__header">
              <div><span className="eyebrow">Company</span><h2 id="company-heading">{company.name}</h2></div>
              {canManage ? <button className="button button--quiet" onClick={() => setEditingCompany(true)}><Pencil /> Edit company</button> : null}
            </header>
            <dl className="definition-grid">
              <div><dt>Industry</dt><dd>{company.industry || "—"}</dd></div>
              <div><dt>Registration number</dt><dd>{company.registration || "—"}</dd></div>
              <div><dt>Address</dt><dd>{company.address || "—"}</dd></div>
              <div><dt>Primary contact</dt><dd>{company.contactName || "—"}</dd></div>
              <div><dt>Contact email</dt><dd>{company.contactEmail || "—"}</dd></div>
              <div><dt>Contact phone</dt><dd>{company.contactPhone || "—"}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}

      {tab === "plan" ? (
        <div role="tabpanel" id="panel-plan" aria-labelledby="tab-plan" className="admin-panel">
          <div className="two-up">
            <section className="card detail-card" aria-labelledby="plan-heading">
              <header className="card__header"><div><span className="eyebrow">Your plan</span><h2 id="plan-heading">{tierLabel(context.tier)}</h2></div></header>
              <ul className="plan-list">
                {entitlementRows.map((row) => {
                  const value = row.read(context.tier);
                  const off = value === "Not included";
                  return (
                    <li key={row.label} className={off ? "plan__off" : ""}>
                      {off ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}
                      <span>{row.label}</span>
                      <strong>{value}</strong>
                    </li>
                  );
                })}
              </ul>
              <p className="card-note">To change your plan, speak to your HIMARK account manager.</p>
            </section>

            <section className="card detail-card" aria-labelledby="usage-heading">
              <header className="card__header"><div><span className="eyebrow">Usage</span><h2 id="usage-heading">What you are using</h2></div></header>
              <ul className="plan-list">
                <li><Check aria-hidden="true" /><span>Sites</span><strong>1 in use · {plan.sites} included</strong></li>
                <li><Check aria-hidden="true" /><span>People with access</span><strong>{active}{invited ? ` · ${invited} invited` : ""}</strong></li>
                <li className={plan.mobile ? "" : "plan__off"}>{plan.mobile ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}<span>VESPER Mobile users</span><strong>{plan.mobile ? fieldUsers : "Not included"}</strong></li>
              </ul>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "connections" ? (
        <div role="tabpanel" id="panel-connections" aria-labelledby="tab-connections" className="admin-panel">
          <section className="card detail-card" aria-labelledby="integration-heading">
            <header className="card__header"><div><span className="eyebrow">Connections</span><h2 id="integration-heading">Integrations</h2></div></header>
            <ul className="work-list">
              {integrations.map((item) => (
                <li className="work-row" key={item.name}>
                  <div className="work-row__copy"><strong>{item.name}</strong><small>{item.detail}</small></div>
                  <StatusBadge value="unknown" label="Not connected" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {inviting ? (
        <MemberDialog
          pending={actions.invite.isPending}
          onClose={() => setInviting(false)}
          onSave={(input) => actions.invite.mutate(input as { name: string; email: string; role: string }, { onSuccess: () => setInviting(false) })}
        />
      ) : null}
      {editing ? (
        <MemberDialog
          member={editing}
          pending={actions.updateMember.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => actions.updateMember.mutate({ id: editing.id, version: editing.version, ...input }, { onSuccess: () => setEditing(null) })}
        />
      ) : null}
      {editingSite ? (
        <SiteDialog
          site={site}
          pending={actions.saveSite.isPending}
          onClose={() => setEditingSite(false)}
          onSave={(input) => actions.saveSite.mutate({ ...input, version: site.version }, { onSuccess: () => setEditingSite(false) })}
        />
      ) : null}
      {editingCompany ? (
        <CompanyDialog
          company={company}
          pending={actions.saveCompany.isPending}
          onClose={() => setEditingCompany(false)}
          onSave={(input) => actions.saveCompany.mutate({ ...input, version: company.version }, { onSuccess: () => setEditingCompany(false) })}
        />
      ) : null}
      {confirm?.kind === "off" ? (
        <ConfirmDialog
          title={`Turn off access for ${confirm.member.name}?`}
          body="They will no longer be able to sign in. Their name stays on the shifts, issues and equipment records they are part of, and you can restore access at any time."
          confirmLabel="Turn off access"
          tone="danger"
          pending={actions.setAccess.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => actions.setAccess.mutate({ id: confirm.member.id, access: "off" }, { onSettled: () => setConfirm(null) })}
        />
      ) : null}
      {confirm?.kind === "withdraw" ? (
        <ConfirmDialog
          title={`Withdraw the invitation for ${confirm.member.name}?`}
          body="The invitation is removed and they will not be able to sign in. You can invite them again later."
          confirmLabel="Withdraw invitation"
          tone="danger"
          pending={actions.withdraw.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => actions.withdraw.mutate(confirm.member.id, { onSettled: () => setConfirm(null) })}
        />
      ) : null}
    </div>
  );
}
