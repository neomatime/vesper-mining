"use client";

import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock3 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { DEMO_NOW } from "@/lib/demo-data";
import { FloatingPanel } from "./floating-panel";

// ---- Helpers ---------------------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Today at the site. The product runs on the site's own clock, not the visitor's. */
const today = () => DEMO_NOW.slice(0, 10);

const pad = (value: number) => String(value).padStart(2, "0");
const toIso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

function parseIso(value: string) {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month && check.getUTCDate() === day ? { year, month, day } : null;
}

/** Accepts the ways people type a date and turns them into yyyy-mm-dd. Anything else is left for the form to flag. */
function normaliseDate(raw: string) {
  const text = raw.trim();
  if (!text) return "";
  let match = /^(\d{4})[/.\-\s](\d{1,2})[/.\-\s](\d{1,2})$/.exec(text);
  if (match) return toIso(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(text);
  if (match) return toIso(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return text;
}

function normaliseTime(raw: string) {
  const text = raw.trim();
  if (!text) return "";
  const match = /^(\d{1,2})[:.h]?(\d{2})$/.exec(text) ?? /^(\d{1,2})$/.exec(text);
  if (!match) return text;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours > 23 || minutes > 59 ? text : `${pad(hours)}:${pad(minutes)}`;
}

const monthName = (year: number, month: number) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
const dayName = (year: number, month: number, day: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, day)));
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Sets a value the way a person typing would, so react-hook-form and React both notice. */
function writeValue(element: HTMLInputElement | null, value: string) {
  if (!element) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Keeps a local handle on the input and also hands it to the form (react-hook-form) that registered it. */
function useInputRef(forwarded: React.ForwardedRef<HTMLInputElement>) {
  const local = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwarded, () => local.current as HTMLInputElement);
  return local;
}

// ---- Calendar --------------------------------------------------------------------------------------

function Calendar({ getValue, onPick, onClear, onClose }: { getValue: () => string; onPick: (iso: string) => void; onClear: () => void; onClose: () => void }) {
  const [value] = useState(getValue);
  const initial = parseIso(value) ?? parseIso(today())!;
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [focus, setFocus] = useState(toIso(initial.year, initial.month, initial.day));
  const grid = useRef<HTMLDivElement>(null);
  const todayIso = today();

  const first = new Date(Date.UTC(view.year, view.month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(view.year, view.month, 1 - offset + index));
    return { iso: toIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), day: date.getUTCDate(), outside: date.getUTCMonth() !== view.month, year: date.getUTCFullYear(), month: date.getUTCMonth() };
  });

  const shift = (months: number) => setView((current) => {
    const total = current.year * 12 + current.month + months;
    return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
  });

  // The panel is placed a moment after it mounts, so wait a frame before moving focus into it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focus, view]);

  const moveFocus = (days: number) => {
    const current = parseIso(focus)!;
    const next = new Date(Date.UTC(current.year, current.month, current.day + days));
    const iso = toIso(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
    setFocus(iso);
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  const onKey = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) {
      event.preventDefault();
      moveFocus(steps[event.key]);
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      const direction = event.key === "PageDown" ? 1 : -1;
      const current = parseIso(focus)!;
      const total = current.year * 12 + current.month + direction;
      const year = Math.floor(total / 12);
      const month = ((total % 12) + 12) % 12;
      const day = Math.min(current.day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
      setFocus(toIso(year, month, day));
      setView({ year, month });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(focus);
    } else if (event.key === "Tab") {
      onClose();
    }
  };

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button type="button" className="calendar__nav" aria-label="Previous year" onClick={() => shift(-12)}><ChevronsLeft aria-hidden="true" /></button>
        <button type="button" className="calendar__nav" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft aria-hidden="true" /></button>
        <strong className="calendar__title" aria-live="polite">{monthName(view.year, view.month)}</strong>
        <button type="button" className="calendar__nav" aria-label="Next month" onClick={() => shift(1)}><ChevronRight aria-hidden="true" /></button>
        <button type="button" className="calendar__nav" aria-label="Next year" onClick={() => shift(12)}><ChevronsRight aria-hidden="true" /></button>
      </div>
      <div className="calendar__weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar__grid" role="group" aria-label={monthName(view.year, view.month)} ref={grid} onKeyDown={onKey}>
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            data-date={cell.iso}
            tabIndex={cell.iso === focus ? 0 : -1}
            aria-label={dayName(cell.year, cell.month, cell.day)}
            aria-pressed={cell.iso === value}
            className={`calendar__day ${cell.outside ? "calendar__day--outside" : ""} ${cell.iso === todayIso ? "calendar__day--today" : ""} ${cell.iso === value ? "calendar__day--selected" : ""}`}
            onClick={() => onPick(cell.iso)}
          >
            {cell.day}
          </button>
        ))}
      </div>
      <div className="calendar__foot">
        <button type="button" className="calendar__link" onClick={() => onPick(todayIso)}>Today</button>
        <button type="button" className="calendar__link" onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}

// ---- Time list -------------------------------------------------------------------------------------

const SLOTS = Array.from({ length: 96 }, (_, index) => `${pad(Math.floor(index / 4))}:${pad((index % 4) * 15)}`);

