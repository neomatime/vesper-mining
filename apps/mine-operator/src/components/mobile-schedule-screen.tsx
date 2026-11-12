"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { addMonths, isSameMonth, monthLabel, shiftsByDay, siteDate } from "@/lib/shift-calendar";
import { useDemoContext } from "@/stores/demo-context";
import { LoadingState } from "./query-state";
import { DayAgenda, MonthGrid } from "./shift-calendar";
import { useShellData } from "./shell-data";

/** The field view of the shift calendar: a compact month, then the chosen day's shifts. */
export function MobileScheduleScreen() {
  const { context } = useDemoContext();
  const { data } = useShellData();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [selected, setSelected] = useState<string | null>(null);
  const shifts = data?.shifts;
  const visible = useMemo(
    () => (shifts ?? []).filter((shift) => scope === "all" || shift.supervisor === context.persona || shift.crew.some((member) => member.name === context.persona)),
    [shifts, scope, context.persona],
  );
  const byDay = useMemo(() => shiftsByDay(visible), [visible]);
  if (!data) return <LoadingState />;

  const today = siteDate(data.now);
  const day = selected ?? today;
  const move = (direction: 1 | -1) => {
    const target = addMonths(day, direction);
    setSelected(isSameMonth(today, target) ? today : target);
  };

  return (
    <div className="mobile-task-page">
      <div className="mobile-page-header">
        <span className="eyebrow">{context.siteName}</span>
        <h1>Shift calendar</h1>
        <p>{scope === "mine" ? "The shifts you are on." : "Every shift on site."}</p>
      </div>

      <div className="segmented segmented--full" role="group" aria-label="Which shifts to show">
        <button type="button" className={scope === "mine" ? "active" : ""} aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>My shifts</button>
        <button type="button" className={scope === "all" ? "active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>All shifts</button>
      </div>

      <section className="card cal-card cal-card--mobile">
        <div className="cal-toolbar">
          <div className="cal-toolbar__nav">
            <button type="button" className="icon-button icon-button--light" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft /></button>
            <h2 aria-live="polite">{monthLabel(day)}</h2>
            <button type="button" className="icon-button icon-button--light" aria-label="Next month" onClick={() => move(1)}><ChevronRight /></button>
          </div>
          <button type="button" className="button button--quiet button--small" onClick={() => setSelected(today)} disabled={day === today}>Today</button>
        </div>
        <MonthGrid month={day} selected={day} today={today} byDay={byDay} onSelect={setSelected} compact />
      </section>

      <DayAgenda day={day} shifts={byDay.get(day) ?? []} mine={context.persona} emptyHint={scope === "mine" ? "You are not on a shift this day." : "No shifts are planned for this day."} />
    </div>
  );
}
