"use client";

import { ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { safeNext } from "@/lib/accounts";
import { entitlementsFor } from "@/lib/entitlements";
import { useDemoContext } from "@/stores/demo-context";
import { exit, useAccount, useSession } from "@/stores/session";

export function SignInScreen() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const account = useAccount();
  const signIn = useSession((state) => state.signIn);
  const mobileIncluded = entitlementsFor(useDemoContext((state) => state.context.tier)).mobile;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    exit.explicit = false;
  }, []);

  useEffect(() => {
    if (!account || busy) return;
    router.replace(next ?? (account.home.startsWith("/mobile") && !mobileIncluded ? "/overview" : account.home));
  }, [account, busy, next, mobileIncluded, router]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setBusy(true);
    setError("");
    signIn(email, password)
      .then((signedIn) => router.replace(next ?? (signedIn.home.startsWith("/mobile") && !mobileIncluded ? "/overview" : signedIn.home)))
      .catch((failure: unknown) => {
        setBusy(false);
        setError(failure instanceof ApiError ? failure.message : "Signing in did not work. Try again.");
      });
  };

  return (
    <main className="signin">
      <section className="signin__brand" aria-hidden="true">
        <span className="signin__mark">VESPER</span>
        <div className="signin__statement">
          <p>Identify delays.</p>
          <p>Prevent avoidable waiting.</p>
          <p>Recover productive time.</p>
        </div>
        <svg className="signin__contours" viewBox="0 0 600 600" fill="none" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <ellipse key={index} cx="360" cy="420" rx={70 + index * 42} ry={40 + index * 26} transform="rotate(-18 360 420)" />
          ))}
        </svg>
      </section>

      <section className="signin__panel">
        <form className="signin__form" onSubmit={submit} noValidate>
          <h1>Sign in</h1>
          <p>Welcome back. Use your work email address.</p>

          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>

          {error ? <p className="signin__error" role="alert">{error}</p> : null}

          <button className="button button--primary button--wide button--large" disabled={busy}>
            {busy ? "Signing in…" : <>Sign in <ArrowRight /></>}
          </button>
        </form>
        <small className="signin__note">All sites, people and records in this build are fictional.</small>
      </section>
    </main>
  );
}