function TimeList({ getValue, onPick, onClose }: { getValue: () => string; onPick: (time: string) => void; onClose: () => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [value] = useState(getValue);
  const start = Math.max(0, SLOTS.findIndex((slot) => slot >= value));
  const [active, setActive] = useState(start);

  useEffect(() => {
    const frame = requestAnimationFrame(() => list.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "center" });
  }, [active]);

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(SLOTS.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === "PageDown") { event.preventDefault(); setActive((index) => Math.min(SLOTS.length - 1, index + 8)); }
    else if (event.key === "PageUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 8)); }
    else if (event.key === "Enter") { event.preventDefault(); onPick(SLOTS[active]); }
    else if (event.key === "Tab") onClose();
  };

  return (
    <div ref={list} className="time-list" role="listbox" aria-label="Choose a time" tabIndex={0} aria-activedescendant={`slot-${active}`} onKeyDown={onKey}>
      {SLOTS.map((slot, index) => (
        <div key={slot} id={`slot-${index}`} role="option" aria-selected={slot === value} data-index={index} className={`select__option ${index === active ? "select__option--active" : ""}`} onMouseMove={() => index !== active && setActive(index)} onClick={() => onPick(slot)}>
          <span>{slot}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Date -------------------------------------------------------------------------------------------

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & { "data-autofocus"?: boolean | string };

/** A date field: type it, or open the calendar. Always shows and stores yyyy-mm-dd. */
export const DateInput = forwardRef<HTMLInputElement, InputProps>(function DateInput({ className = "", disabled, onBlur, ...rest }, forwarded) {
  const input = useInputRef(forwarded);
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <span className={`date-field ${className}`} ref={anchor}>
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="yyyy-mm-dd"
        disabled={disabled}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" && event.altKey) || event.key === "F4") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onBlur={(event) => {
          const normalised = normaliseDate(event.target.value);
          if (normalised !== event.target.value) writeValue(event.target, normalised);
          onBlur?.(event);
        }}
        {...rest}
      />
      <button type="button" className="date-field__button" aria-label="Open calendar" disabled={disabled} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <CalendarDays aria-hidden="true" />
      </button>
      <FloatingPanel anchor={anchor} open={open} onClose={close} role="dialog" label="Choose a date" className="calendar-panel">
        <Calendar
          getValue={() => normaliseDate(input.current?.value ?? "")}
          onPick={(iso) => {
            writeValue(input.current, iso);
            close();
            input.current?.focus();
          }}
          onClear={() => {
            writeValue(input.current, "");
            close();
            input.current?.focus();
          }}
          onClose={close}
        />
      </FloatingPanel>
    </span>
  );
});

// ---- Time -------------------------------------------------------------------------------------------

/** A time field: type it, or pick from the list. Always shows and stores hh:mm, 24-hour. */
export const TimeInput = forwardRef<HTMLInputElement, InputProps>(function TimeInput({ className = "", disabled, onBlur, ...rest }, forwarded) {
  const input = useInputRef(forwarded);
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <span className={`date-field ${className}`} ref={anchor}>
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        disabled={disabled}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" && event.altKey) || event.key === "F4") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onBlur={(event) => {
          const normalised = normaliseTime(event.target.value);
          if (normalised !== event.target.value) writeValue(event.target, normalised);
          onBlur?.(event);
        }}
        {...rest}
      />
      <button type="button" className="date-field__button" aria-label="Open times" disabled={disabled} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Clock3 aria-hidden="true" />
      </button>
      <FloatingPanel anchor={anchor} open={open} onClose={close} matchWidth minWidth={150} className="select__panel">
        <TimeList
          getValue={() => normaliseTime(input.current?.value ?? "")}
          onPick={(slot) => {
            writeValue(input.current, slot);
            close();
            input.current?.focus();
          }}
          onClose={close}
        />
      </FloatingPanel>
    </span>
  );
});

// ---- Date and time ---------------------------------------------------------------------------------

/**
 * A date and a time side by side. The form still receives one value, yyyy-mm-ddThh:mm, exactly as a
 * native date-time field would give it.
 */
export const DateTimeInput = forwardRef<HTMLInputElement, InputProps>(function DateTimeInput({ className = "", disabled, "aria-invalid": invalid, "data-autofocus": autofocus, ...rest }, forwarded) {
  const carrier = useInputRef(forwarded);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Take the starting value from the form once. After that, what the person types is the source.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const [d = "", t = ""] = (carrier.current?.value ?? "").split("T");
      setDate(d);
      setTime(t.slice(0, 5));
    });
    return () => cancelAnimationFrame(frame);
  }, [carrier]);

  const publish = (nextDate: string, nextTime: string) => {
    const dateOk = Boolean(parseIso(nextDate));
    const timeOk = TIME.test(nextTime);
    writeValue(carrier.current, dateOk && (timeOk || nextTime === "") ? `${nextDate}T${timeOk ? nextTime : "00:00"}` : "");
  };

  return (
    <span className={`datetime-field ${className}`}>
      <DateInput
        ref={dateRef}
        disabled={disabled}
        aria-invalid={invalid}
        data-autofocus={autofocus}
        value={date}
        onChange={(event) => {
          setDate(event.target.value);
          publish(normaliseDate(event.target.value), time);
        }}
        onBlur={(event) => {
          const next = normaliseDate(event.target.value);
          setDate(next);
          publish(next, time);
        }}
      />
      <TimeInput
        ref={timeRef}
        aria-label="Time (24-hour)"
        disabled={disabled}
        aria-invalid={invalid}
        value={time}
        onChange={(event) => {
          setTime(event.target.value);
          publish(normaliseDate(date), normaliseTime(event.target.value));
        }}
        onBlur={(event) => {
          const next = normaliseTime(event.target.value);
          setTime(next);
          publish(normaliseDate(date), next);
        }}
      />
      <input ref={carrier} type="text" className="visually-hidden" tabIndex={-1} aria-hidden="true" disabled={disabled} {...rest} />
    </span>
  );
});
