"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, readThemeChoice, setThemeChoice, subscribeThemeChoice, themeChoices, type ThemeChoice } from "@/lib/theme";

const icons = { light: Sun, dark: Moon, system: Monitor } as const;

/** Light, Dark, or follow the device. When following the device, the page changes with the device's own setting. */
export function ThemeSwitch() {
  const choice = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, (): ThemeChoice => "system");

  useEffect(() => {
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [choice]);

  return (
    <div className="theme-switch" role="group" aria-label="Appearance">
      <span className="theme-switch__label">Appearance</span>
      <div className="segmented">
        {themeChoices.map((option) => {
          const Icon = icons[option.value];
          return (
            <button key={option.value} type="button" className={choice === option.value ? "active" : ""} aria-pressed={choice === option.value} onClick={() => setThemeChoice(option.value)}>
              <Icon aria-hidden="true" /> {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
