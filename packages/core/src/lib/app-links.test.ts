// @vitest-environment node

/**
 * Unit tests (Vitest). Links between the two apps: each shared link becomes a page of the app showing it, or the other app's
 * address when the page lives there (hidden in a deployment that does not know that address).
 */
import { describe, expect, it } from "vitest";
import { linkFor } from "./app-links";

describe("links in VESPER Mobile", () => {
  it("keeps every field page and field record inside the app", () => {
    for (const path of ["/my-shift", "/my-work", "/report", "/my-reports", "/notifications", "/profile", "/schedule", "/checks/eq-ex204", "/issues/issue-riv-001"]) {
      expect(linkFor("mobile", path), path).toBe(path);
    }
  });

  it("turns web links into their phone pages", () => {
    expect(linkFor("mobile", "/exceptions/issue-riv-001")).toBe("/issues/issue-riv-001");
    expect(linkFor("mobile", "/exceptions/new")).toBe("/report");
    expect(linkFor("mobile", "/shifts")).toBe("/schedule");
    expect(linkFor("mobile", "/mobile/my-work")).toBe("/my-work");
  });

  it("does not point at the web app when it does not know its address", () => {
    expect(linkFor("mobile", "/overview")).toBeNull();
    expect(linkFor("operations", "/my-reports")).toBeNull();
    expect(linkFor("operations", "/exceptions/issue-riv-001")).toBe("/exceptions/issue-riv-001");
  });
});
