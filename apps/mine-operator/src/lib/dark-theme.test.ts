// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fromHsl, generateDarkTheme, mapBackground, mapBorder, mapText, parseColor, parseCss, toHsl } from "../../scripts/dark-theme.mjs";

const color = (token: string) => {
  const parsed = parseColor(token);
  if (!parsed) throw new Error(`Not a colour: ${token}`);
  return parsed;
};
const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const f = (v: number) => ((v / 255) <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("colour mapping for the dark theme", () => {
  it("reads hex and rgba colours", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#16865B")).toEqual({ r: 22, g: 134, b: 91, a: 1 });
    expect(parseColor("rgba(16, 24, 22, 0.05)")).toEqual({ r: 16, g: 24, b: 22, a: 0.05 });
    expect(parseColor("transparent")).toBeNull();
  });

  it("round-trips through HSL", () => {
    const original = color("#e2f3ea");
    const back = fromHsl(toHsl(original));
    expect(Math.abs(back.r - original.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.g - original.g)).toBeLessThanOrEqual(1);
  });

  it("turns light backgrounds into dark surfaces and leaves the rest alone", () => {
    expect(luminance(mapBackground(color("#ffffff")))).toBeLessThan(0.03);
    expect(luminance(mapBackground(color("#eef2f0")))).toBeLessThan(0.05);
    expect(mapBackground(color("#16865b"))).toEqual(color("#16865b")); // brand emerald is a mid tone
    expect(mapBackground(color("#0d1411"))).toEqual(color("#0d1411")); // already dark
    expect(mapBackground(color("rgba(255, 255, 255, 0.09)"))).toEqual(color("rgba(255, 255, 255, 0.09)")); // a highlight on a dark bar
  });

  it("keeps near-white greys neutral instead of tinting them", () => {
    const { r, g, b } = mapBackground(color("#fbfbf9"));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(14);
  });

  it("keeps a tinted background in its own hue", () => {
    const mint = toHsl(mapBackground(color("#e2f3ea")));
    expect(mint.h).toBeGreaterThan(130);
    expect(mint.h).toBeLessThan(170);
    expect(mint.l).toBeLessThan(0.25);
  });

  it("turns dark text light enough to read on a dark surface, and leaves white text alone", () => {
    const surface = mapBackground(color("#ffffff"));
    for (const token of ["#101816", "#5a6761", "#0a6e47", "#a32d2a"]) {
      expect(contrast(mapText(color(token)), surface), token).toBeGreaterThanOrEqual(4.5);
    }
    expect(mapText(color("#ffffff"))).toEqual(color("#ffffff"));
  });

  it("turns light borders into dark ones that still show against the surface", () => {
    const surface = mapBackground(color("#ffffff"));
    const border = mapBorder(color("#dde3df"));
    expect(luminance(border)).toBeLessThan(0.05);
    expect(contrast(border, surface)).toBeGreaterThan(1.1);
  });
});

describe("reading the stylesheet", () => {
  it("reads rules, nested media queries and values that contain semicolons", () => {
    const nodes = parseCss(`
      /* a comment { with a brace } */
      .a { color: #fff; background: url("data:image/svg+xml;utf8,<svg a='1'></svg>") center; }
      @keyframes spin { from { opacity: 0; } to { opacity: 1; } }
      @media (max-width: 600px) { .b:hover { border-color: #ddd; } }
    `);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ type: "rule", selector: ".a" });
    expect(nodes[0]?.type === "rule" ? nodes[0].decls.map((item) => item.prop) : []).toEqual(["color", "background"]);
    expect(nodes[1]).toMatchObject({ type: "at", name: "media", params: "(max-width: 600px)" });
  });
});

describe("the generated dark stylesheet", () => {
  const css = generateDarkTheme([
    ".card { background: #fff; color: #101816; border: 1px solid #dde3df; padding: 4px; }" +
      " .status-badge--warning { background: var(--soft); } .status-badge--warning.flat { background: transparent; }" +
      " .topbar { background: #0d1411; } .hero-card { color: #fff; }" +
      " @media (max-width: 700px) { .card { border-color: #e7ece8; } }",
  ]);

  it("scopes every rule to the dark theme", () => {
    expect(css).toContain(':root[data-theme="dark"] .card');
    expect(css.match(/^[^\s@/}][^{]*\{/gm)?.every((line) => line.startsWith(':root[data-theme="dark"]'))).toBe(true);
  });

  it("maps colours and leaves non-colour declarations out", () => {
    expect(css).not.toContain("padding");
    expect(css).not.toMatch(/background: #ffffff/);
  });

  it("skips surfaces that are already dark", () => {
    expect(css).not.toContain(".topbar");
    expect(css).not.toContain(".hero-card");
  });

  it("repeats a colour declaration that is not a colour so a later override still wins", () => {
    expect(css).toMatch(/\.status-badge--warning\.flat\s*\{\s*background: transparent;/);
  });

  it("keeps media queries around the rules inside them", () => {
    expect(css).toMatch(/@media \(max-width: 700px\) \{[\s\S]*:root\[data-theme="dark"\] \.card[\s\S]*border-color/);
  });
});

describe("the committed dark stylesheet", () => {
  it("is up to date with globals.css and theme.css (run: node scripts/generate-dark-theme.mjs)", () => {
    const read = (name: string) => readFileSync(join(__dirname, "..", "app", name), "utf8").replace(/\r\n/g, "\n");
    expect(read("dark.generated.css")).toBe(generateDarkTheme([read("globals.css"), read("theme.css")]));
  });
});
