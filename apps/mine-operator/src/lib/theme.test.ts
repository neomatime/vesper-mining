// @vitest-environment node
import { describe, expect, it } from "vitest";
import { THEME_KEY, isThemeChoice, resolveTheme, themeInitScript } from "./theme";

/** Runs the head script against a fake page and reports the theme it sets. */
function runInitScript({ stored, deviceDark, storageThrows = false }: { stored?: string | null; deviceDark: boolean; storageThrows?: boolean }) {
  const documentElement = { dataset: {} as Record<string, string> };
  const window = {
    localStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error("blocked");
        return key === THEME_KEY ? (stored ?? null) : null;
      },
    },
    matchMedia: () => ({ matches: deviceDark }),
  };
  new Function("window", "localStorage", "document", themeInitScript)(window, window.localStorage, { documentElement });
  return documentElement.dataset.theme;
}

describe("choosing a theme", () => {
  it("knows the three choices", () => {
    expect(["light", "dark", "system"].every(isThemeChoice)).toBe(true);
    expect(isThemeChoice("blue")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });

  it("follows the device only when asked to", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("the script that runs before the page is drawn", () => {
  it("agrees with the rest of the app for every choice and device setting", () => {
    for (const choice of ["light", "dark", "system"] as const) {
      for (const deviceDark of [true, false]) {
        expect(runInitScript({ stored: choice, deviceDark }), `${choice} / device dark: ${deviceDark}`).toBe(resolveTheme(choice, deviceDark));
      }
    }
  });

  it("follows the device when nothing is stored or the stored value is not one of ours", () => {
    expect(runInitScript({ stored: null, deviceDark: true })).toBe("dark");
    expect(runInitScript({ stored: "purple", deviceDark: false })).toBe("light");
  });

  it("falls back to light when storage is blocked", () => {
    expect(runInitScript({ deviceDark: true, storageThrows: true })).toBe("light");
  });
});
