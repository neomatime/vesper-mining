"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Moon, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { shiftTimes } from "@/lib/shift-format";
import {
  addDays,
  addMonths,
  dayLabel,
  dayNumber,
  endsNextDay,
  isSameMonth,
  monthGrid,
  monthLabel,
  shiftsByDay,
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

/** The Shift Control calendar: a month or a week, with the selected day's shifts listed beneath. */
export function ShiftCalendar({ shifts, now, onCreate }: { shifts: ShiftView[]; now: string; onCreate: ((day: string) => void) | null }) {
  const today = siteDate(now);
  const [view, setView] = useState<"month" | "week">("month");
  const [selected, setSelected] = useState(today);
  const byDay = useMemo(() => shiftsByDay(shifts), [shifts]);

  const move = (direction: 1 | -1) => {
    if (view === "week") return setSelected(addDays(selected, direction * 7));
    const target = addMonths(selected, direction);
    setSelected(isSameMonth(today, target) ? today : target);
  };
  const title = view === "month" ? monthLabel(selected) : weekLabel(selected);

  return (
    <section className="card cal-card">
      <div className="cal-toolbar">
        <div className="cal-toolbar__nav">
          <button type="button" className="icon-button icon-button--light" aria-label={view === "month" ? "Previous month" : "Previous week"} onClick={() => move(-1)}><ChevronLeft /></button>
          <h2 aria-live="polite">{title}</h2>
          <button type="button" className="icon-button icon-button--light" aria-label={view === "month" ? "Next month" : "Next week"} onClick={() => move(1)}><ChevronRight /></button>
        </div>
        <div className="cal-toolbar__tools">
          <button type="button" className="button button--quiet button--small" onClick={() => setSelected(today)} disabled={selected === today}>Today</button>
          <div className="segmented" role="group" aria-label="Calendar range">
            <button type="button" className={view === "month" ? "active" : ""} aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button>
            <button type="button" className={view === "week" ? "active" : ""} aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
          </div>
        </div>
      </div>

      {view === "month" ? (
        <>
          <div className="cal-full"><MonthGrid month={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} /></div>
          <div className="cal-small"><MonthGrid month={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} compact /></div>
        </>
      ) : (
        <WeekView week={selected} selected={selected} today={today} byDay={byDay} onSelect={setSelected} />
      )}

      <DayAgenda
        day={selected}
        shifts={byDay.get(selected) ?? []}
        action={onCreate ? <button type="button" className="button button--quiet button--small" onClick={() => onCreate(selected)}><CalendarPlus /> Create shift on this day</button> : null}
      />
    </section>
  );
}
