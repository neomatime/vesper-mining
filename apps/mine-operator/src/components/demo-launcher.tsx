"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Database, HardHat, Info, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { demoFetch } from "@/lib/api";
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
          <label><span>Persona</span><select value={context.role} onChange={(event) => setContext({ role: event.target.value, persona: event.target.selectedOptions[0].dataset.name ?? context.persona })}><option data-name="John Dlamini">Mine Manager</option><option data-name="Amina Patel">Shift Supervisor</option><option data-name="Lebo Maseko">Maintenance Planner</option><option data-name="Naledi Khoza">Stores / Inventory Controller</option><option data-name="Thabo Molefe">Field Employee</option></select></label>
          <label><span>Subscription</span><select value={context.tier} onChange={(event) => setContext({ tier: event.target.value as typeof context.tier })}><option value="core">Core</option><option value="operations_single">Operations — Single Site</option><option value="operations">Operations</option><option value="enterprise">Enterprise</option></select></label>
          <label><span>Fictional site</span><select value={context.siteId} onChange={(event) => setContext({ siteId: event.target.value })}><option value="site-riverside">Riverside Mine · Open Pit</option></select></label>
          <label><span>Scenario</span><select value={context.scenario} onChange={(event) => setContext({ scenario: event.target.value as typeof context.scenario })}><option value="equipment_breakdown">Equipment Breakdown</option><option value="spare_parts_risk">Spare Parts Risk</option><option value="normal_operations">Normal Operations</option><option value="unknown_inventory">Unknown Inventory</option><option value="shift_handover">Shift Handover</option><option value="stale_map">Stale Operational Map</option><option value="offline_report">Offline Field Report</option></select></label>
        </div>
        <div className="launcher-summary"><HardHat /><div><small>Selected context</small><strong>{context.role} · Riverside Mine</strong><span>Thu, 24 Apr 2025 · deterministic fixture clock</span></div></div>
        <button className="button button--primary button--wide button--large" onClick={() => router.push(context.role === "Field Employee" ? "/mobile/my-shift" : "/overview")}>Enter demonstration <ArrowRight /></button>
        <button className="launcher-reset" onClick={() => reset.mutate()} disabled={reset.isPending}><RotateCcw /> Reset all fictional records</button>
        <div className="launcher-disclosure"><Info /><p>This prototype is not connected to mine systems. All figures, locations, identities, events and actions are fictional.</p></div>
      </section>
    </main>
  );
}
