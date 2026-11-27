/**
 * Light, dark, or follow the device. The choice is remembered on this device, and the page shows the right theme from the
 * first paint: a tiny script in the page head reads the choice before anything is drawn, so there is no flash of light
 * when someone has chosen dark.
 */
export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_KEY = "vesper-theme";
export const themeChoices: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Device" },
];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(choice: ThemeChoice, deviceIsDark: boolean): Theme {
  return choice === "dark" || (choice === "system" && deviceIsDark) ? "dark" : "light";
}

/** The same logic as a string, run in the page head before first paint. Keep it in step with `resolveTheme`. */
export const themeInitScript = `(function(){try{var c=localStorage.getItem("${THEME_KEY}");if(c!=="light"&&c!=="dark")c="system";var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})();`;

const listeners = new Set<() => void>();

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Puts the theme on the page now. */
export function applyTheme(choice: ThemeChoice) {
  const dark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(choice, dark);
}

/** Remembers the choice on this device and applies it. */
export function setThemeChoice(choice: ThemeChoice) {
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private windows can refuse storage. The choice still applies until the page is closed.
  }
  applyTheme(choice);
  listeners.forEach((listener) => listener());
}

export function subscribeThemeChoice(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) {
      applyTheme(readThemeChoice());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
