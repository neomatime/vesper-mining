// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * VESPER's geometry is softly rounded from one small scale: 4 / 6 / 8 / 12 px (and 20 px for the sign-in card), set once as variables and assigned
 * by role. Circles stay for the shapes where roundness carries meaning: status dots, progress nodes and rings,
 * the spinner, the notification dot, the task check, avatars, and decorative glows.
 */
const ROUND = [
  ".status-badge__dot", ".notification-dot", ".context-pills__freshness", ".demo-pill > span", ".demo-launcher__label span",
  ".priority::before", ".cal__dot", ".lifecycle__dot", ".progress-orbit", ".spinner", ".brand-loader__halo", 
  "::-webkit-scrollbar-thumb", ".check", ".action-row__marker", ".recovery-step >", ".stage-timeline", ".timeline-card li", ".avatar",
];

const app = join(__dirname, "..", "app");
const sheets = ["globals.css", "theme.css", "typography.css", "chrome.css", "login.css", "allocation.css", "dark.css"];

/** Every border-radius declaration with its selector, ignoring comments. */
function radii() {
  const found: { sheet: string; selector: string; value: string }[] = [];
  for (const sheet of sheets) {
    const css = readFileSync(join(app, sheet), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = (rule[1] ?? "").split(/\s+/).join(" ").trim();
      for (const decl of (rule[2] ?? "").matchAll(/(?<![\w-])border-radius:\s*([^;]+)/g)) found.push({ sheet, selector, value: (decl[1] ?? "").trim() });
    }
  }
  return found;
}

const isRound = (selector: string) => selector.split(",").every((part) => ROUND.some((token) => part.includes(token)));
const onScale = (value: string) => value.split(/\s+/).every((part) => /^(0|var\(--radius-(xs|sm|md|lg|xl)\)|[0-2]px)$/.test(part));

describe("soft geometry, checked in the stylesheets", () => {
  it("takes every corner from the radius scale, except the shapes where roundness means something", () => {
    const offenders = radii()
      .filter(({ selector, value }) => !isRound(selector) && !onScale(value))
      .map(({ sheet, selector, value }) => `${sheet}: ${selector.slice(0, 60)} { border-radius: ${value} }`);
    expect(offenders).toEqual([]);
  });

  it("leaves the round shapes round, so a status dot is still a dot", () => {
    const dots = radii().filter(({ selector }) => selector === ".status-badge__dot");
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) expect(dot.value, dot.sheet).toMatch(/^(50%|999px)$/);
  });

  it("defines the radius scale once, as 4, 6, 8, 12 and 20 px", () => {
    const css = readFileSync(join(app, "theme.css"), "utf8");
    expect(css).toMatch(/:root \{ --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 20px; \}/);
  });
});
