"use client";

import { Check, Minus, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { entitlementRows, entitlementsFor } from "@/lib/entitlements";
import { initials, personas, tierLabel, tiers } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { useToast } from "./toast-provider";

const integrations = [
  { name: "Maintenance system (CMMS)", detail: "Work-order references are simulated and read-only." },
  { name: "Stores and inventory", detail: "Stock figures are entered by hand in this demonstration." },
  { name: "Equipment telemetry and GPS", detail: "Positions on the map are illustrative, not live." },
  { name: "Identity and single sign-on", detail: "Personas are fictional. No customer sign-in exists." },
  { name: "Procurement and payments", detail: "Nothing can be ordered, approved or paid from VESPER." },
];

export function AdminScreen() {
  const router = useRouter();
  const toast = useToast();
  const { context, setContext } = useDemoContext();
  const plan = entitlementsFor(context.tier);
  const canChangePlan = context.role === "Mine Manager";

  const changeTier = (tier: (typeof tiers)[number]) => {
    if (tier.value === context.tier) return;
    const before = entitlementsFor(context.tier);
    const after = entitlementsFor(tier.value);
    const changes: string[] = [];
    if (before.mobile !== after.mobile) changes.push(after.mobile ? "VESPER Mobile is now available" : "VESPER Mobile is no longer included");
    if (before.advancedAnalytics !== after.advancedAnalytics) changes.push(after.advancedAnalytics ? "advanced analytics are now available" : "advanced analytics are no longer included");
    setContext({ tier: tier.value });
    toast.push({
      title: `Subscription set to ${tier.label}`,
      detail: changes.length ? `${changes.join(", ")}.` : "Features stay the same. Demonstration only.",
    });
  };

  const viewAs = (name: string, role: string, fieldOnly: boolean) => {
    setContext({ persona: name, role });
    router.push(fieldOnly ? "/mobile/my-shift" : "/overview");
  };

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Administration" title="Demonstration configuration" description="Review the fictional users, site access and subscription. Changing the subscription shows how features appear and disappear." icon={Settings2} />

      <section className="kpi-row" aria-label="Configuration summary">
        <article className="kpi"><span>Subscription</span><strong>{plan.label}</strong><small>{plan.reporting} reporting</small></article>
        <article className="kpi"><span>Sites</span><strong>1 of {plan.sites.replace(/^Up to /, "").replace(" sites", "").replace(" site", "")}</strong><small>Riverside Mine is provisioned</small></article>
        <article className="kpi"><span>Demonstration users</span><strong>{personas.length}</strong><small>All fictional</small></article>
        <article className="kpi"><span>Live integrations</span><strong>0</strong><small>None are connected</small></article>
      </section>

      <section className="card detail-card" aria-labelledby="plan-heading">
        <header className="card__header">
          <div><span className="eyebrow">Feature access</span><h2 id="plan-heading">Subscription</h2></div>
          <span>{canChangePlan ? "Select a plan to try it" : `Viewing as ${context.role}. The Mine Manager changes the plan.`}</span>
        </header>
        <div className="plan-grid" role="radiogroup" aria-label="Demonstration subscription">
          {tiers.map((tier) => {
            const selected = tier.value === context.tier;
            return (
              <button
                key={tier.value}
                role="radio"
                aria-checked={selected}
                disabled={!canChangePlan && !selected}
                className={`plan ${selected ? "plan--selected" : ""}`}
                onClick={() => changeTier(tier)}
              >
                <span className="plan__head"><strong>{tier.label}</strong>{selected ? <span className="plan__current"><Check /> Current</span> : null}</span>
                <ul>
                  {entitlementRows.map((row) => {
                    const value = row.read(tier.value);
                    const off = value === "Not included";
                    return <li key={row.label} className={off ? "plan__off" : ""}>{off ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}<span>{row.label}: {value}</span></li>;
                  })}
                </ul>
              </button>
            );
          })}
        </div>
        <p className="card__footnote">These are demonstration entitlements for user-experience validation. They are not production billing or access control.</p>
      </section>

      <section className="card detail-card" aria-labelledby="users-heading">
        <header className="card__header"><div><span className="eyebrow">Fictional personas</span><h2 id="users-heading">Users and roles</h2></div></header>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Focus</th><th scope="col">Experience</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {personas.map((persona) => {
                const current = persona.name === context.persona;
                return (
                  <tr key={persona.name}>
                    <td><span className="person"><span className="avatar avatar--small">{initials(persona.name)}</span><strong>{persona.name}</strong></span></td>
                    <td>{persona.role}</td>
                    <td>{persona.scope}</td>
                    <td>{persona.fieldOnly ? "VESPER Mobile" : "Web and tablet"}</td>
                    <td>{current ? <StatusBadge value="verified" label="Viewing now" /> : <button className="button button--quiet button--small" onClick={() => viewAs(persona.name, persona.role, persona.fieldOnly)}>View as {persona.name.split(" ")[0]}</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-up">
        <section className="card detail-card" aria-labelledby="site-heading">
          <header className="card__header"><div><span className="eyebrow">Site access</span><h2 id="site-heading">Sites</h2></div></header>
          <dl className="definition-grid definition-grid--single">
            <div><dt>Provisioned</dt><dd>{context.siteName} · open pit · fictional</dd></div>
            <div><dt>Allowance</dt><dd>{plan.sites} on {tierLabel(context.tier)}</dd></div>
            <div><dt>Additional sites</dt><dd>Not provisioned in this demonstration</dd></div>
          </dl>
        </section>

        <section className="card detail-card" aria-labelledby="integration-heading">
          <header className="card__header"><div><span className="eyebrow">Out of scope for the prototype</span><h2 id="integration-heading">Integration boundaries</h2></div></header>
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
    </div>
  );
}
