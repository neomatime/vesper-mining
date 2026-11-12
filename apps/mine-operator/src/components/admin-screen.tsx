"use client";

import { Check, Lock, Minus, Pencil, Plus, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { entitlementRows, entitlementsFor } from "@/lib/entitlements";
import { canManageOrganisation, memberStatusLabels, roleInfo, roleNames } from "@/lib/organisation-rules";
import { initials, tierLabel } from "@/lib/personas";
import { levelLabels, rightsAreas, rightsMatrix } from "@/lib/rights";
import { useDemoContext } from "@/stores/demo-context";
import { CompanyDialog, MemberDialog, SiteDialog, TemporaryPasswordDialog } from "./admin-dialogs";
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
  { key: "people", label: "Employees" },
  { key: "rights", label: "User rights" },
  { key: "site", label: "Site" },
  { key: "company", label: "Company" },
  { key: "plan", label: "Plan and usage" },
  { key: "connections", label: "Connections" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const statusTone = { active: "complete", invited: "pending", deactivated: "unknown" } as const;
const statusOrder = { active: 0, invited: 1, deactivated: 2 } as const;
const filters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "invited", label: "Awaiting first sign-in" },
  { key: "deactivated", label: "Deactivated" },
] as const;

export function AdminScreen() {
  const { context } = useDemoContext();
  const { data, isPending } = useOrganisation();
  const actions = useOrganisationMutations();
  const [tab, setTab] = useState<TabKey>("people");
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const [editingSite, setEditingSite] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const plan = entitlementsFor(context.tier);
  const canManage = canManageOrganisation({ name: context.persona, role: context.role }).allowed;

  if (!canManage) {
    return (
      <div className="workspace-page">
        <PageHeader eyebrow="Administration" title="Organisation" description="Employees, user rights, site and plan." icon={Settings2} />
        <section className="card detail-card restricted">
          <Lock aria-hidden="true" />
          <h2>Administration is for the Mine Manager</h2>
          <p>Employees, user rights, site and company details are managed by the Mine Manager. Ask them if something needs to change.</p>
        </section>
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div className="workspace-page">
        <PageHeader eyebrow="Administration" title="Organisation" description="Employees, user rights, site and plan." icon={Settings2} />
        <LoadingState />
      </div>
    );
  }

  const { members, company, site } = data;
  const active = members.filter((member) => member.status === "active").length;
  const waiting = members.filter((member) => member.status === "invited").length;
  const fieldUsers = members.filter((member) => member.status !== "deactivated" && roleInfo(member.role)?.fieldOnly).length;
  const needle = query.trim().toLowerCase();
  const people = [...members]
    .filter((member) => filter === "all" || member.status === filter)
    .filter((member) => !needle || [member.name, member.email, member.role, member.employeeNumber].join(" ").toLowerCase().includes(needle))
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name));

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Administration"
        title="Organisation"
        description="Employees, user rights, site and plan."
        icon={Settings2}
        action={tab === "people" ? <button className="button button--primary" onClick={() => setAdding(true)}><Plus /> Add employee</button> : undefined}
      />

      <section className="kpi-row" aria-label="Summary">
        <article className="kpi"><span>Plan</span><strong>{plan.label}</strong><small>{plan.reporting} reporting</small></article>
        <article className="kpi"><span>Site</span><strong>{site.name}</strong><small>{plan.sites} on your plan</small></article>
        <article className="kpi"><span>Employees</span><strong>{active}</strong><small>{waiting ? `${waiting} awaiting first sign-in` : "With access to VESPER"}</small></article>
      </section>

      <div className="tabs" role="tablist" aria-label="Administration sections">
        {tabs.map((item) => (
          <button key={item.key} role="tab" id={`tab-${item.key}`} aria-selected={tab === item.key} aria-controls={`panel-${item.key}`} tabIndex={tab === item.key ? 0 : -1} className={tab === item.key ? "tab tab--active" : "tab"} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "people" ? (
        <div role="tabpanel" id="panel-people" aria-labelledby="tab-people" className="admin-panel">
          <section className="card register-card" aria-labelledby="people-heading">
            <header className="card__header"><div><span className="eyebrow">Access</span><h2 id="people-heading">Employees</h2></div></header>
            <div className="register-toolbar">
              <label className="register-search">
                <Search aria-hidden="true" />
                <input type="search" placeholder="Search by name, email, role or number" aria-label="Search employees" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <div className="filter-chips" role="group" aria-label="Filter employees">
                {filters.map((item) => (
                  <button key={item.key} className={filter === item.key ? "active" : ""} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table data-table--register">
                <thead>
                  <tr><th scope="col">Employee</th><th scope="col">Role</th><th scope="col">Employee no.</th><th scope="col">Status</th><th scope="col">Last signed in</th></tr>
                </thead>
                <tbody>
                  {people.length === 0 ? (
                    <tr><td colSpan={5}><p className="empty-line">No employees match.</p></td></tr>
                  ) : people.map((member) => (
                    <tr key={member.id} className={member.status === "deactivated" ? "row--muted" : ""}>
                      <td>
                        <Link className="person person--link" href={`/admin/people/${member.id}`}>
                          <span className="avatar avatar--small">{initials(member.name)}</span>
                          <span className="cell-main"><strong>{member.name}{member.name === context.persona ? " (you)" : ""}</strong><small>{member.email}</small></span>
                        </Link>
                      </td>
                      <td>{member.role}</td>
                      <td>{member.employeeNumber || <span className="muted">—</span>}</td>
                      <td><StatusBadge value={statusTone[member.status]} label={member.status === "invited" ? "Awaiting first sign-in" : memberStatusLabels[member.status]} /></td>
                      <td>{member.lastSignInAt ? formatDemoDateTime(member.lastSignInAt) : <span className="muted">Not yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "rights" ? (
        <div role="tabpanel" id="panel-rights" aria-labelledby="tab-rights" className="admin-panel">
          <section className="card detail-card" aria-labelledby="rights-heading">
            <header className="card__header"><div><span className="eyebrow">Access control</span><h2 id="rights-heading">What each role can do</h2></div></header>
            <p className="card-note card-note--top">Rights follow the role. To change what someone can do, change their role on their profile.</p>
            <div className="table-wrap">
              <table className="data-table rights-table">
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    {roleNames.map((role) => <th scope="col" key={role} className="rights-table__role">{role}</th>)}
                  </tr>
                </thead>
                {rightsAreas.map((area) => (
                  <tbody key={area}>
                    <tr className="rights-table__area"><th colSpan={roleNames.length + 1} scope="colgroup">{area}</th></tr>
                    {rightsMatrix.filter((row) => row.area === area).map((row) => (
                      <tr key={row.action}>
                        <th scope="row" className="rights-table__action">{row.action}</th>
                        {roleNames.map((role) => {
                          const level = row.levels[role];
                          return (
                            <td key={role} className="rights-table__cell">
                              <span className={`right right--${level}`} role="img" aria-label={`${row.action}, ${role}: ${levelLabels[level]}`}>
                                {level === "yes" ? <Check aria-hidden="true" /> : level === "own" ? <span aria-hidden="true">Own</span> : <Minus aria-hidden="true" />}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "site" ? (
        <div role="tabpanel" id="panel-site" aria-labelledby="tab-site" className="admin-panel">
          <section className="card detail-card" aria-labelledby="site-heading">
            <header className="card__header">
              <div><span className="eyebrow">Site</span><h2 id="site-heading">{site.name}</h2></div>
              <button className="button button--quiet" onClick={() => setEditingSite(true)}><Pencil /> Edit site</button>
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
              <button className="button button--quiet" onClick={() => setEditingCompany(true)}><Pencil /> Edit company</button>
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
                <li><Check aria-hidden="true" /><span>Employees with access</span><strong>{active}{waiting ? ` · ${waiting} awaiting first sign-in` : ""}</strong></li>
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

      {adding ? (
        <MemberDialog
          pending={actions.addMember.isPending}
          onClose={() => setAdding(false)}
          onSave={(input) =>
            actions.addMember.mutate(input as { name: string; email: string; role: string; phone: string; employeeNumber: string }, {
              onSuccess: ({ member, temporaryPassword }) => {
                setAdding(false);
                setCreated({ name: member.name, email: member.email, password: temporaryPassword });
              },
            })
          }
        />
      ) : null}
      {created ? <TemporaryPasswordDialog reason="added" name={created.name} email={created.email} password={created.password} onClose={() => setCreated(null)} /> : null}
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
    </div>
  );
}
