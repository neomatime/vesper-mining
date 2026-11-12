"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { formatMoney, urgencyLabels } from "@/lib/service-rules";
import { Field } from "./form-field";
import { useProviderReply, useProviderRequest } from "./use-service";
import { DateInput } from "./date-fields";

type Values = { amount: string; reference: string; availableFrom: string; validUntil: string; notes: string; reason: string };

/** The page a service provider opens from the link the mine sends them. No sign-in, and nothing else in VESPER is reachable from it. */
export function ProviderResponseScreen({ token }: { token: string }) {
  const query = useProviderRequest(token);
  const reply = useProviderReply(token);
  const form = useForm<Values>({ defaultValues: { amount: "", reference: "", availableFrom: "", validUntil: "", notes: "", reason: "" } });
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState("");

  const frame = (children: React.ReactNode) => (
    <main className="provider-page">
      <header className="provider-page__brand">VESPER</header>
      <div className="provider-page__body">{children}</div>
    </main>
  );

  if (query.isPending) return frame(<p className="provider-page__note">Loading…</p>);
  if (query.isError) {
    return frame(
      <section className="card detail-card restricted">
        <Lock aria-hidden="true" />
        <h1>This link is not valid</h1>
        <p>{query.error instanceof ApiError ? query.error.message : "Ask the mine to send you a new link."}</p>
      </section>,
    );
  }

  const view = query.data;
  const done = view.state === "quoted" || view.state === "declined";

  const send = (action: "quote" | "decline") =>
    form.handleSubmit((values) => {
      setError("");
      const payload = action === "quote" ? ({ action, amount: values.amount, reference: values.reference, availableFrom: values.availableFrom, validUntil: values.validUntil, notes: values.notes } as const) : ({ action, reason: values.reason } as const);
      reply.mutate(payload, {
        onSuccess: () => setDeclining(false),
        onError: (failure) => setError(failure instanceof Error ? failure.message : "That could not be sent. Try again."),
      });
    });

  return frame(
    <>
      <section className="card detail-card provider-page__job" aria-labelledby="job-heading">
        <header className="card__header">
          <div><span className="eyebrow">Request for quotation · {view.requestNumber}</span><h1 id="job-heading">{view.title}</h1></div>
        </header>
        <p className="card-note card-note--top">{view.mineName} · {view.siteName} has asked {view.providerName} to quote for the work below.</p>
        <dl className="definition-grid">
          <div><dt>Equipment</dt><dd>{view.equipment.name.includes(view.equipment.code) ? view.equipment.name : `${view.equipment.name} (${view.equipment.code})`}{view.equipment.makeModel ? ` · ${view.equipment.makeModel}` : ""}</dd></div>
          <div><dt>Urgency</dt><dd>{urgencyLabels[view.urgency]}</dd></div>
          <div><dt>Preferred date</dt><dd>{view.preferredDate ?? "No preference"}</dd></div>
        </dl>
        {view.description ? <p className="prose">{view.description}</p> : null}
      </section>

      {!view.open ? (
        <section className="card detail-card restricted">
          <Lock aria-hidden="true" />
          <h2>{view.closedReason}</h2>
          {view.quote ? <p>Your quote of {view.quote.amount !== null ? formatMoney(view.quote.amount) : "—"} was recorded.</p> : null}
        </section>
      ) : (
        <section className="card detail-card" aria-labelledby="reply-heading">
          <header className="card__header"><div><span className="eyebrow">Your reply</span><h2 id="reply-heading">{view.state === "quoted" ? "Your quote" : view.state === "declined" ? "You declined this request" : "Send your quote"}</h2></div></header>

          {done && !reply.isPending && view.state === "quoted" && view.quote ? (
            <div className="provider-page__sent" role="status">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>Quote sent: {view.quote.amount !== null ? formatMoney(view.quote.amount) : "—"}</strong>
                <p>The mine can see it now. You can send a new quote below until they choose a provider.</p>
              </div>
            </div>
          ) : null}
          {view.state === "declined" ? (
            <div className="provider-page__sent" role="status">
              <CheckCircle2 aria-hidden="true" />
              <div><strong>Declined</strong><p>The mine has your reply. You can still send a quote below if you change your mind.</p></div>
            </div>
          ) : null}

          <form className="form-grid form-grid--card" noValidate onSubmit={send("quote")}>
            <Field label="Quoted amount (R)"><input inputMode="decimal" {...form.register("amount")} /></Field>
            <Field label="Your quote reference"><input {...form.register("reference")} /></Field>
            <Field label="Can start from"><DateInput {...form.register("availableFrom")} /></Field>
            <Field label="Quote valid until"><DateInput {...form.register("validUntil")} /></Field>
            <Field label="Notes for the mine" wide><textarea rows={3} {...form.register("notes")} /></Field>
            {error ? <p className="signin__error form-field--wide" role="alert">{error}</p> : null}
            <div className="form-field--wide provider-page__actions">
              <button className="button button--primary" disabled={reply.isPending}>{reply.isPending ? "Sending…" : view.state === "quoted" ? "Send a new quote" : "Send quote"}</button>
              {view.state !== "declined" ? <button type="button" className="button button--quiet" onClick={() => setDeclining((value) => !value)}>Decline this request</button> : null}
            </div>
          </form>

          {declining ? (
            <form className="form-grid form-grid--card" onSubmit={send("decline")}>
              <Field label="Reason, if you wish to give one" wide><textarea rows={2} {...form.register("reason")} /></Field>
              <div className="form-field--wide provider-page__actions"><button className="button button--danger" disabled={reply.isPending}>Confirm decline</button></div>
            </form>
          ) : null}
        </section>
      )}
      <p className="provider-page__note">This page is private to {view.providerName}. It shows only this request.</p>
    </>,
  );
}
