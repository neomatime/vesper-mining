import { describe, expect, it } from "vitest";
import { statusFamily, statusTone } from "./status-system";

describe("status system", () => {
  it("puts finished, running and not-started work in three different families", () => {
    expect(statusFamily("complete")).toBe("done");
    expect(statusFamily("in_progress")).toBe("active");
    expect(statusFamily("scheduled")).toBe("waiting");
    expect(statusFamily("pending")).toBe("waiting");
  });

  it("keeps reported information apart from operational risk", () => {
    expect(statusFamily("reported")).toBe("reported");
    expect(statusFamily("at_risk")).toBe("attention");
    expect(statusFamily("blocked")).toBe("critical");
    expect(statusFamily("verified")).toBe("done");
  });

  it("never guesses: an unlisted value is unknown", () => {
    expect(statusFamily("something_new")).toBe("unknown");
    expect(statusFamily("external")).toBe("unknown");
  });

  it("gives no two meanings the same family across the states people see most", () => {
    const seen = ["complete", "in_progress", "scheduled", "at_risk", "blocked", "reported", "unknown"].map(statusFamily);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("maps families onto the older tones", () => {
    expect(statusTone("done")).toBe("positive");
    expect(statusTone("critical")).toBe("danger");
    expect(statusTone("attention")).toBe("warning");
    expect(statusTone("waiting")).toBe("neutral");
  });
});
