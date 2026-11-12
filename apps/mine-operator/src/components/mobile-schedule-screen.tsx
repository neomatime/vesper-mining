"use client";

import { useMemo, useState } from "react";
import { shiftsByDay, siteDate } from "@/lib/shift-calendar";
import { useDemoContext } from "@/stores/demo-context";
import { LoadingState } from "./query-state";
import { CalendarToolbar, DayAgenda, DayTimeline, MonthGrid, WeekStrip, useCalendar } from "./shift-calendar";
import { useShellData } from "./shell-data";

/** The field view of the shift calendar: a month, a week or a day, for the shifts you are on or every shift. */
export function MobileScheduleScreen() {
  const { context } = useDemoContext();
  const { data } = useShellData();
  const calendar = useCalendar(data ? siteDate(data.now) : "2025-04-24");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const shifts = data?.shifts;
  const visible = useMemo(
    () => (shifts ?? []).filter((shift) => scope === "all" || shift.supervisor === context.persona || shift.crew.some((member) => member.name === context.persona)),
    [shifts, scope, context.persona],
  );
  const byDay = useMemo(() => shiftsByDay(visible), [visible]);
  if (!data) return <LoadingState />;

  const { view, selected, setSelected, today } = calendar;
  const emptyHint = scope === "mine" ? "You are not on a shift this day." : "No shifts are planned for this day.";

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
        <CalendarToolbar calendar={calendar} />
        {view === "month" ? <MonthGrid month={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} compact /> : null}
        {view === "week" ? <WeekStrip week={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} /> : null}
        {view === "day" ? <div className="cal-card__timeline"><DayTimeline day={selected} shifts={visible} now={data.now} mine={context.persona} /></div> : null}
      </section>

      {view !== "day" ? <DayAgenda day={selected} shifts={byDay.get(selected) ?? []} mine={context.persona} emptyHint={emptyHint} /> : null}
    </div>
  );
}
