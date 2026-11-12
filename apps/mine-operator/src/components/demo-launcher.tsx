"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { tiers } from "@/lib/personas";
import { useDemoContext } from "@/stores/demo-context";
import { useAccount } from "@/stores/session";
import { useToast } from "./toast-provider";
import { Select } from "./select";

/** Controls for HIMARK when presenting. Not linked from the product. */
export function DemoLauncher() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const account = useAccount();
  const { context, setContext, resetControls } = useDemoContext();
  const reset = useMutation({
    mutationFn: () => demoFetch<unknown>("/scenario/reset", { method: "POST" }),
    onSuccess: async () => {
      resetControls();
      if (account) setContext({ persona: account.name, role: account.role });
      await queryClient.invalidateQueries();
      toast.push({ title: "Records reset", detail: "Every record is back to its starting state." });
    },
  });

  return (
    <main className="console">
      <section className="console__card" aria-labelledby="console-title">
        <span className="console__mark">VESPER</span>
        <h1 id="console-title">Presenter console</h1>
        <p>Controls for presenting VESPER. This page is not part of the product and is not linked from it.</p>

        <label className="field">
          <span>Subscription shown to the client</span>
          <Select value={context.tier} onChange={(event) => setContext({ tier: event.target.value as typeof context.tier })}>
            {tiers.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
          </Select>
        </label>

        <div className="console__actions">
          <button className="button button--quiet" onClick={() => reset.mutate()} disabled={reset.isPending}>
            {reset.isPending ? "Resetting…" : "Reset all records"}
          </button>
          <Link className="button button--primary" href={account ? "/overview" : "/sign-in"}>{account ? "Open VESPER" : "Go to sign in"}</Link>
        </div>
      </section>
    </main>
  );
}
