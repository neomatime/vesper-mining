"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ClipboardList, Copy, Printer } from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { allocationSheet, allocationToText } from "@/lib/shift-allocation";
import type { ShiftView } from "@/lib/shift-rules";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { useToast } from "./toast-provider";

/** A shift's work allocation as a sheet to print, pin up, or paste into a message. It is always the same as the shift on screen. */
export function ShiftAllocationScreen({ id }: { id: string }) {
  const toast = useToast();
  const { data: shell } = useShellData();
  const query = useQuery({ queryKey: ["shift", id], queryFn: () => demoFetch<ShiftView>(`/shifts/${id}`) });
  if (query.isPending || !shell) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const shift = query.data;
  const equipment = shell.equipment;
  const sheet = allocationSheet(shift, (equipmentId) => equipment.find((item) => item.id === equipmentId)?.name ?? null, shell.now);

  const copy = async () => {
    const text = allocationToText(sheet);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Some app views refuse clipboard access: select the text in a temporary field instead.
      const field = document.createElement("textarea");
      field.value = text;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    toast.push({ title: "Allocation copied", detail: "Paste it into a message or an email." });
  };

  return (
    <div className="workspace-page allocation-page">
      <Link href={`/shifts/${shift.id}`} className="back-link no-print"><ArrowLeft /> {shift.name}</Link>
      <div className="no-print">
        <PageHeader
          eyebrow={`${shift.name} · ${sheet.day}`}
          title="Work allocation"
          description="Who is on the shift and what each person is working on. Print it, or copy it into a message."
          icon={ClipboardList}
          action={
            <div className="button-row">
              <button className="button button--quiet" onClick={copy}><Copy /> Copy as text</button>
              <button className="button button--primary" onClick={() => window.print()}><Printer /> Print</button>
            </div>
          }
        />
      </div>

      <article className="allocation-sheet" aria-label={`${shift.name} work allocation`}>
        <header className="alloc-head">
          <div>
            <span className="alloc-eyebrow">Work allocation</span>
            <h2>{sheet.shiftName}</h2>
            <p>{sheet.day} · {sheet.times}</p>
          </div>
          <div className="alloc-sup">
            <span className="alloc-eyebrow">Supervisor</span>
            <strong>{sheet.supervisor ?? "Not assigned"}</strong>
          </div>
        </header>

        {sheet.briefing ? <section><h3>Briefing</h3><p className="alloc-briefing">{sheet.briefing}</p></section> : null}

        <section>
          <h3>Crew</h3>
          {sheet.crew.length === 0 ? <p className="alloc-empty">No crew added yet.</p> : (
            <table className="alloc-table">
              <thead><tr><th scope="col">Name</th><th scope="col">Duty</th><th scope="col">Equipment</th></tr></thead>
              <tbody>
                {sheet.crew.map((member) => (
                  <tr key={member.name}><td>{member.name}</td><td>{member.duty}</td><td>{member.equipment ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h3>Work</h3>
          {sheet.work.length === 0 ? <p className="alloc-empty">No work planned yet.</p> : (
            <table className="alloc-table">
              <thead><tr><th scope="col">Task</th><th scope="col">Owner</th><th scope="col">Done</th></tr></thead>
              <tbody>
                {sheet.work.map((item) => (
                  <tr key={item.title + (item.owner ?? "")}>
                    <td>{item.title}</td>
                    <td>{item.owner ?? "Not assigned"}</td>
                    <td className="alloc-done">{item.done ? <span className="alloc-box alloc-box--done"><Check aria-hidden="true" /> Done</span> : <span className="alloc-box" aria-label="Not done yet" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="alloc-foot">From VESPER at {new Date(shell.now).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Allocation is a plan. It does not show who is competent or authorised for a task. The allocation can change, so check VESPER for the latest.</footer>
      </article>
    </div>
  );
}
