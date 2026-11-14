/** Evidence is recorded by file name, kind and size. The files themselves are not uploaded in this build. */
export type EvidenceFile = { name: string; kind: "photo" | "document" | "other"; sizeLabel: string };

export function attachmentKind(name: string): EvidenceFile["kind"] {
  if (/\.(jpe?g|png|gif|webp|heic)$/i.test(name)) return "photo";
  if (/\.(pdf|docx?|xlsx?|txt|csv)$/i.test(name)) return "document";
  return "other";
}

export function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toEvidence(file: File): EvidenceFile {
  return { name: file.name, kind: attachmentKind(file.name), sizeLabel: sizeLabel(file.size) };
}
