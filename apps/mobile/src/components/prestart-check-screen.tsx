"use client";

/**
 * The pre-start check for one machine: the operator's walk-around before using it. Each item is marked Pass, Fail or N/A with
 * large buttons; a failed item needs a short note. Failed items are raised as issues against the machine. Offline, the check
 * waits in the outbox and is sent when the phone is back online.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ClipboardCheck, CloudOff, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Busy } from "@core/components/busy";
import { ErrorState, LoadingState } from "@core/components/query-state";
import { useShellData } from "@core/components/shell-data";
import { useToast } from "@core/components/toast-provider";
import { demoFetch, demoSend } from "@core/lib/api";
import { formatDemoTime } from "@core/lib/demo-clock";
import { checklistFor, checkProblem, latestCheck, prestartCategories, prestartOperabilityLabels, prestartResultLabels, type PrestartCheck, type PrestartOperability, type PrestartResult } from "@core/lib/prestart-rules";
import { currentShiftFor } from "@core/lib/shift-rules";
import { useDemoContext } from "@core/stores/demo-context";
import { useOutbox } from "@core/stores/outbox";

type Answers = Record<string, { result?: PrestartResult; note?: string }>;
type Saved = { kind: "sent"; check: PrestartCheck } | { kind: "pending" };

export function PrestartCheckScreen({ equipmentId }: { equipmentId: string }) {
  const { data: shell } = useShellData();
  const { context, connectivity } = useDemoContext();
  const addToOutbox = useOutbox((state) => state.add);
  const queryClient = useQueryClient();
  const toast = useToast();
  const history = useQuery({ queryKey: ["prestart", equipmentId], queryFn: () => demoFetch<PrestartCheck[]>(`/prestart-checks?equipmentId=${encodeURIComponent(equipmentId)}`), staleTime: 0 });
  const [answers, setAnswers] = useState<Answers>({});
  const [operability, setOperability] = useState<PrestartOperability | null>(null);
  const [hours, setHours] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const unit = shell?.equipment.find((item) => item.id === equipmentId);
  const shift = shell ? currentShiftFor(shell.shifts, context.persona) : undefined;
  const items = unit ? checklistFor(unit.category) : [];
  const failed = items.filter((entry) => answers[entry.id]?.result === "fail");
  const answered = items.filter((entry) => answers[entry.id]?.result).length;

  const submit = useMutation({
    // Runs without signal too: offline, the check goes to the outbox instead of the API.
    networkMode: "always",
    mutationFn: async (): Promise<Saved> => {
      const body = { equipmentId, shiftId: shift?.id ?? null, answers, operability: failed.length ? operability : "yes", hoursReading: hours.trim() === "" ? null : Number(hours) };
      if (connectivity === "offline") {
        addToOutbox({ kind: "prestart", title: `Pre-start check, ${unit?.code ?? unit?.name ?? equipmentId}`, path: "/prestart-checks", body, by: context.persona });
        return { kind: "pending" };
      }
      return { kind: "sent", check: await demoSend<PrestartCheck>("/prestart-checks", "POST", body) };
    },
    onSuccess: async (result) => {
      setSaved(result);
      window.scrollTo({ top: 0 });
      if (result.kind === "sent") {
        await queryClient.invalidateQueries();
        toast.push({ title: "Pre-start check recorded", detail: result.check.issueIds.length ? `${result.check.issueIds.length} fault${result.check.issueIds.length === 1 ? "" : "s"} reported to the supervisor.` : "All items passed." });
      }
    },
  });

  if (!shell || history.isPending) return <LoadingState variant="panel" />;
  if (!unit) return <ErrorState message="That machine could not be found." />;
  if (!prestartCategories.includes(unit.category)) {
    return (
      <div className="mobile-task-page">
        <Link href="/my-shift" className="back-link"><ArrowLeft /> My Shift</Link>
        <div className="mobile-page-header"><h1>{unit.name}</h1><p>This is inspected on its own plan, not with a pre-start check.</p></div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="mobile-task-page">
        {saved.kind === "pending" ? (
          <section className="success-state success-state--pending" aria-live="polite">
            <CloudOff />
            <span className="eyebrow">Pending Synchronisation</span>
            <h1>Check saved on this phone</h1>
            <p>It has not been received centrally. It is sent when you are back online.</p>
            <div className="button-row"><Link className="button button--primary" href="/my-reports">See waiting items</Link><Link className="button button--quiet" href="/my-shift">Return to My Shift</Link></div>
          </section>
        ) : (
          <section className="success-state" aria-live="polite">
            {saved.check.issueIds.length ? <TriangleAlert /> : <CheckCircle2 />}
            <span className="eyebrow">Pre-start check · {formatDemoTime(saved.check.at)}</span>
            <h1>{saved.check.issueIds.length ? `${saved.check.issueIds.length} fault${saved.check.issueIds.length === 1 ? "" : "s"} reported` : "All clear"}</h1>
            <p>{saved.check.issueIds.length ? `${prestartOperabilityLabels[saved.check.operability ?? "yes"]}. The supervisor has been told; the faults are in My reports.` : `${unit.name} passed every item.`}</p>
            <div className="button-row">
              {saved.check.issueIds.length ? <Link className="button button--primary" href="/my-reports">Track the faults</Link> : null}
              <Link className={`button ${saved.check.issueIds.length ? "button--quiet" : "button--primary"}`} href="/my-shift">Return to My Shift</Link>
            </div>
          </section>
        )}
      </div>
    );
  }

  const done = latestCheck(history.data ?? [], equipmentId, shift?.id ?? null, shell.now);
  const record = () => {
    const found = checkProblem(items, answers, failed.length ? operability : "yes");
    setProblem(found);
    if (!found) submit.mutate();
  };
  const set = (id: string, change: { result?: PrestartResult; note?: string }) => setAnswers((current) => ({ ...current, [id]: { ...current[id], ...change } }));

  return (
    <div className="mobile-task-page prestart">
      <Link href="/my-shift" className="back-link"><ArrowLeft /> My Shift</Link>
      <div className="mobile-page-header">
        <span className="eyebrow">Pre-start check</span>
        <h1>{unit.name}</h1>
        <p>Walk around the machine before you start. Mark every item; say what is wrong with anything that fails.</p>
      </div>
      {done ? <p className="prestart__done" role="status"><ClipboardCheck aria-hidden="true" /> Already checked this shift at {formatDemoTime(done.at)} by {done.by}{done.issueIds.length ? ` (${done.issueIds.length} fault${done.issueIds.length === 1 ? "" : "s"})` : ", all clear"}. You can check again.</p> : null}

      <label className="form-field prestart__hours">
        <span>Hour meter reading (optional)</span>
        <input inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="For example 12 480" />
      </label>

      <ol className="prestart__items" aria-label={`Checklist, ${answered} of ${items.length} answered`}>
        {items.map((entry, index) => {
          const answer = answers[entry.id];
          return (
            <li key={entry.id} className={`prestart__item ${answer?.result ? `is-${answer.result}` : ""}`}>
              <div className="prestart__label"><span>{index + 1}</span><div><strong>{entry.label}</strong><small>{entry.hint}</small></div></div>
              <div className="prestart__choices" role="radiogroup" aria-label={entry.label}>
                {(["pass", "fail", "na"] as const).map((result) => (
                  <button key={result} type="button" role="radio" aria-checked={answer?.result === result} className={`prestart__choice prestart__choice--${result} ${answer?.result === result ? "is-on" : ""}`} onClick={() => set(entry.id, { result })}>
                    {prestartResultLabels[result]}
                  </button>
                ))}
              </div>
              {answer?.result === "fail" ? (
                <label className="form-field prestart__note">
                  <span>What is wrong?</span>
                  <textarea rows={2} value={answer.note ?? ""} onChange={(event) => set(entry.id, { note: event.target.value })} aria-label={`What is wrong with ${entry.label}`} />
                </label>
              ) : null}
            </li>
          );
        })}
      </ol>

      {failed.length ? (
        <fieldset className="prestart__operability">
          <legend>Can the machine be used? (as you see it)</legend>
          {(["yes", "limited", "no"] as const).map((value) => (
            <label key={value} className={`prestart__radio ${operability === value ? "is-on" : ""}`}>
              <input type="radio" name="operability" value={value} checked={operability === value} onChange={() => setOperability(value)} />
              {prestartOperabilityLabels[value]}
            </label>
          ))}
          <small className="field-hint">This helps the supervisor and maintenance decide. It does not take the machine out of service by itself.</small>
        </fieldset>
      ) : null}

      {problem ? <p className="field-error" role="alert">{problem}</p> : null}
      {submit.isError ? <p className="field-error" role="alert">{submit.error.message}</p> : null}
      <div className="prestart__footer">
        <span>{answered} of {items.length} answered{failed.length ? ` · ${failed.length} failed` : ""}</span>
        <button type="button" className="button button--primary" onClick={record} disabled={submit.isPending}>
          <Busy pending={submit.isPending} label="Recording…">{connectivity === "offline" ? "Save check on this phone" : "Record check"}</Busy>
        </button>
      </div>
    </div>
  );
}
