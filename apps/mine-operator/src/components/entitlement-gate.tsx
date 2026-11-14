"use client";

import type { FeatureCode } from "@vesper/api-contracts";
import { Lock } from "lucide-react";
import Link from "next/link";
import { can, entitlementsFor, featureAvailability, tierThatIncludes } from "@/lib/entitlements";
import { useDemoContext } from "@/stores/demo-context";

type Capability = "mobile" | "advancedAnalytics" | "operationalReporting";

const copy: Record<Capability, { title: string; body: string }> = {
  mobile: {
    title: "VESPER Mobile is not available on this account",
    body: "Every VESPER subscription includes the field workflows: My Shift, My Work, Report and Notifications. If you cannot see them, ask your administrator. Web workflows stay available.",
  },
  operationalReporting: {
    title: "Detailed operational reports are part of Operations",
    body: "Your subscription includes the essential reports. Detailed operational reporting is an Operations capability. Your other workflows stay available.",
  },
  advancedAnalytics: {
    title: "Advanced analytics are part of Enterprise and Group",
    body: "Your subscription includes the essential and operational reports. Advanced trend views are an Enterprise and Group capability.",
  },
};

/** Explains a capability the current demonstration subscription does not include. Hiding it is not access control (BR-019). */
export function EntitlementGate({ capability }: { capability: Capability }) {
  const { context } = useDemoContext();
  const plan = entitlementsFor(context.tier);

  return (
    <section className="entitlement-gate" aria-labelledby="gate-title">
      <span className="entitlement-gate__icon"><Lock aria-hidden="true" /></span>
      <h1 id="gate-title">{copy[capability].title}</h1>
      <p>{copy[capability].body}</p>
      <dl>
        <div><dt>Your subscription</dt><dd>{plan.label}</dd></div>
        <div><dt>Included from</dt><dd>{capability === "operationalReporting" ? "Operations — Single Site" : tierThatIncludes(capability)}</dd></div>
      </dl>
      <div className="button-row">
        <Link className="button button--primary" href="/admin">View your plan</Link>
        <Link className="button button--quiet" href="/overview">Back to Overview</Link>
      </div>
    </section>
  );
}

/**
 * Shows its content only when the selected subscription includes the feature. Otherwise it says what the feature is and which
 * subscription includes it. This is presentation for the prototype. It is not access control (PRD VES-BR-019).
 */
export function FeatureGate({ feature, children }: { feature: FeatureCode; children: React.ReactNode }) {
  const { context } = useDemoContext();
  if (can(context.tier, feature)) return <>{children}</>;
  const { info, includedFrom } = featureAvailability(feature);
  const plan = entitlementsFor(context.tier);

  return (
    <section className="entitlement-gate" aria-labelledby="gate-title">
      <span className="entitlement-gate__icon"><Lock aria-hidden="true" /></span>
      <h1 id="gate-title">{info.label} is not part of your subscription</h1>
      <p>{info.summary} Your other workflows stay available.</p>
      <dl>
        <div><dt>Your subscription</dt><dd>{plan.label}</dd></div>
        <div><dt>Included from</dt><dd>{includedFrom}</dd></div>
      </dl>
      <div className="button-row">
        <Link className="button button--primary" href="/admin">View your plan</Link>
        <Link className="button button--quiet" href="/overview">Back to Overview</Link>
      </div>
    </section>
  );
}
