/**
 * Unit tests (Vitest). The CSV used by the Download buttons: values with commas, quotes and line breaks are quoted.
 */
import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes plain values as they are and empty values as nothing", () => {
    expect(toCsv([["Shipment", "Amount"], ["SHP-0048", 300], ["SHP-0049", null]])).toBe("Shipment,Amount\r\nSHP-0048,300\r\nSHP-0049,");
  });

  it("quotes values a spreadsheet would otherwise split, and doubles quotation marks inside them", () => {
    expect(toCsv([["Richards Bay, Terminal", 'He said "ok"', "two\nlines"]])).toBe('"Richards Bay, Terminal","He said ""ok""","two\nlines"');
  });
});
