import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders a non-colour status label", () => {
    render(<StatusBadge value="at_risk" />);
    expect(screen.getByText("At Risk")).toBeVisible();
  });

  it("supports a qualified display label", () => {
    render(<StatusBadge value="unknown" label="Requires confirmation" />);
    expect(screen.getByText("Requires confirmation")).toBeVisible();
  });
});
