"use client";

/**
 * The page a transporter opens from the link in a collection request, to confirm a collection time or decline. No sign-in: the
 * token in the address identifies the one request, and nothing else in VESPER is reachable from here. In this build the link is
 * opened from the Logistics page, because no message is actually sent to anyone.
 */
import { Lock, Truck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, demoFetch, demoSend } from "@/lib/api";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { formatTonnes, shortDate } from "@/lib/shipment-rules";
import type { demoDomain } from "@/lib/demo-store";
import { Field } from "./form-field";

type View = ReturnType<typeof demoDomain.transportView>;

export function TransportResponseScreen({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["transport", token], queryFn: () => demoFetch<View>(`/transport-response/${token}`) });
  const [answer, setAnswer] = useState<"confirm" | "decline">("confirm");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("08:00");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const { request, shipment, transporterName, mineName, siteName, open } = query.data;
  const submit = async () => {
    setError("");
    if (answer === "confirm" && (!date || !time)) return setError("Choose the collection date and time.");
    if (answer === "decline" && note.trim().length < 5) return setError("Tell the mine why you cannot collect.");
    setSaving(true);
    try {
      await demoSend(`/transport-response/${token}`, "POST", { answer, date, time, note });
      await queryClient.invalidateQueries({ queryKey: ["transport", token] });
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not work. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return frame(
    <section className="card task-card" aria-label="Collection request">
      <div>
        <span className="eyebrow"><Truck size={15} aria-hidden="true" /> Collection request {request.number}</span>
        <h1>{mineName} needs a collection</h1>
        <p className="muted">{siteName}. This request is for {transporterName}.</p>
      </div>
      <div className="fact-row">
        <div className="fact"><span>Shipment</span><strong>{shipment.number}</strong></div>
        <div className="fact"><span>Material</span><strong>{shipment.mineral} · {formatTonnes(shipment.tonnes)}</strong></div>
        <div className="fact"><span>Going to</span><strong>{shipment.destination}</strong></div>
        <div className="fact"><span>Preferred date</span><strong>{shortDate(shipment.preferredDate)}</strong></div>
      </div>
      <div className="note-bar"><span>You are answering as {transporterName}. Your reply goes straight to the mine.</span></div>

      {!open ? (
        <div className={`note-bar ${request.state === "confirmed" ? "note-bar--good" : ""}`} role="status">
          <span>
            {request.state === "confirmed" ? `Thank you. Collection is confirmed for ${request.collectionAt ? formatDemoDateTime(request.collectionAt) : "the agreed time"}. The mine has been told.` : request.state === "declined" ? "You declined this request. The mine has been told." : "This request was cancelled by the mine."}
          </span>
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate className="task-section">
          <div className="segmented" role="group" aria-label="Your answer">
            <button type="button" className={answer === "confirm" ? "active" : ""} aria-pressed={answer === "confirm"} onClick={() => setAnswer("confirm")}>Choose a time</button>
            <button type="button" className={answer === "decline" ? "active" : ""} aria-pressed={answer === "decline"} onClick={() => setAnswer("decline")}>Decline</button>
          </div>
          {answer === "confirm" ? (
            <div className="task-grid task-grid--two">
              <Field label="Collection date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
              <Field label="Collection time"><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></Field>
              <Field label="Note (optional)" wide><input value={note} onChange={(event) => setNote(event.target.value)} /></Field>
            </div>
          ) : (
            <Field label="Why can you not collect?" wide><input value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          )}
          {error ? <div className="inline-error" role="alert">{error}</div> : null}
          <div><button className="button button--primary" disabled={saving}>{saving ? "Sending…" : answer === "confirm" ? "Confirm collection" : "Send decline"}</button></div>
        </form>
      )}
    </section>,
  );
}
