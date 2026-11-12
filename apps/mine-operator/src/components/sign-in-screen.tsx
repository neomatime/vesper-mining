"use client";

import { ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { safeNext } from "@/lib/accounts";
import { passwordProblem } from "@/lib/organisation-rules";
import { entitlementsFor } from "@/lib/entitlements";
import { useDemoContext } from "@/stores/demo-context";
import { exit, useAccount, useSession } from "@/stores/session";

export function SignInScreen() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const account = useAccount();
  const signIn = useSession((state) => state.signIn);
  const changePassword = useSession((state) => state.changePassword);
  const signInWithMicrosoft = useSession((state) => state.signInWithMicrosoft);
  const [step, setStep] = useState<"credentials" | "new-password">("credentials");
  const [fresh, setFresh] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const mobileIncluded = entitlementsFor(useDemoContext((state) => state.context.tier)).mobile;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(false);
  const emailField = useRef<HTMLInputElement>(null);
  const freshField = useRef<HTMLInputElement>(null);

  // A phone raises its keyboard the moment a field takes focus, hiding the form. So the first field is focused for
  // you only where there is a physical keyboard; on a touch screen the person taps the field when they are ready.
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    (step === "credentials" ? emailField : freshField).current?.focus();
  }, [step]);

  // When a field does take focus on a touch screen, bring it to the middle of the visible area above the keyboard.
  const keepInView = (event: React.FocusEvent<HTMLInputElement>) => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    setCompact(true);
    const field = event.currentTarget;
    window.setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
  };

  useEffect(() => {
    exit.explicit = false;
  }, []);

  useEffect(() => {
    if (!account || busy) return;
    router.replace(next ?? (account.home.startsWith("/mobile") && !mobileIncluded ? "/overview" : account.home));
  }, [account, busy, next, mobileIncluded, router]);

  const goHome = (home: string) => router.replace(next ?? (home.startsWith("/mobile") && !mobileIncluded ? "/overview" : home));
  const fail = (failure: unknown) => {
    setBusy(false);
    setError(failure instanceof ApiError ? failure.message : "VESPER could not be reached. Reload the page and try again.");
  };

  const continueWithMicrosoft = () => {
    setError("");
    if (!email.trim()) {
      setError("Enter your work email address, then continue with Microsoft.");
      return;
    }
    setBusy(true);
    signInWithMicrosoft(email)
      .then((result) => result.account && goHome(result.account.home))
      .catch(fail);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (step === "new-password") {
      const problem = passwordProblem(fresh, password);
      if (problem) return setError(problem);
      if (fresh !== confirmation) return setError("The two passwords do not match.");
      setBusy(true);
      changePassword(email, password, fresh)
        .then((result) => result.account && goHome(result.account.home))
        .catch(fail);
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setBusy(true);
    signIn(email, password)
      .then((result) => {
        if (result.mustChangePassword) {
          setStep("new-password");
          setBusy(false);
        } else if (result.account) goHome(result.account.home);
      })
      .catch(fail);
  };

  return (
    <main className={`signin ${compact ? "signin--compact" : ""}`}>
      <section className="signin__brand" aria-hidden="true">
        <span className="signin__mark">VESPER</span>
        <div className="signin__statement">
          <p>Identify delays.</p>
          <p>Prevent avoidable waiting.</p>
          <p>Recover productive time.</p>
        </div>
      </section>

      <section className="signin__panel">
        <form className="signin__form" onSubmit={submit} noValidate>
          {step === "credentials" ? (
            <>
              <h1>Sign in</h1>
              <p>Welcome back. Use your work email address.</p>

              <label className="field">
                <span>Email address</span>
                <input type="email" autoComplete="username" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} ref={emailField} onFocus={keepInView} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} onFocus={keepInView} />
              </label>
            </>
          ) : (
            <>
              <h1>Choose a new password</h1>
              <p>Your administrator gave you a temporary password. Choose one only you know to continue.</p>
              <label className="field">
                <span>New password</span>
                <input type="password" autoComplete="new-password" value={fresh} onChange={(event) => setFresh(event.target.value)} aria-invalid={Boolean(error)} ref={freshField} onFocus={keepInView} />
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-invalid={Boolean(error)} />
              </label>
              <small className="signin__note signin__note--left">At least 10 characters, with upper and lower case letters and a number.</small>
            </>
          )}

          {error ? <p className="signin__error" role="alert">{error}</p> : null}

          <button className="button button--primary button--wide button--large" disabled={busy}>
            {busy ? <><span className="spinner" aria-hidden="true" /> Signing you in…</> : step === "credentials" ? <>Sign in <ArrowRight /></> : <>Save and continue <ArrowRight /></>}
          </button>
          {step === "credentials" ? (
            <>
              <div className="signin__divider" aria-hidden="true"><span>or</span></div>
              <button type="button" className="button button--sso button--wide button--large" onClick={continueWithMicrosoft} disabled={busy}>
                <svg viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
                Continue with Microsoft
              </button>
            </>
          ) : null}

        </form>
        <small className="signin__note signin__demo-note">
          <strong>Demo / simulated data</strong>
          <span>All sites, people and records in this build are fictional.</span>
        </small>
      </section>
    </main>
  );
}
