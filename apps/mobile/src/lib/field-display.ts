/**
 * Display settings for working on site, kept on this phone: gloves mode (bigger buttons and text, more space between targets)
 * and sunlight mode (higher contrast). They are set on <html> as data-gloves and data-contrast, before the first paint by
 * fieldDisplayInitScript (field-display-script.ts), and changed from the Profile tab.
 */
import { useSyncExternalStore } from "react";
import { FIELD_DISPLAY_KEY as KEY } from "./field-display-script";

export type FieldDisplay = { gloves: boolean; sunlight: boolean };

const DEFAULT: FieldDisplay = { gloves: false, sunlight: false };
const listeners = new Set<() => void>();
let cached: FieldDisplay | null = null;

function read(): FieldDisplay {
  if (cached) return cached;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<FieldDisplay>;
    cached = { gloves: stored.gloves === true, sunlight: stored.sunlight === true };
  } catch {
    cached = DEFAULT;
  }
  return cached;
}

function apply(display: FieldDisplay) {
  const root = document.documentElement;
  if (display.gloves) root.dataset.gloves = "on";
  else delete root.dataset.gloves;
  if (display.sunlight) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
}

export function setFieldDisplay(change: Partial<FieldDisplay>) {
  const next = { ...read(), ...change };
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable; the setting still applies until the page is closed.
  }
  apply(next);
  listeners.forEach((listener) => listener());
}

export function useFieldDisplay(): FieldDisplay {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    read,
    () => DEFAULT,
  );
}
