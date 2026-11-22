/**
 * Plain CSV for the "Download" buttons. Values with commas, quotes or line breaks are quoted, so a spreadsheet opens them correctly.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

/** Saves a CSV file from the browser. Does nothing on the server. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([`\ufeff${toCsv(rows)}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
