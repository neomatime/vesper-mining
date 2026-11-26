"use client";

/**
 * Every Trade page sits inside this guard. A role without Trade sees a plain explanation and a way back to Mining Operations, never the
 * commercial records. The demo API refuses Trade requests from such roles as well, so the guard is not the only protection.
 */
import { Lock } from "lucide-react";
import Link from "next/link";
import { canUseTrade } from "@/lib/workspaces";
import { useDemoContext } from "@/stores/demo-context";

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  const { context } = useDemoContext();
  if (!canUseTrade(context.role)) {
    return (
      <div className="workspace-page">
        <section className="card trade-denied" role="alert">
          <Lock aria-hidden="true" />
          <h1>Trade is not part of your role</h1>
          <p>Trade is used by the Mine Manager, the Commercial / Finance Officer and the Inventory Controller. Your work is in Mining Operations.</p>
          <Link className="button button--primary" href="/overview">Go to Mining Operations</Link>
        </section>
      </div>
    );
  }
  return <>{children}</>;
}
