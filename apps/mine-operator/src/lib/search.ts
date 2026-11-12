export type SearchKind = "Issue" | "Equipment" | "Operating area" | "Readiness" | "Shift" | "Workspace";

export type SearchRecord = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  keywords?: string;
};

function normalise(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function score(record: SearchRecord, terms: string[]) {
  const title = normalise(record.title);
  const haystack = normalise(`${record.title} ${record.subtitle} ${record.keywords ?? ""}`);
  let total = 0;
  for (const term of terms) {
    if (!haystack.includes(term)) return 0;
    total += title.startsWith(term) ? 6 : title.includes(term) ? 4 : 2;
    if (title.split(/[\s—-]+/).some((word) => word.startsWith(term))) total += 1;
  }
  return total;
}

export function rankRecords(query: string, records: SearchRecord[], limit = 8) {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return records.slice(0, limit);
  return records
    .map((record) => ({ record, value: score(record, terms) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.record.title.localeCompare(b.record.title))
    .slice(0, limit)
    .map((entry) => entry.record);
}
