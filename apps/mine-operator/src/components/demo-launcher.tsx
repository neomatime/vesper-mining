"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Database, HardHat, Info, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { demoFetch } from "@/lib/api";
import { personas, scenarios, tiers } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";

export function DemoLauncher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { context, setContext, resetControls } = useDemoContext();
  const reset = useMutation({
    mutationFn: () => demoFetch<unknown>("/scenario/reset", { method: "POST" }),
    onSuccess: async () => {
      resetControls();
      await queryClient.invalidateQueries();
    },
  });

  return (
    <main className="demo-launcher">
      <section className="demo-launcher__intro">
        <div className="demo-launcher__brand">VESPER <span>v3.0</span></div>
        <span className="demo-launcher__label"><span /> DEMO / SIMULATED DATA</span>
        <h1>Operational clarity,<br />without false certainty.</h1>
        <p>Explore a fictional, deterministic mining-operations experience designed to coordinate constraints, readiness and shift continuity.</p>
        <div className="demo-launcher__principles">
          <div><CheckCircle2 /><span><strong>Fictional records only</strong><small>No real mine, employee or client data</small></span></div>
          <div><ShieldCheck /><span><strong>No operational authority</strong><small>No equipment, safety or procurement action</small></span></div>
          <div><Database /><span><strong>Local deterministic state</strong><small>Resettable browser mock service</small></span></div>
        </div>
      </section>
      <section className="demo-launcher__panel">
        <span className="eyebrow">Demonstration context</span>
        <h2>Launch VESPER</h2>
        <p>Choose a fictional persona, subscription and scenario. Site-scoped records update together.</p>
        <div className="launcher-form">
          <label><span>Persona</span><select value={context.role} onChange={(event) => { const persona = personas.find((item) => item.role === event.target.value); if (persona) setContext({ role: persona.role, persona: persona.name }); }}>{personas.map((persona) => <option key={persona.name} value={persona.role}>{persona.role}</option>)}</select></label>
          <label><span>Subscription</span><select value={context.tier} onChange={(event) => setContext({ tier: event.target.value as typeof context.tier })}>{tiers.filter((tier) => tier.value !== "group").map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}</select></label>
          <label><span>Fictional site</span><select value={context.siteId} onChange={(event) => setContext({ siteId: event.target.value })}><option value="site-riverside">Riverside Mine · Open Pit</option></select></label>
          <label><span>Scenario</span><select value={context.scenario} onChange={(event) => setContext({ scenario: event.target.value as typeof context.scenario })}>{scenarios.map((scenario) => <option key={scenario.value} value={scenario.value}>{scenario.label}</option>)}</select></label>
        </div>
        <div className="launcher-summary"><HardHat /><div><small>Selected context</small><strong>{context.role} · Riverside Mine</strong><span>Thu, 24 Apr 2025 · deterministic fixture clock</span></div></div>
        <button className="button button--primary button--wide button--large" onClick={() => router.push(context.role === "Field Employee" ? "/mobile/my-shift" : "/overview")}>Enter demonstration <ArrowRight /></button>
        <button className="launcher-reset" onClick={() => reset.mutate()} disabled={reset.isPending}><RotateCcw /> Reset all fictional records</button>
        <div className="launcher-disclosure"><Info /><p>This prototype is not connected to mine systems. All figures, locations, identities, events and actions are fictional.</p></div>
      </section>
    </main>
  );
}
