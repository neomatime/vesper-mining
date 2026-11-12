"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Moon, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDemoTime } from "@/lib/demo-clock";
import { shiftTimes } from "@/lib/shift-format";
import {
  addDays,
  addMonths,
  dayBlock,
  dayLabel,
  dayNumber,
  dayPosition,
  endsNextDay,
  isSameMonth,
  monthGrid,
  monthLabel,
  shiftsByDay,
  shiftsOnDay,
  siteDate,
  weekDays,
  weekLabel,
  weekdayLabel,
} from "@/lib/shift-calendar";
import { shiftStateLabels, shiftTone, type ShiftView } from "@/lib/shift-rules";
import { StatusBadge } from "./status-badge";

const weekdayHeads = weekDays("2025-04-21").map(weekdayLabel);

function shiftCount(count: number) {
  return `${count} ${count === 1 ? "shift" : "shifts"}`;
}

/** One calendar month. Full-size cells list their shifts; compact cells show a dot per shift for small screens. */
export function MonthGrid({
  month,
  selected,
  today,
  byDay,
  onSelect,
  compact = false,
}: {
  month: string;
  selected: string;
  today: string;
  byDay: Map<string, ShiftView[]>;
  onSelect: (day: string) => void;
  compact?: boolean;
}) {
  const days = monthGrid(month);
  return (
    <div className={`cal ${compact ? "cal--compact" : ""}`} role="group" aria-label={monthLabel(month)}>
      <div className="cal__weekdays" aria-hidden="true">{weekdayHeads.map((name) => <span key={name}>{name}</span>)}</div>
      <div className="cal__grid">
        {days.map((day) => {
          const shifts = byDay.get(day) ?? [];
          const inMonth = isSameMonth(day, month);
          const classes = ["cal__day", !inMonth ? "cal__day--outside" : "", day === today ? "cal__day--today" : "", day === selected ? "cal__day--selected" : ""].join(" ");
          return (
            <div key={day} className={classes} onClick={(event) => { if (!(event.target as HTMLElement).closest("a")) onSelect(day); }}>
              <button
                type="button"
                className="cal__number"
                aria-pressed={day === selected}
                aria-label={`${dayLabel(day)}${day === today ? ", today" : ""}, ${shifts.length === 0 ? "no shifts" : shiftCount(shifts.length)}`}
                onClick={() => onSelect(day)}
              >
                {dayNumber(day)}
              </button>
              {compact ? (
                shifts.length > 0 ? <span className="cal__dots" aria-hidden="true">{shifts.slice(0, 3).map((shift) => <i key={shift.id} className={`cal__dot cal__dot--${shift.state}`} />)}</span> : null
              ) : (
                <ul className="cal__chips">
                  {shifts.slice(0, 3).map((shift) => (
                    <li key={shift.id}>
                      <Link href={`/shifts/${shift.id}`} className={`cal__chip cal__chip--${shift.state}`} title={`${shift.name}, ${shiftTimes(shift)}, ${shiftStateLabels[shift.state]}`}>
                        <b>{shiftTimes(shift).slice(0, 5)}</b> {shift.name}
                      </Link>
                    </li>
                  ))}
                  {shifts.length > 3 ? <li><button type="button" className="cal__more" onClick={() => onSelect(day)}>+{shifts.length - 3} more</button></li> : null}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The shifts on one day, as cards. */
export function DayAgenda({
  day,
  shifts,
  mine,
  action,
  emptyHint,
}: {
  day: string;
  shifts: ShiftView[];
  /** The signed-in person's name, to show their own duty on each shift. */
  mine?: string;
  action?: React.ReactNode;
  emptyHint?: string;
}) {
  return (
    <section className="cal-agenda" aria-label={`Shifts on ${dayLabel(day)}`}>
      <header>
        <div>
          <h2>{dayLabel(day)}</h2>
          <p>{shifts.length === 0 ? "Nothing planned" : shiftCount(shifts.length)}</p>
        </div>
        {action}
      </header>
      {shifts.length === 0 ? (
        <p className="cal-agenda__empty">{emptyHint ?? "No shifts are planned for this day."}</p>
      ) : (
        <ul>
          {shifts.map((shift) => {
            const duty = mine ? shift.crew.find((member) => member.name === mine)?.duty ?? (shift.supervisor === mine ? "Supervisor" : null) : null;
            return (
              <li key={shift.id}>
                <Link href={`/shifts/${shift.id}`} className={`cal-item cal-item--${shift.state}`}>
                  <span className="cal-item__time">
                    <strong>{shiftTimes(shift).slice(0, 5)}</strong>
                    <small>{endsNextDay(shift) ? <><Moon aria-hidden="true" /> to {shiftTimes(shift).slice(6)} next day</> : `to ${shiftTimes(shift).slice(6)}`}</small>
                  </span>
                  <span className="cal-item__body">
                    <strong>{shift.name}</strong>
                    <small>
                      {shift.supervisor ?? "No supervisor yet"} · <UsersRound aria-hidden="true" /> {shift.crew.length}
                      {duty ? ` · You: ${duty}` : ""}
                    </small>
                  </span>
                  <StatusBadge value={shiftTone[shift.state]} label={shiftStateLabels[shift.state]} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WeekView({ week, selected, today, byDay, onSelect }: { week: string; selected: string; today: string; byDay: Map<string, ShiftView[]>; onSelect: (day: string) => void }) {
  return (
    <div className="cal-week" role="group" aria-label={weekLabel(week)}>
      {weekDays(week).map((day) => {
        const shifts = byDay.get(day) ?? [];
        return (
          <div key={day} className={`cal-week__day ${day === today ? "cal__day--today" : ""} ${day === selected ? "cal__day--selected" : ""}`}>
            <button type="button" className="cal-week__head" aria-pressed={day === selected} onClick={() => onSelect(day)}>
              <span>{weekdayLabel(day)}</span>
              <strong>{dayNumber(day)}</strong>
            </button>
            {shifts.length === 0 ? <p className="cal-week__empty">No shifts</p> : (
              <ul>
                {shifts.map((shift) => (
                  <li key={shift.id}>
                    <Link href={`/shifts/${shift.id}`} className={`cal__chip cal__chip--${shift.state} cal__chip--block`}>
                      <b>{shiftTimes(shift)}</b>
                      <span>{shift.name}</span>
                      <small>{shift.supervisor ?? "No supervisor"} · {shift.crew.length} crew</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type CalendarView = "month" | "week" | "day";

/** The view, the chosen day and the movement between them, shared by the web and mobile calendars. */
export function useCalendar(today: string) {
  const [view, setView] = useState<CalendarView>("month");
  const [selected, setSelected] = useState(today);
  const move = (direction: 1 | -1) => {
    if (view === "day") return setSelected(addDays(selected, direction));
    if (view === "week") return setSelected(addDays(selected, direction * 7));
    const target = addMonths(selected, direction);
    setSelected(isSameMonth(today, target) ? today : target);
  };
  const title = view === "month" ? monthLabel(selected) : view === "week" ? weekLabel(selected) : dayLabel(selected);
  return { view, setView, selected, setSelected, move, title, today };
}

const viewNames: Record<CalendarView, string> = { month: "Month", week: "Week", day: "Day" };

/** Previous and next, the range title, Today, and the Month / Week / Day switch. */
export function CalendarToolbar({ calendar }: { calendar: ReturnType<typeof useCalendar> }) {
  const { view, setView, selected, setSelected, move, title, today } = calendar;
  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar__nav">
        <button type="button" className="icon-button icon-button--light" aria-label={`Previous ${view}`} onClick={() => move(-1)}><ChevronLeft /></button>
        <h2 aria-live="polite">{title}</h2>
        <button type="button" className="icon-button icon-button--light" aria-label={`Next ${view}`} onClick={() => move(1)}><ChevronRight /></button>
      </div>
      <div className="cal-toolbar__tools">
        <button type="button" className="button button--quiet button--small" onClick={() => setSelected(today)} disabled={selected === today}>Today</button>
        <div className="segmented" role="group" aria-label="Calendar range">
          {(Object.keys(viewNames) as CalendarView[]).map((name) => (
            <button key={name} type="button" className={view === name ? "active" : ""} aria-pressed={view === name} onClick={() => setView(name)}>{viewNames[name]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Seven days in a row, for small screens. */
export function WeekStrip({ week, selected, today, byDay, onSelect }: { week: string; selected: string; today: string; byDay: Map<string, ShiftView[]>; onSelect: (day: string) => void }) {
  return (
    <div className="cal-strip" role="group" aria-label={weekLabel(week)}>
      {weekDays(week).map((day) => {
        const shifts = byDay.get(day) ?? [];
        return (
          <button
            key={day}
            type="button"
            className={`cal-strip__day ${day === today ? "cal__day--today" : ""} ${day === selected ? "cal__day--selected" : ""}`}
            aria-pressed={day === selected}
            aria-label={`${dayLabel(day)}${day === today ? ", today" : ""}, ${shifts.length === 0 ? "no shifts" : shiftCount(shifts.length)}`}
            onClick={() => onSelect(day)}
          >
            <span>{weekdayLabel(day)}</span>
            <strong>{dayNumber(day)}</strong>
            <span className="cal__dots" aria-hidden="true">{shifts.slice(0, 3).map((shift) => <i key={shift.id} className={`cal__dot cal__dot--${shift.state}`} />)}</span>
          </button>
        );
      })}
    </div>
  );
}

const hours = Array.from({ length: 24 }, (_, hour) => hour);

/** One day laid out hour by hour, with every shift running on it and a marker for the current time. */
export function DayTimeline({ day, shifts, now, mine }: { day: string; shifts: ShiftView[]; now: string; mine?: string }) {
  const running = shiftsOnDay(shifts, day);
  const marker = dayPosition(now, day);
  // The current-time pill sits over the nearest hour label when the two are close, so that label steps aside.
  const nearest = marker === null ? -1 : Math.round((marker / 100) * 24);
  const crowded = marker !== null && Math.abs((marker / 100) * 24 - nearest) < 0.45;
  return (
    <div className="cal-day" aria-label={`Timeline for ${dayLabel(day)}`}>
      <ol className="cal-day__hours" aria-hidden="true">{hours.map((hour) => <li key={hour}><span style={crowded && hour === nearest ? { visibility: "hidden" } : undefined}>{String(hour).padStart(2, "0")}:00</span></li>)}</ol>
      <div className="cal-day__lane">
        {running.map((shift) => {
          const block = dayBlock(shift, day);
          const duty = mine ? shift.crew.find((member) => member.name === mine)?.duty ?? (shift.supervisor === mine ? "Supervisor" : null) : null;
          return (
            <Link
              key={shift.id}
              href={`/shifts/${shift.id}`}
              className={`cal-day__shift cal-item--${shift.state}`}
              style={{ top: `${block.top}%`, height: `${block.height}%` }}
              aria-label={`${shift.name}, ${shiftTimes(shift)}, ${shiftStateLabels[shift.state]}`}
            >
              <span className="cal-day__shift-head">
                <strong>{shift.name}</strong>
                <StatusBadge value={shiftTone[shift.state]} label={shiftStateLabels[shift.state]} />
              </span>
              <span>{shiftTimes(shift)}{block.continuesFromPrevious ? " · started the day before" : ""}{block.continuesToNext ? " · carries on tomorrow" : ""}</span>
              <small>{shift.supervisor ?? "No supervisor yet"} · {shift.crew.length} crew{duty ? ` · You: ${duty}` : ""}</small>
            </Link>
          );
        })}
        {marker !== null ? <div className="cal-day__now" style={{ top: `${marker}%` }}><span>{formatDemoTime(now)}</span></div> : null}
      </div>
    </div>
  );
}

/** The Shift Control calendar: a month, a week or a day, with the selected day's shifts beneath. */
export function ShiftCalendar({ shifts, now, onCreate }: { shifts: ShiftView[]; now: string; onCreate: ((day: string) => void) | null }) {
  const calendar = useCalendar(siteDate(now));
  const { view, selected, setSelected, today } = calendar;
  const byDay = useMemo(() => shiftsByDay(shifts), [shifts]);
  const create = onCreate ? <button type="button" className="button button--quiet button--small" onClick={() => onCreate(selected)}><CalendarPlus /> Create shift on this day</button> : null;
  const running = shiftsOnDay(shifts, selected).length;

  return (
    <section className="card cal-card">
      <CalendarToolbar calendar={calendar} />

      {view === "month" ? (
        <>
          <div className="cal-full"><MonthGrid month={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} /></div>
          <div className="cal-small"><MonthGrid month={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} compact /></div>
        </>
      ) : null}
      {view === "week" ? (
        <>
          <div className="cal-full"><WeekView week={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} /></div>
          <div className="cal-small"><WeekStrip week={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} /></div>
        </>
      ) : null}

      {view === "day" ? (
        <section className="cal-agenda" aria-label={`Shifts on ${dayLabel(selected)}`}>
          <header>
            <p>{running === 0 ? "Nothing planned" : shiftCount(running)}</p>
            {create}
          </header>
          <DayTimeline day={selected} shifts={shifts} now={now} />
        </section>
      ) : (
        <DayAgenda day={selected} shifts={byDay.get(selected) ?? []} action={create} />
      )}
    </section>
  );
}
