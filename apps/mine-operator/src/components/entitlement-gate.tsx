"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { entitlementsFor, tierThatIncludes } from "@/lib/entitlements";
import { useDemoContext } from "@/stores/demo-context";

type Capability = "mobile" | "advancedAnalytics";

const copy: Record<Capability, { title: string; body: string }> = {
  mobile: {
    title: "VESPER Mobile is not part of this subscription",
    body: "Field reporting, My Work and mobile notifications are included from the Operations subscriptions. Web workflows stay available.",
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
        <div><dt>Included from</dt><dd>{tierThatIncludes(capability)}</dd></div>
      </dl>
      <div className="button-row">
        <Link className="button button--primary" href="/admin">View your plan</Link>
        <Link className="button button--quiet" href="/overview">Back to Overview</Link>
      </div>
    </section>
  );
}
