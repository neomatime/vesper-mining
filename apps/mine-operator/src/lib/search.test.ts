import { describe, expect, it } from "vitest";
import { rankRecords, type SearchRecord } from "./search";
import { initials } from "./personas";

const records: SearchRecord[] = [
  { id: "1", kind: "Issue", title: "Crusher C-02 — Feed Interruption", subtitle: "RIV-2025-041 · Crusher Line", href: "/exceptions/issue-riv-001" },
  { id: "2", kind: "Equipment", title: "Hydraulic Excavator EX-204", subtitle: "EX-204 · North Pit", href: "/equipment/eq-ex204" },
  { id: "3", kind: "Operating area", title: "North Pit", subtitle: "At Risk", href: "/map" },
  { id: "4", kind: "Equipment", title: "Track Dozer DZ-017", subtitle: "DZ-017 · Central Pit", href: "/equipment/eq-dz017" },
];

describe("rankRecords", () => {
  it("returns the first records when the query is empty", () => {
    expect(rankRecords("", records, 2)).toHaveLength(2);
  });

  it("matches codes inside subtitles", () => {
    expect(rankRecords("riv-2025-041", records).map((record) => record.id)).toEqual(["1"]);
  });

  it("requires every term to match", () => {
    expect(rankRecords("pit excavator", records).map((record) => record.id)).toEqual(["2"]);
    expect(rankRecords("pit zzz", records)).toEqual([]);
  });

  it("ranks title-prefix matches above incidental matches", () => {
    expect(rankRecords("north", records)[0].id).toBe("3");
  });

  it("ignores case and accents", () => {
    expect(rankRecords("CRUSHER", records)[0].id).toBe("1");
  });
});

describe("initials", () => {
  it("uses the first and last name", () => {
    expect(initials("John Dlamini")).toBe("JD");
    expect(initials("Naledi Khoza")).toBe("NK");
  });

  it("handles single names and empty input", () => {
    expect(initials("Amina")).toBe("A");
    expect(initials("  ")).toBe("?");
  });
});
