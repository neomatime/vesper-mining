// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = join(__dirname, "..", "app");
const read = (name: string) => readFileSync(join(app, name), "utf8");
const stylesheets = ["globals.css", "theme.css", "typography.css", "chrome.css", "dark.css"];

describe("the type system's rules, checked in the stylesheets", () => {
  it("never asks for a font weight above 500, so the interface stays light", () => {
    for (const name of stylesheets) {
      const weights = [...read(name).matchAll(/font-weight:\s*(\d{3})\b/g)].map((match) => Number(match[1]));
      // The font-face range (100 900) in typography.css is the file's capability, not a weight used on the page.
      const used = name === "typography.css" ? weights.filter((weight) => weight !== 100 && weight !== 900) : weights;
      expect(used.filter((weight) => ![300, 400, 450, 500].includes(weight)), name).toEqual([]);
    }
  });

  it("keeps the weight scale light: 300, 400, 450 and 500, set once", () => {
    const css = read("typography.css");
    expect(css).toMatch(/--weight-light: 300;\s*--weight-regular: 400;\s*--weight-medium: 450;\s*--weight-strong: 500;/);
    for (const name of ["globals.css", "theme.css", "dark.css", "chrome.css"]) expect(read(name), name).not.toMatch(/font-weight:\s*[6-9]\d\d/);
  });

  it("uses Inter, and no other typeface is declared anywhere", () => {
    const css = stylesheets.map(read).join("\n");
    expect(css).toContain('font-family: "Inter"');
    expect(css).not.toMatch(/Plus Jakarta|Aptos|Segoe UI Variable|Georgia|Times New Roman|Playfair|Fraunces/i);
    const declared = [...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(declared.sort()).toEqual(["Inter", "Inter Fallback"]);
  });

  it("serves the font from the product's own domain", () => {
    expect(existsSync(join(__dirname, "..", "..", "public", "fonts", "Inter-Variable-latin.woff2"))).toBe(true);
    expect(existsSync(join(__dirname, "..", "..", "public", "fonts", "Inter-LICENSE.txt"))).toBe(true);
    const css = read("typography.css");
    expect(css).toMatch(/url\("\/fonts\/Inter-Variable-latin\.woff2"\)/);
    expect(css).not.toMatch(/https?:\/\//);
    expect(readFileSync(join(app, "layout.tsx"), "utf8")).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it("gives numbers shared digit widths wherever people compare them", () => {
    const css = read("typography.css");
    for (const selector of [".kpi strong", ".figure-tile strong", ".data-table td", ".cal__number"]) expect(css, selector).toContain(selector);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it("replaces the browser's own bold, which is 700", () => {
    expect(read("typography.css")).toMatch(/strong, b, th, dt, h1, h2, h3, h4, h5, h6, legend \{ font-weight: var\(--weight-strong\); \}/);
  });
});
