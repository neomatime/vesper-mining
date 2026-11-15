// @vitest-environment node

/**
 * Unit tests (Vitest). The web app manifest meets what browsers require before they offer to install VESPER.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const publicDir = join(__dirname, "..", "..", "public");
const result = manifest();

/** Width and height from a PNG's header, so the test needs no image library. */
const pngSize = (file: string) => {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe("web app manifest", () => {
  it("names the app and opens it in its own window", () => {
    expect(result.name).toMatch(/VESPER/);
    expect(result.short_name).toBe("VESPER");
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
  });

  it("offers 192 and 512 pixel icons that exist and are the size they claim", () => {
    const icons = result.icons ?? [];
    for (const size of [192, 512]) {
      expect(icons.some((icon) => icon.sizes === `${size}x${size}` && icon.purpose === "any"), `${size}`).toBe(true);
    }
    for (const icon of icons) {
      const file = join(publicDir, String(icon.src));
      expect(existsSync(file), String(icon.src)).toBe(true);
      const [width, height] = String(icon.sizes).split("x").map(Number);
      expect(pngSize(file)).toEqual({ width, height });
    }
  });

  it("has a maskable icon for phones that crop icons", () => {
    expect((result.icons ?? []).some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
